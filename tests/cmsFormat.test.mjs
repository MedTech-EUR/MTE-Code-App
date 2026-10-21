import assert from 'node:assert/strict';
import test from 'node:test';

import { canonicalChapter, canonicalTrees, formatEditorFile, isEditorFile, toJsonText, trimTexts } from '../public/admin/lib/cms-format.js';
import { findUnformatted } from '../scripts/format-cms-data.mjs';

test('the content editor files in the repository are in its layout', () => {
  assert.deepEqual(findUnformatted().map(({ path }) => path), []);
});

test('chapters keep every value and take the editor’s key order', () => {
  const chapter = { sections: [{ qas: [{ a: 'Answer', q: 'Q&A 1: Question?' }], legalText: '<p>Text</p>', title: '1. Title' }], icon: '4', title: 'Grants', part: 'part1', id: 'ch4', summary: '<p>S</p>' };
  const result = canonicalChapter(chapter);
  assert.deepEqual(result, chapter);
  assert.deepEqual(Object.keys(result), ['id', 'part', 'title', 'icon', 'summary', 'sections']);
  assert.deepEqual(Object.keys(result.sections[0]), ['title', 'legalText', 'qas']);
  assert.deepEqual(Object.keys(result.sections[0].qas[0]), ['q', 'a']);
});

test('trees spell out what the editor writes, in its order', () => {
  const data = {
    trees: [{
      id: 'dt-x',
      title: 'X',
      relatedChapter: 'ch1',
      relatedSection: null,
      category: 'events',
      description: 'D',
      nodes: [
        { id: 'start', type: 'question', text: 'Q?', options: [{ next: 'r', label: 'Yes' }] },
        { id: 'r', type: 'result', outcome: 'compliant', text: 'OK' },
      ],
    }],
  };
  const [tree] = canonicalTrees(data).trees;
  assert.deepEqual(Object.keys(tree), ['id', 'title', 'relatedChapter', 'relatedSection', 'category', 'description', 'cvsCheck', 'nodes']);
  assert.deepEqual(tree.relatedChapter, ['ch1']);
  assert.deepEqual(tree.relatedSection, []);
  assert.equal(tree.cvsCheck, null);
  assert.deepEqual(tree.nodes[0], { type: 'question', id: 'start', text: 'Q?', helpText: '', options: [{ label: 'Yes', next: 'r' }] });
  assert.deepEqual(Object.keys(tree.nodes[0].options[0]), ['label', 'next']);
  assert.deepEqual(tree.nodes[1], { type: 'result', id: 'r', text: 'OK', outcome: 'compliant', reference: '', cvsCheck: '' });
  assert.deepEqual(Object.keys(tree.nodes[1]), ['type', 'id', 'text', 'outcome', 'reference', 'cvsCheck']);
  // Formatting is stable: formatting the result again changes nothing.
  assert.equal(formatEditorFile('src/data/treeData.json', JSON.parse(formatEditorFile('src/data/treeData.json', data))), formatEditorFile('src/data/treeData.json', data));
});

test('CVS check texts get the editor’s empty fields', () => {
  const [tree] = canonicalTrees({ trees: [{ id: 'dt-x', cvsCheck: { national: { statuses: [{ text: 'T', labels: 'Compliant' }], intro: 'I', otherStatus: 'O' }, title: 'Check' }, nodes: [] }] }).trees;
  // A mode without texts is null, as the editor writes an optional group left empty.
  assert.deepEqual(Object.keys(tree.cvsCheck), ['title', 'required', 'national']);
  assert.equal(tree.cvsCheck.required, null);
  assert.deepEqual(tree.cvsCheck.national, { intro: 'I', statuses: [{ labels: ['Compliant'], tone: '', text: 'T' }], otherStatus: 'O', noMatch: '' });
});

test('only the files the editor writes are formatted', () => {
  assert.ok(isEditorFile('src/data/code/ch4.json'));
  assert.ok(isEditorFile('src/data/treeData.json'));
  assert.ok(!isEditorFile('src/data/quizData.json'));
  assert.equal(formatEditorFile('src/data/quizData.json', []), null);
  assert.equal(toJsonText({ a: 1 }), '{\n  "a": 1\n}\n');
});

test('texts lose their outer spaces, as the editor trims them before saving', () => {
  assert.deepEqual(trimTexts({ a: ' <p>x</p> ', b: [' y', 2, null, { c: 'z\n' }] }), { a: '<p>x</p>', b: ['y', 2, null, { c: 'z' }] });
  const text = formatEditorFile('src/data/code/x.json', { id: 'x', sections: [{ title: 'T', legalText: ' <div>Text</div>', qas: [] }] });
  assert.equal(JSON.parse(text).sections[0].legalText, '<div>Text</div>');
});
