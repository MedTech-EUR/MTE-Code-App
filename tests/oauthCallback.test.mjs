import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';

import server from '../server.js';
import proxy from '../oauth-proxy.js';

const TOKEN = 'gho_test_token';
const TOKEN_MESSAGE = `authorization:github:success:${JSON.stringify({ token: TOKEN, provider: 'github' })}`;
const SECRETS = { GITHUB_CLIENT_ID: 'client-id', GITHUB_CLIENT_SECRET: 'client-secret' };

// The two Workers that serve Decap CMS sign-in: the Worker's own same-origin
// endpoints and the standalone proxy named in public/admin/config.yml.
const WORKERS = [
  {
    name: 'server.js',
    worker: server,
    origin: 'https://medtecheurope-code.org',
    authPath: '/api/auth',
    callbackPath: '/api/auth/callback',
    env: { ASSETS: { fetch: async () => new Response('Not found', { status: 404 }) } },
  },
  {
    name: 'oauth-proxy.js',
    worker: proxy,
    origin: 'https://mte-oauth-proxy.medtecheurope.workers.dev',
    authPath: '/auth',
    callbackPath: '/callback',
    env: {},
  },
];

async function signIn({ worker, origin, authPath, callbackPath, env }, extraEnv = {}) {
  const fullEnv = { ...env, ...SECRETS, ...extraEnv };
  const authorize = await worker.fetch(new Request(origin + authPath), fullEnv);
  const githubUrl = new URL(authorize.headers.get('Location'));

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ access_token: TOKEN });
  try {
    const callback = await worker.fetch(
      new Request(`${origin}${callbackPath}?code=code&state=${encodeURIComponent(githubUrl.searchParams.get('state'))}`),
      fullEnv,
    );
    return { githubUrl, callback, html: await callback.text() };
  } finally {
    globalThis.fetch = originalFetch;
  }
}

// Runs the callback page's script against a fake popup window and records
// what it posts to its opener.
function openCallbackPage(html) {
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  assert.equal(scripts.length, 1, 'the page has one inline script');
  const sent = [];
  const listeners = new Set();
  const opener = { postMessage: (data, targetOrigin) => sent.push({ data, targetOrigin }) };
  const window = {
    opener,
    addEventListener: (type, listener) => type === 'message' && listeners.add(listener),
    removeEventListener: (type, listener) => listeners.delete(listener),
  };
  vm.runInNewContext(scripts[0][1], { window });
  const receive = (event) => [...listeners].forEach((listener) => listener({ data: 'authorizing:github', ...event }));
  return { sent, opener, receive };
}

for (const target of WORKERS) {
  test(`${target.name}: asks GitHub for public_repo unless GITHUB_OAUTH_SCOPE says otherwise`, async () => {
    const { githubUrl } = await signIn(target);
    assert.equal(githubUrl.searchParams.get('scope'), 'public_repo');

    const custom = await signIn(target, { GITHUB_OAUTH_SCOPE: 'repo' });
    assert.equal(custom.githubUrl.searchParams.get('scope'), 'repo');
  });

  test(`${target.name}: sends the token only to the CMS window at an allowed origin`, async () => {
    const { callback, html } = await signIn(target);
    assert.equal(callback.status, 200);
    assert.equal(callback.headers.get('Cache-Control'), 'no-store');

    const popup = openCallbackPage(html);
    // The handshake goes to any origin but carries no token.
    assert.deepEqual(popup.sent, [{ data: 'authorizing:github', targetOrigin: '*' }]);

    popup.receive({ source: popup.opener, origin: 'https://attacker.example' });
    popup.receive({ source: {}, origin: 'https://medtecheurope-code.org' });
    assert.equal(popup.sent.length, 1, 'no token for another origin or another window');

    popup.receive({ source: popup.opener, origin: 'https://medtecheurope-code.org' });
    assert.deepEqual(popup.sent[1], { data: TOKEN_MESSAGE, targetOrigin: 'https://medtecheurope-code.org' });

    popup.receive({ source: popup.opener, origin: 'https://medtecheurope-code.org' });
    assert.equal(popup.sent.length, 2, 'the token is sent once');
  });

  test(`${target.name}: an allowed origin cannot break out of the inline script`, async () => {
    const { html } = await signIn(target, {
      ALLOWED_ORIGINS: 'https://medtecheurope-code.org,https://x.example</script><script>alert(1)//',
    });
    assert.equal(html.match(/<\/script>/g).length, 1);
    assert.equal(html.includes('<script>alert'), false);
  });
}

test('server.js: allows its own origin and the origins in ALLOWED_ORIGINS', async () => {
  const [target] = WORKERS;
  const www = 'https://www.medtecheurope-code.org';

  const ownOnly = openCallbackPage((await signIn(target)).html);
  ownOnly.receive({ source: ownOnly.opener, origin: www });
  assert.equal(ownOnly.sent.length, 1, 'www is not allowed by default');

  const withWww = openCallbackPage((await signIn(target, { ALLOWED_ORIGINS: www })).html);
  withWww.receive({ source: withWww.opener, origin: www });
  assert.deepEqual(withWww.sent[1], { data: TOKEN_MESSAGE, targetOrigin: www });
});

test('oauth-proxy.js: allows both production hosts by default, and ALLOWED_ORIGINS replaces them', async () => {
  const [, target] = WORKERS;

  const defaults = openCallbackPage((await signIn(target)).html);
  defaults.receive({ source: defaults.opener, origin: 'https://www.medtecheurope-code.org' });
  assert.equal(defaults.sent[1].targetOrigin, 'https://www.medtecheurope-code.org');

  const replaced = openCallbackPage((await signIn(target, { ALLOWED_ORIGINS: 'https://preview.example' })).html);
  replaced.receive({ source: replaced.opener, origin: 'https://medtecheurope-code.org' });
  assert.equal(replaced.sent.length, 1, 'the defaults no longer apply');
  replaced.receive({ source: replaced.opener, origin: 'https://preview.example' });
  assert.equal(replaced.sent[1].targetOrigin, 'https://preview.example');
});

test('oauth-proxy.js: answers CORS only for the CMS origins', async () => {
  const [, target] = WORKERS;
  const preflight = (origin) => proxy.fetch(
    new Request(`${target.origin}/auth`, { method: 'OPTIONS', headers: { Origin: origin } }),
    {},
  );

  const allowed = await preflight('https://medtecheurope-code.org');
  assert.equal(allowed.headers.get('Access-Control-Allow-Origin'), 'https://medtecheurope-code.org');
  assert.equal(allowed.headers.get('Vary'), 'Origin');

  const other = await preflight('https://attacker.example');
  assert.equal(other.headers.get('Access-Control-Allow-Origin'), null);
});
