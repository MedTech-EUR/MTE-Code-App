import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { oldestPublicYear } from '../historical-declarations-api.js';

// The local fixture is public in the repository, so it must stay made up
// (scripts/build-d1-sample.py): no real company, beneficiary or address.
const SQL = readFileSync(new URL('../d1/historical-declarations/seed.sample.sql', import.meta.url), 'utf8');
const TEST_NAME = / \(test data\)$/;

const STATEMENT = /INSERT OR IGNORE INTO (\w+) \(([^)]*)\) VALUES \(((?:'(?:[^']|'')*'|[^';])*)\);/g;
const VALUE = /'((?:[^']|'')*)'|(NULL)|(-?\d+(?:\.\d+)?)/g;

function readRows(sql) {
  const tables = {};
  const rest = sql.replace(STATEMENT, (statement, table, columns, values) => {
    const names = columns.split(', ');
    const parsed = [...values.matchAll(VALUE)]
      .map(([, text, nil, number]) => (nil ? null : number !== undefined ? Number(number) : text.replace(/''/g, "'")));
    assert.equal(parsed.length, names.length, `values match columns: ${statement.slice(0, 80)}`);
    (tables[table] ||= []).push(Object.fromEntries(names.map((name, i) => [name, parsed[i]])));
    return '';
  });
  assert.equal(rest.replace(/^--.*$/gm, '').trim(), '', 'nothing but comments and single-row inserts');
  return tables;
}

const TABLES = readRows(SQL);

test('every company and beneficiary in the local fixture is made up', () => {
  const names = [
    ...TABLES.companies.flatMap((row) => [row.name, row.parent_name].filter(Boolean)),
    ...TABLES.beneficiaries.map((row) => row.name),
    ...TABLES.declarations.flatMap((row) => [row.company_name, row.beneficiary_name]),
  ];
  assert.ok(names.length > 200);
  for (const name of names) assert.match(name, TEST_NAME);

  for (const { contact_url: url } of TABLES.companies) {
    if (url) assert.match(new URL(url).hostname, /\.example$/, url);
  }
  for (const { unique_identifier: id } of [...TABLES.companies, ...TABLES.beneficiaries]) {
    assert.ok(!id || id.startsWith('TEST-'), id);
  }
});

test('the local fixture holds together and includes a year the retention rule hides', () => {
  const companies = new Map(TABLES.companies.map((row) => [row.id, row]));
  const beneficiaries = new Map(TABLES.beneficiaries.map((row) => [row.id, row]));
  for (const row of TABLES.declarations) {
    assert.equal(row.company_name, companies.get(row.company_id)?.name);
    assert.equal(row.beneficiary_name, beneficiaries.get(row.beneficiary_id)?.name);
    assert.equal(row.beneficiary_country_code, beneficiaries.get(row.beneficiary_id).country_code);
  }
  const oldestYear = Math.min(...TABLES.declarations.map((row) => row.year));
  assert.ok(oldestYear < oldestPublicYear(new Date('2026-10-01T00:00:00Z')));
});
