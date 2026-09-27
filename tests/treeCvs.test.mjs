import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { getTreeCvsMessage } from '../src/utils/treeCvs.js';

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
