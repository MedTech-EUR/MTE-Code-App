import test from 'node:test';
import assert from 'node:assert/strict';

import worker, { canonicalRedirectUrl } from '../server.js';

const APP_SHELL = '<!doctype html><title>The Code App</title>';
const pageHtml = (path) => `<!doctype html><title>${path}</title>`;

// The pages the build wrote to dist/prerendered/ (scripts/prerender-pages.mjs).
const PRERENDERED_PAGES = [
  '/',
  '/code',
  '/code/ch7',
  '/transparency/disclosure-guidelines/dg-chapter-1',
  '/transparency/historical-declarations',
  '/trees/dt-ch1-event-location',
  '/quiz',
  '/tppt',
  '/event-support',
];

// Mirrors Cloudflare Workers Static Assets with the default
// html_handling ("auto-trailing-slash"): "x.html" is served at "x", a folder's
// "index.html" at the folder with its slash, the ".html" spellings redirect,
// and missing files are plain 404s.
function createAssetsBinding({ prerendered = true } = {}) {
  const requestedPaths = [];
  const requestedHeaders = [];
  const files = new Map([
    ['/', APP_SHELL],
    ['/logo.png', 'png'],
    ['/admin/', '<!doctype html><title>Content editor</title>'],
    ...(prerendered ? PRERENDERED_PAGES : []).map((path) => [
      path === '/' ? '/prerendered/' : `/prerendered${path}`,
      pageHtml(path),
    ]),
  ]);

  return {
    requestedPaths,
    requestedHeaders,
    async fetch(request) {
      const { pathname } = new URL(request.url);
      requestedPaths.push(pathname);
      requestedHeaders.push(request.headers);

      if (pathname.endsWith('/index.html')) {
        return new Response(null, { status: 307, headers: { Location: pathname.slice(0, -'index.html'.length) } });
      }
      if (pathname === '/admin') {
        return new Response(null, { status: 307, headers: { Location: '/admin/' } });
      }
      if (files.has(pathname)) {
        return new Response(files.get(pathname), {
          headers: { 'Content-Type': 'text/html', ETag: `"${pathname}"` },
        });
      }
      return new Response('Not found', { status: 404 });
    },
  };
}

async function fetchFromWorker(path, init, origin = 'https://medtecheurope-code.org', assets = {}) {
  const env = { ASSETS: createAssetsBinding(assets) };
  const response = await worker.fetch(new Request(`${origin}${path}`, init), env);
  return { response, env };
}

test('serves each page its own HTML at its own address', async () => {
  for (const path of PRERENDERED_PAGES) {
    const { response } = await fetchFromWorker(path);

    assert.equal(response.status, 200, `${path} should not redirect`);
    assert.equal(await response.text(), pageHtml(path), `${path} should receive its own page`);
  }
});

test('answers addresses that are not pages with the app shell and a 404', async () => {
  for (const path of ['/nonsense-page', '/code/ch99', '/code/ch7/extra']) {
    const { response } = await fetchFromWorker(path);

    assert.equal(response.status, 404, `${path} should be reported missing`);
    assert.equal(await response.text(), APP_SHELL, `${path} should still open the app`);
  }
});

test('keeps serving the app shell when the build wrote no page files', async () => {
  for (const path of ['/', '/code/ch7', '/nonsense-page']) {
    const { response } = await fetchFromWorker(path, undefined, undefined, { prerendered: false });

    assert.equal(response.status, 200, path);
    assert.equal(await response.text(), APP_SHELL, path);
  }
});

test('does not serve the page files at their own addresses', async () => {
  for (const path of ['/prerendered/code/ch7', '/prerendered/code/ch7.html', '/prerendered']) {
    const { response } = await fetchFromWorker(path);
    assert.equal(response.status, 404, path);
  }
});

test('requests the 404 shell without the browser cache validators of another file', async () => {
  const { response, env } = await fetchFromWorker('/nonsense-page', {
    headers: { 'If-None-Match': '"/"' },
  });

  assert.equal(response.status, 404);
  assert.equal(response.headers.get('ETag'), null);
  assert.equal(env.ASSETS.requestedHeaders.at(-1).get('If-None-Match'), null);
});

test('redirects www and trailing-slash addresses to the canonical address', async () => {
  const cases = [
    ['https://www.medtecheurope-code.org', '/', 'https://medtecheurope-code.org/'],
    ['https://www.medtecheurope-code.org', '/code/ch7', 'https://medtecheurope-code.org/code/ch7'],
    ['https://medtecheurope-code.org', '/code/ch7/', 'https://medtecheurope-code.org/code/ch7'],
    ['https://www.medtecheurope-code.org', '/code//', 'https://medtecheurope-code.org/code'],
    ['https://medtecheurope-code.org', '/quiz/?q=1', 'https://medtecheurope-code.org/quiz?q=1'],
  ];

  for (const [origin, path, location] of cases) {
    const { response, env } = await fetchFromWorker(path, undefined, origin);

    assert.equal(response.status, 301, `${origin}${path}`);
    assert.equal(response.headers.get('Location'), location);
    assert.deepEqual(env.ASSETS.requestedPaths, []);
  }
});

test('leaves the API, the content editor and other methods on their own addresses', () => {
  const unchanged = [
    new Request('https://medtecheurope-code.org/code/ch7'),
    new Request('https://medtecheurope-code.org/'),
    new Request('http://medtecheurope-code.org/code/ch7'),
    new Request('https://www.medtecheurope-code.org/api/cvs/search?q=x'),
    new Request('https://www.medtecheurope-code.org/admin/'),
    new Request('https://medtecheurope-code.org/admin/history/'),
    new Request('https://www.medtecheurope-code.org/code/ch7/', { method: 'POST' }),
  ];

  for (const request of unchanged) {
    assert.equal(canonicalRedirectUrl(request), null, `${request.method} ${request.url}`);
  }
});

test('serves the content editor from its own folder', async () => {
  const editor = await fetchFromWorker('/admin/');
  assert.equal(editor.response.status, 200);
  assert.match(await editor.response.text(), /Content editor/);

  const withoutSlash = await fetchFromWorker('/admin');
  assert.equal(withoutSlash.response.status, 307);
  assert.equal(withoutSlash.response.headers.get('Location'), '/admin/');
});

test('passes real static files through, including 404s for missing chunks', async () => {
  const logo = await fetchFromWorker('/logo.png');
  assert.equal(logo.response.status, 200);
  assert.deepEqual(logo.env.ASSETS.requestedPaths, ['/logo.png']);

  const staleChunk = await fetchFromWorker('/assets/TPPTContent-stale.js');
  assert.equal(staleChunk.response.status, 404);
});

test('handles declarations API routes before the page fallback', async () => {
  const { response, env } = await fetchFromWorker('/api/historical-declarations/search', {
    method: 'POST',
  });

  assert.equal(response.status, 405);
  assert.equal(response.headers.get('Content-Type'), 'application/json');
  assert.deepEqual(env.ASSETS.requestedPaths, []);
});
