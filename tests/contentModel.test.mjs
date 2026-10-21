// Content history in editors' terms (public/admin/history/content-model.js).
import assert from 'node:assert/strict';
import test from 'node:test';

import { compareContent, fieldsOf, planUndo, summarizeChanges } from '../public/admin/history/content-model.js';
import { formatEditorFile } from '../public/admin/lib/cms-format.js';

const CH4 = 'src/data/code/ch4.json';
const TREES = 'src/data/treeData.json';
const text = (path, value) => formatEditorFile(path, value);

const chapter = () => ({
  id: 'ch4',
  part: 'part1',
  title: 'Grants',
  icon: '4',
  summary: '<p>Summary</p>',
  sections: [
    { title: '1. General', legalText: '<p>One</p>', qas: [] },
    { title: '3. Educational Grants', legalText: '<p>Member Companies may provide Educational Grants.</p>', qas: [{ q: 'Q&A 31: Can a grant…?', a: '<p>Yes.</p>' }] },
  ],
});

const trees = () => ({
  trees: [{
    id: 'dt-x',
    title: 'Tree X',
    relatedChapter: ['ch1'],
    relatedSection: [],
    category: 'events',
    description: 'D',
    cvsCheck: null,
    nodes: [
      { type: 'question', id: 'start', text: 'Q?', helpText: '', options: [{ label: 'Yes', next: 'r' }] },
      { type: 'result', id: 'r', text: 'OK', outcome: 'compliant', reference: '', cvsCheck: '' },
    ],
  }],
});

test('a chapter’s fields are named as editors know them', () => {
  const fields = fieldsOf(CH4, chapter());
  assert.equal(fields.get('sections.1.legalText').group, '3. Educational Grants');
  assert.equal(fields.get('sections.1.legalText').label, 'Text');
  assert.equal(fields.get('sections.1.qas.0.a').label, 'Q&A 31 · Answer');
  assert.equal(fields.get('sections.1.qas.0.a').kind, 'html');
  const glossary = fieldsOf('src/data/code/glossary.json', { id: 'glossary', part: 'part3', sections: [{ title: 'Guest', legalText: '<p><strong>Guest:</strong> …</p>', qas: [] }] });
  assert.equal(glossary.get('sections.0.title').label, 'Term');
  assert.equal(glossary.get('sections.0.legalText').label, 'Definition');
});

test('compareContent lists changed, added and removed fields; trees by tree and step ID', () => {
  const before = chapter();
  const after = chapter();
  after.sections[1].legalText = '<p>Member Companies shall provide Educational Grants.</p>';
  const { changes } = compareContent(CH4, text(CH4, before), text(CH4, after));
  assert.deepEqual(changes.map((c) => [c.key, c.status]), [['sections.1.legalText', 'changed']]);

  const t1 = trees();
  const t2 = trees();
  t2.trees[0].nodes.unshift({ type: 'result', id: 'new', text: 'New', outcome: 'conditional', reference: '', cvsCheck: '' });
  t2.trees[0].nodes[2].text = 'Fine';
  const treeChanges = compareContent(TREES, text(TREES, t1), text(TREES, t2)).changes;
  assert.ok(treeChanges.some((c) => c.key === 'tree:dt-x/step:new/text' && c.status === 'added'));
  assert.ok(treeChanges.some((c) => c.key === 'tree:dt-x/step:r/text' && c.status === 'changed' && c.group === 'Tree “Tree X” › Result “r”'));
  assert.ok(!treeChanges.some((c) => c.key.startsWith('tree:dt-x/step:start')), 'a step that moved is not a change');

  const reordered = trees();
  reordered.trees[0].nodes.reverse();
  assert.deepEqual(compareContent(TREES, text(TREES, t1), text(TREES, reordered)), { changes: [], layoutOnly: true });
  // The layout cleanup of October 2026 (empty fields spelled out, IDs as lists) changes nothing editors see.
  const sparse = { trees: [{ id: 'dt-x', title: 'Tree X', relatedChapter: 'ch1', relatedSection: null, category: 'events', description: 'D', nodes: [{ id: 'start', type: 'question', text: 'Q?', options: [{ label: 'Yes', next: 'r' }] }, { id: 'r', type: 'result', outcome: 'compliant', text: 'OK' }] }] };
  assert.deepEqual(compareContent(TREES, JSON.stringify(sparse), text(TREES, t1)), { changes: [], layoutOnly: true });
  assert.equal(compareContent(CH4, '{ broken', text(CH4, before)), null);
});

test('planUndo puts back only what the save changed and keeps later edits elsewhere', () => {
  const parent = chapter();
  const saved = chapter();
  saved.sections[1].legalText = '<p>Member Companies shall provide Educational Grants.</p>';
  const head = structuredClone(saved);
  head.title = 'Grants and Charitable Donations'; // a later save changed another field
  const plan = planUndo(CH4, { parentText: text(CH4, parent), saveText: text(CH4, saved), headText: text(CH4, head) });
  assert.deepEqual(plan.ready.map((c) => c.key), ['sections.1.legalText']);
  assert.deepEqual(plan.conflicts, []);
  const result = JSON.parse(plan.text);
  assert.equal(result.sections[1].legalText, parent.sections[1].legalText, 'the save’s change is undone');
  assert.equal(result.title, 'Grants and Charitable Donations', 'the later change is kept');
  assert.equal(plan.text, text(CH4, result), 'written in the editor’s layout');
  // Only the undone line differs from the current file.
  const lines = (s) => s.split('\n');
  assert.equal(lines(plan.text).filter((line, i) => line !== lines(text(CH4, head))[i]).length, 1);
});

