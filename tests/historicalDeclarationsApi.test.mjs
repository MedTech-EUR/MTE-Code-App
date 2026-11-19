import test from 'node:test';
import assert from 'node:assert/strict';

import { handleHistoricalDeclarationsRequest } from '../historical-declarations-api.js';

// Records every statement the handler prepares and returns empty results.
// With missingIndex, any statement using the search index fails as D1 does
// before d1/historical-declarations/search-index.sql has been run.
function createFakeDb({ missingIndex = false } = {}) {
  const statements = [];

  return {
    statements,
    prepare(sql) {
      const statement = { sql, params: [] };
      statements.push(statement);
      const fail = () => {
        if (missingIndex && sql.includes('declarations_fts')) {
          throw new Error('D1_ERROR: no such table: declarations_fts: SQLITE_ERROR');
        }
      };

      return {
        bind(...params) {
          statement.params = params;
          return this;
        },
        async first() {
          fail();
          return { total: 0 };
        },
        async all() {
          fail();
          return { results: [] };
        },
      };
    },
  };
}

async function request(path, { db = createFakeDb(), ctx } = {}) {
  const env = { DB: db };
  const response = await handleHistoricalDeclarationsRequest(
    new Request(`https://medtecheurope-code.org/api/historical-declarations/${path}`),
    env,
    ctx,
  );
  return { response, statements: env.DB.statements };
}

function pageQuery(statements) {
  const statement = statements.find(({ sql }) => sql.includes('LIMIT ? OFFSET ?'));
  const [limit, offset] = statement.params.slice(-2);
  return { sql: statement.sql, params: statement.params, limit, offset };
}

test('clamps the page size to 1-100, so a negative limit cannot remove the SQL LIMIT', async () => {
  for (const [limitParam, expectedLimit] of [
    ['-1', 1],
    ['0', 1],
    ['500', 100],
    [null, 50],
  ]) {
    const query = limitParam === null ? 'year=2024' : `year=2024&limit=${limitParam}`;
    const { statements } = await request(`search?${query}`);

    assert.equal(pageQuery(statements).limit, expectedLimit, `limit=${limitParam}`);
  }
});

test('matches short search text literally with LIKE, so a bare wildcard does not match every row', async () => {
  const { sql, params } = pageQuery((await request('search?q=%25')).statements);

  assert.match(sql, /LIKE \? ESCAPE '!'/);
  assert.doesNotMatch(sql, /declarations_fts/);
  assert.deepEqual(params.slice(0, 2), ['%!%%', '%!%%']);

  const escaped = pageQuery((await request('search?q=3_')).statements);
  assert.deepEqual(escaped.params.slice(0, 2), ['%3!_%', '%3!_%']);
});

test('looks up search text of three or more characters in the index, as one quoted phrase', async () => {
  const { sql, params } = pageQuery((await request('search?q=50_off%22%20%2A')).statements);

  assert.match(sql, /rowid IN \(SELECT rowid FROM declarations_fts WHERE declarations_fts MATCH \?\)/);
  assert.doesNotMatch(sql, /LIKE/);
  assert.equal(params[0], '"50_off"" *"');
});

test('falls back to LIKE when the search index has not been created', async () => {
  const { response, statements } = await request('search?q=medtech', { db: createFakeDb({ missingIndex: true }) });

  assert.equal(response.status, 200);
  const { sql, params } = pageQuery(statements);
  assert.match(sql, /LIKE \? ESCAPE '!'/);
  assert.deepEqual(params.slice(0, 2), ['%medtech%', '%medtech%']);
});

test('stops counting one row past the accessible window', async () => {
  const { statements } = await request('search?year=2024');
  const count = statements.find(({ sql }) => sql.includes('COUNT(*)'));

  assert.match(count.sql, /LIMIT 1001\)$/);
});

test('orders results with a unique tiebreaker, so pages do not overlap', async () => {
  const { sql } = pageQuery((await request('search?year=2024')).statements);

  assert.match(sql, /ORDER BY year DESC, company_name ASC, id ASC LIMIT/);
});

test('answers repeated requests from the edge cache, and keeps browsers revalidating', async () => {
  const stored = new Map();
  const waits = [];
  globalThis.caches = {
    default: {
      async match(key) { return stored.get(key.url)?.clone(); },
      async put(key, response) { stored.set(key.url, response); },
    },
  };
  const ctx = { waitUntil: (promise) => waits.push(promise) };

  try {
    const first = await request('search?year=2024&nature=a', { ctx });
    await Promise.all(waits);
    assert.equal(first.response.headers.get('X-Declarations-Cache'), 'MISS');
    assert.equal(first.statements.length, 2);
    const [storedCopy] = stored.values();
    assert.equal(storedCopy.headers.get('Cache-Control'), 'public, max-age=3600');

    // Same search, parameters in another order: no database query.
    const second = await request('search?nature=a&year=2024', { ctx });
    assert.equal(second.response.headers.get('X-Declarations-Cache'), 'HIT');
    assert.equal(second.statements.length, 0);
    assert.equal(
      second.response.headers.get('Cache-Control'),
      'public, max-age=0, must-revalidate, s-maxage=3600',
    );
    assert.deepEqual(await second.response.json(), await first.response.json());

    // Errors are not cached.
    await request('search', { ctx });
    assert.equal(stored.size, 1);
  } finally {
    delete globalThis.caches;
  }
});

test('treats whitespace-only search text as no filter', async () => {
  const { response, statements } = await request('search?q=%20%20');

  assert.equal(response.status, 400);
  assert.equal(statements.length, 0);
});

test('returns 404 for malformed declaration ids without querying the database', async () => {
  const { response, statements } = await request('%E0%A4%A');

  assert.equal(response.status, 404);
  assert.equal(response.headers.get('Content-Type'), 'application/json');
  assert.equal(statements.length, 0);
});
