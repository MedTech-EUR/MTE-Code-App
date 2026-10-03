import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import worker from '../server.js';
import { NO_FRAMING_HEADERS, SECURITY_HEADERS } from '../security-headers.js';

// Reads public/_headers into { pattern: { name: value } }.
function readHeadersFile() {
  const rules = {};
  let current = null;
  for (const line of readFileSync(new URL('../public/_headers', import.meta.url), 'utf8').split('\n')) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    if (/^\s/.test(line)) {
      const separator = line.indexOf(':');
      current[line.slice(0, separator).trim()] = line.slice(separator + 1).trim();
    } else {
      current = rules[line.trim()] = {};
    }
  }
  return rules;
}

function createAssetsBinding() {
  return {
    async fetch(request) {
      const { pathname } = new URL(request.url);
      if (pathname === '/' || pathname === '/admin/index.html') {
        return new Response('<!doctype html>', { headers: { 'Content-Type': 'text/html' } });
      }
      return new Response('Not found', { status: 404 });
    },
  };
}

async function fetchFromWorker(path, init, env = {}) {
  return worker.fetch(
    new Request(`https://medtecheurope-code.org${path}`, init),
    { ASSETS: createAssetsBinding(), ...env },
  );
}

function assertHeaders(response, expected, label) {
  for (const [name, value] of Object.entries(expected)) {
    assert.equal(response.headers.get(name), value, `${label}: ${name}`);
  }
}

test('public/_headers gives static files the same headers as the Worker', () => {
  assert.deepEqual(readHeadersFile(), {
    '/*': SECURITY_HEADERS,
    '/admin': NO_FRAMING_HEADERS,
    '/admin/*': NO_FRAMING_HEADERS,
  });
});

test('the Worker adds the security headers to app routes and API responses', async () => {
  const page = await fetchFromWorker('/code/ch7');
  assert.equal(page.status, 200);
  assertHeaders(page, SECURITY_HEADERS, '/code/ch7');
  // The public reader may still be embedded elsewhere.
  assert.equal(page.headers.get('X-Frame-Options'), null);
  assert.equal(page.headers.get('Content-Security-Policy'), null);

  const api = await fetchFromWorker('/api/historical-declarations/search', { method: 'POST' });
  assert.equal(api.status, 405);
  assert.equal(api.headers.get('Content-Type'), 'application/json');
  assertHeaders(api, SECURITY_HEADERS, 'declarations API');
});

test('the CMS and its sign-in endpoints cannot be framed by other sites', async () => {
  const admin = await fetchFromWorker('/admin');
  assertHeaders(admin, { ...SECURITY_HEADERS, ...NO_FRAMING_HEADERS }, '/admin');

  // Redirects keep their status and location when the headers are added.
  const signIn = await fetchFromWorker('/api/auth', undefined, {
    GITHUB_CLIENT_ID: 'client-id',
    GITHUB_CLIENT_SECRET: 'client-secret',
  });
  assert.equal(signIn.status, 302);
  assert.match(signIn.headers.get('Location'), /^https:\/\/github\.com\/login\/oauth\/authorize\?/);
  assertHeaders(signIn, { ...SECURITY_HEADERS, ...NO_FRAMING_HEADERS }, '/api/auth');
});