test('planUndo refuses when a field was changed again later, and knows when it is already undone', () => {
  const parent = chapter();
  const saved = chapter();
  saved.sections[1].legalText = '<p>A</p>';
  const later = structuredClone(saved);
  later.sections[1].legalText = '<p>B</p>';
  const blocked = planUndo(CH4, { parentText: text(CH4, parent), saveText: text(CH4, saved), headText: text(CH4, later) });
  assert.deepEqual(blocked.conflicts.map((c) => c.key), ['sections.1.legalText']);
  assert.equal(blocked.text, null);
  const done = planUndo(CH4, { parentText: text(CH4, parent), saveText: text(CH4, saved), headText: text(CH4, parent) });
  assert.deepEqual(done.done.map((c) => c.key), ['sections.1.legalText']);
  assert.equal(done.text, null);
});

test('planUndo of one change leaves the save’s other changes in place', () => {
  const parent = chapter();
  const saved = chapter();
  saved.title = 'New title';
  saved.sections[1].qas[0].a = '<p>No.</p>';
  const plan = planUndo(CH4, { parentText: text(CH4, parent), saveText: text(CH4, saved), headText: text(CH4, saved) }, ['sections.1.qas.0.a']);
  const result = JSON.parse(plan.text);
  assert.equal(result.sections[1].qas[0].a, '<p>Yes.</p>');
  assert.equal(result.title, 'New title');
});

test('planUndo of a save that added a tree step cannot be done field by field', () => {
  const parent = trees();
  const saved = trees();
  saved.trees[0].nodes.push({ type: 'result', id: 'extra', text: 'E', outcome: 'conditional', reference: '', cvsCheck: '' });
  const plan = planUndo(TREES, { parentText: text(TREES, parent), saveText: text(TREES, saved), headText: text(TREES, saved) });
  assert.ok(plan.structural.length > 0, 'the added step is a structural change');
  assert.deepEqual(plan.conflicts, []);
  assert.equal(plan.text, null);
  // A tree text edit can be: the outcome is put back as stored, not as its label.
  const edited = trees();
  edited.trees[0].nodes[1].outcome = 'conditional';
  const undo = planUndo(TREES, { parentText: text(TREES, parent), saveText: text(TREES, edited), headText: text(TREES, edited) });
  assert.equal(JSON.parse(undo.text).trees[0].nodes[1].outcome, 'compliant');
});

test('Version History updates are matched by title, so a new one at the top is one addition', () => {
  const PATH = 'src/data/code/changelog.json';
  const page = (sections) => ({ id: 'changelog', part: 'website', title: 'Version History', icon: 'Info', summary: '<p>S</p>', sections });
  const before = page([{ title: 'Update 1', legalText: '<p>Current</p>', qas: [] }]);
  const after = page([{ title: 'Update 2', legalText: '<p>Current</p>', qas: [] }, { title: 'Update 1', legalText: '<p>First</p>', qas: [] }]);
  const { changes } = compareContent(PATH, text(PATH, before), text(PATH, after));
  assert.deepEqual(changes.map((c) => [c.group, c.label, c.status]), [['Update 2', 'Text', 'added'], ['Update 1', 'Text', 'changed']]);
  // Undoing the badge move on Update 1 writes to Update 1, now second in the list.
  const plan = planUndo(PATH, { parentText: text(PATH, before), saveText: text(PATH, after), headText: text(PATH, after) }, ['update:Update 1.legalText']);
  assert.equal(JSON.parse(plan.text).sections[1].legalText, '<p>Current</p>');
});

test('summaries say what was added, changed and removed, naming a new update or step once', () => {
  const PATH = 'src/data/code/changelog.json';
  const page = (sections) => ({ id: 'changelog', part: 'website', title: 'Version History', icon: 'Info', summary: '<p>S</p>', sections });
  const before = page([{ title: 'Update 1', legalText: '<p>Current</p>', qas: [] }]);
  const after = page([{ title: 'Update 2', legalText: '<p>Current</p>', qas: [] }, { title: 'Update 1', legalText: '<p>First</p>', qas: [] }]);
  assert.equal(summarizeChanges(compareContent(PATH, text(PATH, before), text(PATH, after)).changes), 'Added: Update 2. Changed: Update 1 › Text.');
  assert.equal(summarizeChanges(compareContent(PATH, text(PATH, after), text(PATH, before)).changes), 'Changed: Update 1 › Text. Removed: Update 2.');

  // A new step is named once; a new answer to an existing question is named field by field.
  const t1 = trees();
  const t2 = trees();
  t2.trees[0].nodes.push({ type: 'result', id: 'extra', text: 'E', outcome: 'conditional', reference: '', cvsCheck: '' });
  t2.trees[0].nodes[0].options.push({ label: 'No', next: 'extra' });
  assert.equal(
    summarizeChanges(compareContent(TREES, text(TREES, t1), text(TREES, t2)).changes),
    'Added: Tree “Tree X” › Question “start” › Answer 2; Tree “Tree X” › Question “start” › Answer 2 · leads to; Tree “Tree X” › Result “extra”.',
  );

  // Chapter-level fields go by their own names, and long lists are cut short.
  const c2 = chapter();
  c2.title = 'Grants (revised)';
  assert.equal(summarizeChanges(compareContent(CH4, text(CH4, chapter()), text(CH4, c2)).changes), 'Changed: Chapter title.');
  const many = Array.from({ length: 6 }, (_, i) => ({ status: 'changed', group: `S${i}`, label: 'Text', wholeGroup: false }));
  assert.equal(summarizeChanges(many), 'Changed: S0 › Text; S1 › Text; S2 › Text; S3 › Text; and 2 more.');
});
