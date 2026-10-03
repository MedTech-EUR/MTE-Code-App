import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import worker from '../server.js';
import { SECURITY_HEADERS } from '../security-headers.js';

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

const APP_SHELL = '<!doctype html><title>The Code App</title>';

function createAssetsBinding() {
  return {
    async fetch(request) {
      const { pathname } = new URL(request.url);
      if (pathname === '/') {
        return new Response(APP_SHELL, { headers: { 'Content-Type': 'text/html' } });
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

test('public/_headers gives static files the same headers as the Worker', () => {
  assert.deepEqual(readHeadersFile(), { '/*': SECURITY_HEADERS });
});

test('the Worker adds the security headers to app routes and API responses', async () => {
  const page = await fetchFromWorker('/code/ch7');
  assert.equal(page.status, 200);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    assert.equal(page.headers.get(name), value, `/code/ch7: ${name}`);
  }

  const api = await fetchFromWorker('/api/historical-declarations/search', { method: 'POST' });
  assert.equal(api.status, 405);
  assert.equal(api.headers.get('Content-Type'), 'application/json');
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    assert.equal(api.headers.get(name), value, `declarations API: ${name}`);
  }
});

test('the CMS and its GitHub sign-in are gone', async () => {
  // Even with the old secrets still set, nothing starts a GitHub sign-in.
  for (const path of ['/api/auth', '/api/auth/callback?code=x&state=y', '/admin', '/admin/']) {
    const response = await fetchFromWorker(path, undefined, {
      GITHUB_CLIENT_ID: 'client-id',
      GITHUB_CLIENT_SECRET: 'client-secret',
    });
    assert.equal(response.status, 200, path);
    assert.equal(await response.text(), APP_SHELL, `${path} gets the app shell`);
  }
});
