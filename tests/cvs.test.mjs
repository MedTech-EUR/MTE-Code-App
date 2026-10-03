import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as miniflare from 'miniflare';

// Miniflare is already supplied by the pinned Wrangler development dependency.
// Run the actual Workers HTMLRewriter; no DOM substitute and no live CVS calls.
const fixture = (name) => readFileSync(new URL(`./fixtures/cvs/${name}.html`, import.meta.url), 'utf8');
const session = fixture('session');
const one = fixture('search-one');
const zero = fixture('search-zero');
const detail = fixture('detail');
const two = one.replace('1 Event Found', '2 Events Found').replace(/\s*<\/div>\s*$/, '')
  + one.slice(one.indexOf('  <div class="card'), one.lastIndexOf('</div>'))
    .replaceAll('EMT-26-11175', 'EMT-25-05078').replace('20th Belgian', '19th Belgian') + '</div>';

const harness = `
import { parseSearchSession, parseSearchResults, parseEventDetail, extractEmtId } from './cvs-parser.js';
import { createCvsAdapter } from './cvs-adapter.js';
import { handleCvsRequest } from './cvs-api.js';
import server from './server.js';
export default { async fetch(request) {
  const input = await request.json();
  const calls = [];
  const replies = [...(input.replies || [])];
  const adapter = createCvsAdapter({ timeoutMs: input.timeoutMs || 20000, fetchImpl: async (url, init) => {
    calls.push({ url, method: init.method || 'GET', body: init.body?.toString(), headers: init.headers, redirect: init.redirect, cf: init.cf });
    const reply = replies.shift();
    if (!reply) throw new Error('Unexpected upstream call');
    if (reply.fail) throw new TypeError('Mock network failure');
    if (reply.timeout) return new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(new Error('aborted')), { once:true }));
    const headers = new Headers({ 'Content-Type': reply.contentType || 'text/html', ...reply.headers });
    for (const cookie of reply.cookies || []) headers.append('Set-Cookie', cookie);
    const body = reply.bodyTimeout ? new ReadableStream({ start(controller) {
      init.signal.addEventListener('abort', () => controller.error(new Error('aborted body')), { once:true });
    } }) : reply.body;
    return new Response(body, { status: reply.status || 200, headers });
  }});
  try {
    let data;
    if (input.op === 'workerRoute') {
      const assets = [];
      const result = await server.fetch(new Request('https://app.example' + input.path), { ASSETS: { fetch: async (request) => {
        const path = new URL(request.url).pathname; assets.push(path);
        return path === '/index.html' ? new Response(null, { status: 307, headers: { Location: '/' } })
          : new Response('<html>App</html>', { headers: { 'Content-Type': 'text/html' } });
      } } });
      data = { httpStatus: result.status, location: result.headers.get('location'), assets };
    }
    if (input.op === 'token') data = await parseSearchSession(input.html);
    if (input.op === 'searchParse') data = await parseSearchResults(input.html);
    if (input.op === 'detailParse') data = await parseEventDetail(input.html, input.emtId || 'EMT-26-11175');
    if (input.op === 'emt') data = extractEmtId(input.href);
    if (input.op === 'search') data = await adapter.searchEvents(input.filters);
    if (input.op === 'status') data = await adapter.getEventStatus(input.emtId);
    if (input.op === 'api') {
      const result = await handleCvsRequest(new Request('https://app.example' + input.path, {
        method: input.method || 'POST', headers: { 'Content-Type': 'application/json', ...input.headers },
        body: input.method === 'GET' ? undefined : (input.body ?? JSON.stringify(input.filters)),
      }), adapter);
      data = { httpStatus: result.status, headers: Object.fromEntries(result.headers), json: await result.json() };
    }
    return Response.json({ data, calls });
  } catch(error) { return Response.json({ error: { code: error.code, message: error.message }, calls }); }
}};
`;

