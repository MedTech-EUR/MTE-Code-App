import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { buildRemovalSql, parseCsv, readBeneficiaryIds } from '../scripts/archive-removal.mjs';

const A = '5ecd288d-396a-466e-bd4a-0fb55c36f496';
const B = '7cd26617-d81f-4a72-90e9-57d6ac000001';
const C = 'b0437c91-0000-4000-8000-000000000002';

test('reads the reviewed list as Excel saves it, with commas or semicolons', () => {
  const comma = '﻿"#","Individual? (yes/no)","Beneficiary name","Beneficiary ID"\r\n'
    + `"1","yes","PRAXIS DR. EXAMPLE, MÜNCHEN","${A}"\r\n`
    + `"2","no","Hospital Universitario Doctor Example","${B}"\r\n`
    + `"3","","Ordination Dr. Example","${C}"\r\n`;
  assert.deepEqual(readBeneficiaryIds(comma, 'csv'), [A]);

  const semicolon = `#;Individual? (yes/no);Beneficiary name;Beneficiary ID\n1;Yes;"DR. MED. ""JANE"" EXAMPLE";${A.toUpperCase()}\n2; y ;Cabinet;${C}\n`;
  assert.deepEqual(readBeneficiaryIds(semicolon, 'csv'), [A, C].sort());
  assert.deepEqual(parseCsv(semicolon)[1][2], 'DR. MED. "JANE" EXAMPLE');
});

test('reads a plain list of IDs, ignoring comments and blank lines', () => {
  assert.deepEqual(readBeneficiaryIds(`# reviewed 2026-10\n${B}\n\n${A}  # duplicate below\n${A}\n`, 'txt'), [A, B].sort());
});

test('refuses anything that is not a beneficiary ID, so nothing else reaches the SQL', () => {
  assert.throws(
    () => readBeneficiaryIds(`#;Individual?;Beneficiary ID\n1;yes;x'); DROP TABLE declarations;--\n`, 'csv'),
    /CSV row 2: .* is not a beneficiary ID/,
  );
  assert.throws(() => readBeneficiaryIds('Individual?,Name\nyes,Example\n', 'csv'), /needs an "Individual\?" column and a "Beneficiary ID" column/);
});

test('removes the declarations and the beneficiaries, in batches', () => {
  const ids = Array.from({ length: 150 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`);
  const sql = buildRemovalSql(ids);
  assert.equal((sql.match(/^DELETE FROM declarations WHERE beneficiary_id IN \(/gm) || []).length, 2);
  assert.equal((sql.match(/^DELETE FROM beneficiaries WHERE id IN \(/gm) || []).length, 2);
  for (const id of ids) assert.equal(sql.split(`'${id}'`).length - 1, 2, id);
  assert.match(sql, /^-- Removes 150 beneficiaries/);
});

test('the command writes the SQL and the exclusion list for rebuilds', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'archive-removal-'));
  const input = path.join(dir, 'reviewed.csv');
  writeFileSync(input, `"Individual? (yes/no)","Beneficiary ID"\n"yes","${B}"\n"no","${A}"\n`);
  const out = path.join(dir, 'private');
  execFileSync(process.execPath, ['scripts/archive-removal.mjs', input, '--out', out], { encoding: 'utf8' });

  assert.match(readFileSync(path.join(out, 'remove-beneficiaries.sql'), 'utf8'), new RegExp(`'${B}'`));
  assert.deepEqual(
    readFileSync(path.join(out, 'excluded-beneficiaries.txt'), 'utf8').split('\n').filter((line) => line && !line.startsWith('#')),
    [B],
  );
});
