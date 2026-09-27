import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { getTreeCvsMessage, getTreeCvsOutcome } from '../src/utils/treeCvs.js';

const { trees } = JSON.parse(readFileSync(new URL('../src/data/treeData.json', import.meta.url), 'utf8'));
const { cvsCheck } = trees.find((tree) => tree.id === 'dt-annex1-cvs-scope');

test('support that needs CVS: each status says what it means', () => {
  assert.equal(getTreeCvsMessage(cvsCheck, 'required', { status: 'Compliant' }).tone, 'positive');
  assert.equal(getTreeCvsMessage(cvsCheck, 'required', { status: 'Not Compliant' }).tone, 'negative');
  assert.equal(getTreeCvsMessage(cvsCheck, 'required', { status: 'Not Pre-cleared' }).tone, 'negative');
  const pending = getTreeCvsMessage(cvsCheck, 'required', { status: 'Under Correction Notice' });
  assert.equal(pending.tone, 'caution');
  assert.match(pending.text, /status “Under Correction Notice”/);
  assert.match(getTreeCvsMessage(cvsCheck, 'required', { status: 'Pre-Cleared' }).text, /only its geographic location and venue/);
});

test('status labels match whatever their case, spacing or dash', () => {
  const late = getTreeCvsMessage(cvsCheck, 'required', { status: 'Not assessed – late  submission' });
  assert.equal(late.tone, 'negative');
  assert.match(late.text, /“Not assessed – late  submission”/);
});

test('an unknown status or no match is said plainly; nothing before a search', () => {
  assert.match(getTreeCvsMessage(cvsCheck, 'required', { status: 'A new status' }).text, /“A new status” is not a CVS status/);
  assert.match(getTreeCvsMessage(cvsCheck, 'required', { noMatch: true }).text, /Submit the Event to CVS/);
  assert.equal(getTreeCvsMessage(cvsCheck, 'required', {}), null);
  assert.equal(getTreeCvsMessage(cvsCheck, 'missing-mode', { status: 'Compliant' }), null);
});

test('a national Event found in CVS is flagged, unless CVS agrees it is out of scope', () => {
  assert.equal(getTreeCvsMessage(cvsCheck, 'national', { status: 'Not assessed - Out Of Scope' }).tone, 'positive');
  for (const status of ['Compliant', 'Under Review', 'Not Compliant', 'Not assessed - Late Submission']) {
    const message = getTreeCvsMessage(cvsCheck, 'national', { status });
    assert.match(message.text, /You have indicated that this is a national Event/, status);
    assert.match(message.text, new RegExp(`status “${status}”`), status);
  }
  // No match does not confirm a national Event, but the search itself says so.
  assert.equal(getTreeCvsMessage(cvsCheck, 'national', { noMatch: true }), null);
});

// The answer card's outcome for a lookup, as TreeCvsCheck.jsx works it out.
const cardOutcome = (mode, outcome, lookup) => getTreeCvsOutcome(mode, getTreeCvsMessage(cvsCheck, mode, lookup)?.tone, outcome);

test('the answer card turns green or red with a final CVS decision, and stays yellow while one is pending', () => {
  assert.equal(cardOutcome('required', 'conditional', {}), 'conditional');
  assert.equal(cardOutcome('required', 'conditional', { status: 'Compliant' }), 'compliant');
  for (const status of ['Not Compliant', 'Not Pre-cleared', 'Not assessed - Late Submission', 'Not assessed - Insufficient information']) {
    assert.equal(cardOutcome('required', 'conditional', { status }), 'non-compliant', status);
  }
  for (const status of ['To be reviewed', 'Under Review', 'Waiting for information', 'Under Correction Notice', 'Under Appeal', 'Pre-Cleared', 'Not assessed - Out Of Scope', 'A new status']) {
    assert.equal(cardOutcome('required', 'conditional', { status }), 'conditional', status);
  }
  assert.equal(cardOutcome('required', 'conditional', { noMatch: true }), 'conditional');
});

test('a national Event keeps its answer unless it is found in CVS with another status', () => {
  assert.equal(cardOutcome('national', 'not-required', {}), 'not-required');
  assert.equal(cardOutcome('national', 'not-required', { noMatch: true }), 'not-required');
  assert.equal(cardOutcome('national', 'not-required', { status: 'Not assessed - Out Of Scope' }), 'not-required');
  assert.equal(cardOutcome('national', 'not-required', { status: 'Compliant' }), 'conditional');
  assert.equal(getTreeCvsOutcome('missing-mode', 'negative', 'not-required'), 'not-required');
});