let runtime;
before(async () => {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const options = {
    compatibilityDate: '2024-09-02', modulesRoot: root,
    modules: [{ type: 'ESModule', path: `${root}/cvs-test-entry.js`, contents: harness },
      ...['cvs-parser.js', 'cvs-adapter.js', 'cvs-api.js', 'server.js', 'historical-declarations-api.js', 'security-headers.js'].map((name) => ({
        type: 'ESModule', path: `${root}/${name}`, contents: readFileSync(new URL(`../${name}`, import.meta.url), 'utf8'),
      }))],
  };
  // Support the v5 conversion layer as well as Wrangler releases using v4.
  runtime = new miniflare.Miniflare(miniflare.convertV4MiniflareOptions?.(options) || options);
  await runtime.ready;
});
after(async () => { await runtime?.dispose(); });
async function run(input) {
  const response = await runtime.dispatchFetch('https://test.local/', {
    method: 'POST', body: JSON.stringify(input), headers: { 'Content-Type': 'application/json' },
  });
  return response.json();
}
const replies = (body = one) => [
  { body: session, cookies: ['XSRF-TOKEN=fixture-xsrf; Path=/', 'cvs_session=fixture-session; Expires=Wed, 30 Sep 2026 00:00:00 GMT; HttpOnly'] },
  { body },
];

test('CVS extracts only the public search form CSRF token', async () => {
  assert.equal((await run({ op: 'token', html: `<input name="_token" value="wrong">${session}` })).data, 'fixture-token-only');
  assert.equal((await run({ op: 'token', html: session.replace('name="_token"', 'name="changed"') })).error.code, 'CVS_CSRF_MISSING');
  assert.equal((await run({ op: 'token', html: '<html>Maintenance</html>' })).error.code, 'CVS_HTML_CHANGED');
  assert.equal((await run({ op: 'token', html: session.replace('/all-events"', '/other"') })).error.code, 'CVS_HTML_CHANGED');
});

test('CVS parses one minimal event and preserves the complete raw search status', async () => {
  const { data, error } = await run({ op: 'searchParse', html: one });
  assert.equal(error, undefined);
  assert.deepEqual(data.results, [{ emtId: 'EMT-26-11175', name: '20th Belgian Heart Rhythm Meeting',
    from: '2026-11-18', to: '2026-11-20', city: 'Zaventem', country: 'Belgium',
    status: { raw: 'Compliant (Final assessment by CO) (41)' },
    detailUrl: 'https://cvs.solutions.iqvia.com/event/detail/EMT-26-11175' }]);
  assert.equal(data.mayBeLimited, false);
  assert.equal(JSON.stringify(data).includes('Organisation'), false);
});

test('CVS distinguishes multiple events and a recognized zero-result page', async () => {
  const many = await run({ op: 'searchParse', html: two });
  assert.equal(many.error, undefined);
  assert.deepEqual(many.data.results.map((event) => event.emtId), ['EMT-26-11175', 'EMT-25-05078']);
  assert.deepEqual((await run({ op: 'searchParse', html: zero })).data, { results: [], mayBeLimited: false });
});

test('CVS flags the observed 50-event boundary without fetching more pages', async () => {
  const card = one.slice(one.indexOf('  <div class="card'), one.lastIndexOf('</div>'));
  const html = '<div class="table-listing"><h3>Search Results 50 Events Found</h3>'
    + Array.from({ length: 50 }, (_, index) => card.replaceAll('EMT-26-11175', `EMT-26-${String(11175 + index).padStart(5, '0')}`)).join('') + '</div>';
  const { data, calls, error } = await run({ op: 'search', filters: { name: 'Heart' }, replies: replies(html) });
  assert.equal(error, undefined);
  assert.equal(data.results.length, 50);
  assert.equal(data.mayBeLimited, true);
  assert.equal(calls.length, 2);
});

test('CVS fails visibly for changed, inconsistent, duplicate or truncated search HTML', async () => {
  for (const html of ['<html>No events</html>', zero.replace('table-listing', 'different-list'),
    one.replace('1 Event Found', '2 Events Found'), one.replace('card-title', 'new-title'),
    one.replace('Country :', 'Nation :'), one.slice(0, one.indexOf('<div class="row')),
    one.replace('1 Event Found', '0 Event Found'), zero.replace('No Events Found For This Search Criteria.', 'Something else'),
    two.replaceAll('EMT-25-05078', 'EMT-26-11175')]) {
    assert.equal((await run({ op: 'searchParse', html })).error?.code, 'CVS_HTML_CHANGED');
  }
});

test('CVS decodes text entities without corrupting names or statuses', async () => {
  const { data } = await run({ op: 'searchParse', html: one.replace('20th Belgian', 'Rhythm &amp; &#xC9; &eacute;') });
  assert.equal(data.results[0].name, 'Rhythm & É é Heart Rhythm Meeting');
  assert.equal((await run({ op: 'searchParse', html: one.replace('Zaventem', '&unsupported;') })).error.code, 'CVS_HTML_CHANGED');
});

