import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { normalizeCvsStatus } from '../src/utils/eventSupportCvs.js';

const readJson = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const tree = readJson('../src/data/treeData.json').trees.find((item) => item.id === 'dt-annex1-cvs-scope');
// The Annex I cells, quoted verbatim in the event support checker's rules and checked there.
const { annex1Text } = readJson('../src/data/eventSupportRules.json');
const node = (id) => tree.nodes.find((item) => item.id === id);

// The checker's Annex I rows, in the order the tree offers the types of support.
const ROWS = ['grant-running', 'grant-attendance', 'grant-faculty', 'satellite', 'company-attendance', 'booth', 'direct-delegate', 'direct-faculty'];

// Follows the answers, given as option positions, from the start to a result.
function follow(...choices) {
  let current = node('start');
  for (const choice of choices) {
    assert.equal(current.type, 'question', `answer ${choice} given to result ${current.id}`);
    current = node(current.options[choice].next);
  }
  return current;
}

const WHERE = { area: 0, outside: 1, online: 2 };
const AUDIENCE = { international: 0, national: 1, mixed: 2, unknown: 3 };
const AREA_HCPS = { yes: 0, no: 1, unknown: 2 };

test('every Annex I cell reached through the tree gives Annex I’s answer', () => {
  const columns = [
    [WHERE.area, AUDIENCE.national],
    [WHERE.area, AUDIENCE.international],
    [WHERE.outside, AREA_HCPS.yes],
    [WHERE.outside, AREA_HCPS.no],
  ];
  columns.forEach((path, column) => {
    ROWS.forEach((row, index) => {
      let result = follow(...path, index);
      // Annex I, footnote 3: outside the Area, only HCPs from the Area funded by the grant count.
      if (row === 'grant-attendance' && column === 2) result = follow(...path, index, 0);
      assert.equal(result.type, 'result', `${row}, column ${column + 1}`);
      const cell = annex1Text[row][column];
      if (cell === 'N/A') assert.match(result.text, /^Annex I marks this N\/A/, `${row}, column ${column + 1}`);
      else assert.ok(result.text.startsWith(cell), `${row}, column ${column + 1}: “${result.text}” should start with “${cell}”`);
    });
  });
});

test('outside the Area, an attendance grant that funds no HCPs from the Area needs no CVS decision', () => {
  const result = follow(WHERE.outside, AREA_HCPS.yes, 1, 1);
  assert.equal(result.id, 'res_grant_no_area_beneficiaries');
  assert.equal(result.outcome, 'not-required');
  assert.equal(result.cvsCheck, undefined);
});

test('online Events are outside CVS; direct sponsorship stays not allowed', () => {
  ROWS.forEach((row, index) => {
    const result = follow(WHERE.online, index);
    if (row.startsWith('direct')) assert.equal(result.outcome, 'non-compliant', row);
    else if (row === 'company-attendance') assert.equal(result.id, 'res_prior_review');
    else assert.equal(result.id, 'res_virtual', row);
    assert.equal(result.cvsCheck, undefined, row);
  });
});

test('an audience Annex I does not classify, or an unknown answer, gives no CVS position', () => {
  for (const path of [[WHERE.area, AUDIENCE.mixed], [WHERE.area, AUDIENCE.unknown], [WHERE.outside, AREA_HCPS.unknown], [WHERE.outside, AREA_HCPS.yes, 1, 2]]) {
    assert.equal(follow(...path).outcome, 'more-info', JSON.stringify(path));
  }
});

test('the CVS check appears exactly where the answer depends on CVS', () => {
  for (const result of tree.nodes.filter((item) => item.type === 'result')) {
    if (result.text.startsWith('Subject to CVS decision')) assert.equal(result.cvsCheck, 'required', result.id);
    else if (result.id === 'res_national') assert.equal(result.cvsCheck, 'national');
    else assert.equal(result.cvsCheck, undefined, result.id);
  }
});

test('every node can be reached from the start', () => {
  const reached = new Set(['start']);
  const queue = ['start'];
  while (queue.length) {
    const current = node(queue.shift());
    for (const option of current.options || []) {
      if (!reached.has(option.next)) {
        reached.add(option.next);
        queue.push(option.next);
      }
    }
  }
  assert.deepEqual(tree.nodes.map((item) => item.id).filter((id) => !reached.has(id)), []);
});

// The status list of CVS 2.0 (the Status filter on the CVS site, September 2026).
const CVS_2_STATUSES = [
  'Waiting for information', 'Under Review', 'Under Correction Notice', 'Under Appeal', 'To be reviewed',
  'Pre-Cleared', 'Not Compliant', 'Not assessed - Late Submission', 'Not assessed - Out Of Scope',
  'Not assessed - Insufficient information', 'Not Pre-cleared', 'Compliant',
];

test('the CVS check has a text for every CVS 2.0 status, and no others', () => {
  const labels = tree.cvsCheck.required.statuses.flatMap((entry) => entry.labels).map(normalizeCvsStatus);
  assert.deepEqual([...labels].sort(), CVS_2_STATUSES.map(normalizeCvsStatus).sort());
  for (const entry of tree.cvsCheck.national.statuses) {
    for (const label of entry.labels) assert.ok(CVS_2_STATUSES.map(normalizeCvsStatus).includes(normalizeCvsStatus(label)), label);
  }
});
