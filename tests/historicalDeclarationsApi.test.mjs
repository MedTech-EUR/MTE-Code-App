import test from 'node:test';
import assert from 'node:assert/strict';

import { handleHistoricalDeclarationsRequest, oldestPublicYear } from '../historical-declarations-api.js';

// 2023, 2024 and 2025 are public on this date.
const NOW = new Date('2026-10-03T12:00:00Z');

// Records every statement the handler prepares and returns empty results.
function createFakeDb() {
  const statements = [];

  return {
    statements,
    prepare(sql) {
      const statement = { sql, params: [] };
      statements.push(statement);

      return {
        bind(...params) {
          statement.params = params;
          return this;
        },
        async first() {
          return { total: 0 };
        },
        async all() {
          return { results: [] };
        },
      };
    },
  };
}

async function request(path, now = NOW) {
  const env = { DB: createFakeDb() };
  const response = await handleHistoricalDeclarationsRequest(
    new Request(`https://medtecheurope-code.org/api/historical-declarations/${path}`),
    env,
    now,
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

test('matches search text literally, so a bare wildcard does not match every row', async () => {
  const { sql, params } = pageQuery((await request('search?q=%25')).statements);

  assert.match(sql, /LIKE \? ESCAPE '!'/);
  assert.deepEqual(params.slice(1, 3), ['%!%%', '%!%%']);

  const escaped = pageQuery((await request('search?q=50_off!')).statements);
  assert.deepEqual(escaped.params.slice(1, 3), ['%50!_off!!%', '%50!_off!!%']);
});

test('each year stays public until 31 August three years after its publication deadline', () => {
  assert.equal(oldestPublicYear(NOW), 2023);
  assert.equal(oldestPublicYear(new Date('2027-08-31T23:59:59Z')), 2023);
  assert.equal(oldestPublicYear(new Date('2027-09-01T00:00:00Z')), 2024);
  assert.equal(oldestPublicYear(new Date('2028-01-15T00:00:00Z')), 2024);
});

test('search, metadata and record details leave out years past their public period', async () => {
  const later = new Date('2027-09-01T00:00:00Z');

  const search = await request('search?q=clinic&year=2023', later);
  for (const { sql, params } of search.statements) {
    assert.match(sql, /^SELECT .* FROM declarations WHERE year >= \?/);
    assert.equal(params[0], 2024);
  }

  const metadata = await request('metadata', later);
  const years = metadata.statements.find(({ sql }) => sql.includes('SELECT DISTINCT year'));
  assert.match(years.sql, /WHERE year >= \?/);
  assert.deepEqual(years.params, [2024]);

  // The fake database does not run SQL, so check that the lookup is limited to public years.
  const detail = await request('some-id', later);
  assert.match(detail.statements[0].sql, /d\.year >= \?/);
  assert.deepEqual(detail.statements[0].params, ['some-id', 2024]);
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