test('CVS accepts only canonical supplier EMT links', async () => {
  assert.equal((await run({ op: 'emt', href: '/event/detail/EMT-26-11175' })).data, 'EMT-26-11175');
  for (const href of ['https://other.example/event/detail/EMT-26-11175', '/event/detail/invalid',
    '/event/detail/EMT-26-11175?redirect=other', '/event/detail/EMT-26-11175#status']) {
    assert.equal((await run({ op: 'emt', href })).error.code, 'CVS_HTML_CHANGED');
  }
});

test('CVS extracts overall detail status, never an individual criterion badge', async () => {
  const { data, error } = await run({ op: 'detailParse', html: detail });
  assert.equal(error, undefined);
  assert.equal(data.emtId, 'EMT-26-11175');
  assert.deepEqual(data.status, { raw: 'Compliant' });
  const changedStatus = await run({ op: 'detailParse', html: detail.replace('> Compliant</label>', '> To be reviewed</label>') });
  assert.deepEqual(changedStatus.data.status, { raw: 'To be reviewed' });
});

test('CVS distinguishes unidentified status from unrecognized detail identity', async () => {
  assert.equal((await run({ op: 'detailParse', html: detail.replace('Overall status of event:', 'Criteria status:') })).error.code, 'CVS_STATUS_UNKNOWN');
  assert.equal((await run({ op: 'detailParse', html: detail.replace('> Compliant</label>', '> </label>') })).error.code, 'CVS_STATUS_UNKNOWN');
  assert.equal((await run({ op: 'detailParse', html: detail, emtId: 'EMT-25-05078' })).error.code, 'CVS_HTML_CHANGED');
  assert.equal((await run({ op: 'detailParse', html: '<html>Login</html>' })).error.code, 'CVS_HTML_CHANGED');
});

test('CVS performs exactly GET + POST with request-scoped token/cookies and CVS date format', async () => {
  const { data, calls, error } = await run({ op: 'search', filters: {
    name: 'Heart', country: 'Belgium', from: '2026-11-01', to: '2026-11-30',
  }, replies: replies() });
  assert.equal(error, undefined);
  assert.equal(calls.length, 2);
  assert.deepEqual(calls.map((call) => call.method), ['GET', 'POST']);
  const form = new URLSearchParams(calls[1].body);
  assert.equal(form.get('_token'), 'fixture-token-only');
  assert.equal(form.get('public_event_filter_from'), '01-11-2026');
  assert.equal(form.get('public_event_filter_to'), '30-11-2026');
  assert.equal(form.get('public_event_filter_country'), 'Belgium');
  assert.equal(form.get('public_event_filter_emt'), '');
  assert.equal([...form.keys()].length, 11);
  assert.equal(calls[1].headers.Cookie, 'XSRF-TOKEN=fixture-xsrf; cvs_session=fixture-session');
  assert.equal(calls[1].headers['Content-Type'], 'application/x-www-form-urlencoded');
  assert.equal(calls[0].redirect, 'manual');
  assert.match(calls[0].headers['User-Agent'], /MTE-Code-App/);
  // A cf cache TTL makes Cloudflare drop Set-Cookie, leaving the POST without a session.
  // Local runtimes ignore cf, so only this check catches it before deployment.
  assert.deepEqual(calls.map((call) => call.cf), [undefined, undefined]);
  assert.equal(JSON.stringify(data).includes('fixture-'), false);
  assert.ok(Number.isFinite(Date.parse(data.retrievedAt)));
});

test('CVS name-only search needs no country, dates or EMT input', async () => {
  const { data, calls } = await run({ op: 'search', filters: { name: 'Heart' }, replies: replies(zero) });
  assert.deepEqual(data.results, []);
  assert.equal(new URLSearchParams(calls[1].body).get('public_event_filter_from'), '');
});

test('CVS validates input before contacting the supplier', async () => {
  for (const filters of [null, [], {}, { name: ' ' }, { name: 123 },
    { name: 'Heart', from: '2026-02-30' }, { name: 'Heart', from: '01-11-2026' },
    { name: 'Heart', from: '2026-12-01', to: '2026-11-01' }]) {
    const result = await run({ op: 'search', filters });
    assert.equal(result.error.code, 'INVALID_REQUEST');
    assert.equal(result.calls.length, 0);
  }
});

test('CVS uses one live detail request with no search session', async () => {
  const { data, calls } = await run({ op: 'status', emtId: 'EMT-26-11175', replies: [{ body: detail }] });
  assert.deepEqual(data.status, { raw: 'Compliant' });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].headers.Cookie, undefined);
  assert.equal(calls[0].cf, undefined);
});

test('CVS reports unavailable, timeout, malformed and missing-token responses as technical errors', async () => {
  const cases = [
    [{ fail: true }, 'CVS_UNAVAILABLE'], [{ status: 503, body: 'Maintenance' }, 'CVS_UNAVAILABLE'],
    [{ status: 302, body: 'Redirect' }, 'CVS_UNAVAILABLE'], [{ contentType: 'application/json', body: '{}' }, 'CVS_RESPONSE_INVALID'],
    [{ body: session.replace('name="_token"', 'name="other"') }, 'CVS_CSRF_MISSING'],
    [{ body: session, headers: { 'content-length': String(6 * 1024 * 1024) } }, 'CVS_RESPONSE_INVALID'],
    [{ timeout: true }, 'CVS_TIMEOUT'],
    [{ bodyTimeout: true }, 'CVS_TIMEOUT'],
  ];
  for (const [reply, code] of cases) {
    const { error } = await run({ op: 'search', filters: { name: 'Heart' }, replies: [reply], timeoutMs: 20 });
    assert.equal(error.code, code);
  }
  assert.equal((await run({ op: 'status', emtId: 'EMT-26-11175', replies: [{ status: 404, body: 'Missing' }] })).error.code, 'CVS_UNAVAILABLE');
});

test('CVS same-origin API returns no-store JSON, never cookies or tokens', async () => {
  const { data } = await run({ op: 'api', path: '/api/cvs/search', filters: { name: 'Heart' }, replies: replies() });
  assert.equal(data.httpStatus, 200);
  assert.equal(data.headers['cache-control'], 'no-store');
  assert.equal(data.headers['set-cookie'], undefined);
  assert.equal(JSON.stringify(data.json).includes('fixture-'), false);
  const selected = await run({ op: 'api', method: 'GET', path: '/api/cvs/events/EMT-26-11175', replies: [{ body: detail }] });
  assert.equal(selected.data.httpStatus, 200);
  assert.equal(selected.data.json.status.raw, 'Compliant');
});

test('CVS API rejects wrong methods, malformed/large JSON, foreign origins and arbitrary URLs', async () => {
  for (const [input, expected] of [
    [{ method: 'GET', path: '/api/cvs/search' }, 405],
    [{ path: '/api/cvs/search', body: '{bad' }, 400],
    [{ path: '/api/cvs/search', body: 'x'.repeat(4097) }, 400],
    [{ path: '/api/cvs/search', filters: { name: 'Heart' }, headers: { Origin: 'https://other.example' } }, 403],
    [{ path: '/api/cvs/search', filters: { name: 'Heart' }, headers: { 'Sec-Fetch-Site': 'cross-site' } }, 403],
    [{ path: '/api/cvs/events/https://other.example' }, 404],
  ]) {
    const { data, calls } = await run({ op: 'api', ...input });
    assert.equal(data.httpStatus, expected);
    assert.equal(data.headers['cache-control'], 'no-store');
    assert.equal(calls.length, 0);
  }
});

test('CVS API returns explicit unknown technical errors without assigning a substantive status', async () => {
  const { data } = await run({ op: 'api', path: '/api/cvs/search', filters: { name: 'Heart' }, replies: [{ status: 503, body: 'secret' }] });
  assert.equal(data.httpStatus, 502);
  assert.equal(data.json.error.code, 'CVS_UNAVAILABLE');
  assert.equal(data.json.status, undefined);
  assert.equal(JSON.stringify(data.json).includes('secret'), false);
});

// SPA deep links are covered by serverSpaFallback.test.mjs; this checks the CVS API is
// answered by the Worker before the app-shell fallback.
test('Worker answers the CVS API itself instead of serving the app shell', async () => {
  assert.deepEqual((await run({ op: 'workerRoute', path: '/api/cvs/unknown' })).data,
    { httpStatus: 404, location: null, assets: [] });
  assert.deepEqual((await run({ op: 'workerRoute', path: '/event-support' })).data,
    { httpStatus: 200, location: null, assets: ['/'] });
});
