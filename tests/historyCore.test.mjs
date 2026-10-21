// Content history logic (public/admin/history/history-core.js).
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  base64ToText,
  compareTexts,
  describePath,
  diffSequences,
  diffWords,
  formatDate,
  isContentPath,
  isUnchanged,
  restoreMessage,
  undoChangeMessage,
  undoMessage,
  undoSteps,
} from '../public/admin/history/history-core.js';

const rebuild = (ops) => ({
  a: ops.filter((o) => o.type !== 'insert').map((o) => o.value),
  b: ops.filter((o) => o.type !== 'delete').map((o) => o.value),
});

/** Length of the longest common subsequence, the reference for a shortest edit script. */
function lcsLength(a, b) {
  const row = new Array(b.length + 1).fill(0);
  for (const x of a) {
    let diagonal = 0;
    for (let j = 1; j <= b.length; j += 1) {
      const up = row[j];
      row[j] = x === b[j - 1] ? diagonal + 1 : Math.max(row[j], row[j - 1]);
      diagonal = up;
    }
  }
  return row[b.length];
}

let seed = 11;
const random = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);

test('diffSequences: rebuilds both sides and keeps the most in common', () => {
  for (let round = 0; round < 500; round += 1) {
    const pick = () => Array.from({ length: Math.floor(random() * 12) }, () => 'abcd'[Math.floor(random() * 4)]);
    const a = pick();
    const b = pick();
    const ops = diffSequences(a, b);
    assert.deepEqual(rebuild(ops), { a, b }, `${a} → ${b}`);
    assert.equal(ops.filter((o) => o.type === 'equal').length, lcsLength(a, b), `${a} → ${b}`);
  }
  assert.equal(diffSequences(Array.from({ length: 50 }, (_, i) => `a${i}`), Array.from({ length: 50 }, (_, i) => `b${i}`), 20), null);
});

test('diffWords: the deletions and insertions rebuild both texts, and changed phrases read as one', () => {
  const words = ['Member ', 'Companies ', 'may ', 'shall ', 'provide ', '<p>', '</p>', '<strong>', 'Grants', '.', ', ', '\n', 'the '];
  for (let round = 0; round < 300; round += 1) {
    const pick = () => Array.from({ length: Math.floor(random() * 10) }, () => words[Math.floor(random() * words.length)]).join('');
    const a = pick();
    const b = pick();
    const ops = diffWords(a, b);
    const before = ops.filter((o) => o.type !== 'insert').map((o) => o.value).join('');
    const after = ops.filter((o) => o.type !== 'delete').map((o) => o.value).join('');
    assert.deepEqual({ before, after }, { before: a, after: b });
  }
  const show = (a, b) => diffWords(a, b).map((o) => (o.type === 'equal' ? o.value : o.type === 'delete' ? `[-${o.value}-]` : `{+${o.value}+}`)).join('');
  assert.equal(show('Member Companies may provide', 'Member Companies shall provide'), 'Member Companies [-may -]{+shall +}provide');
  assert.equal(show('the old words here', 'the new phrase here'), 'the [-old words -]{+new phrase +}here');
  assert.equal(show('<p>Text</p>', '<p>Text</p> <strong>New.</strong>'), '<p>Text</p[->-]{+> <strong>New.</strong>+}');
  assert.deepEqual(diffWords('', ''), []);
});

test('compareTexts: groups changes and marks edited words', () => {
  const groups = compareTexts('a\nb\nc', 'a\nB\nc\nd');
  assert.ok(!isUnchanged(groups));
  assert.ok(isUnchanged(compareTexts('a\nb', 'a\nb')));
  const change = groups.find((g) => g.type === 'change');
  assert.deepEqual(change.removed, ['b']);
  assert.deepEqual(change.added, ['B']);
});

test('content paths and names', () => {
  assert.ok(isContentPath('src/data/code/ch4.json'));
  assert.ok(isContentPath('src/data/treeData.json'));
  assert.ok(!isContentPath('src/data/quizData.json'));
  assert.ok(!isContentPath('src/components/App.jsx'));
  assert.deepEqual(describePath('src/data/code/ch4.json'), { kind: 'Chapter', label: 'ch4', url: '/code/ch4' });
  assert.equal(describePath('src/data/treeData.json').label, 'All decision trees');
  const index = { 'src/data/code/ch4.json': { kind: 'Chapter', label: 'Chapter 4: Grants and Charitable Donations' } };
  assert.equal(describePath('src/data/code/ch4.json', index).label, 'Chapter 4: Grants and Charitable Donations');
});

test('undoSteps puts every content file of a save back as it was before', () => {
  const commit = {
    sha: 'c2',
    parents: [{ sha: 'c1' }],
    files: [
      { filename: 'src/data/code/ch4.json', status: 'modified' },
      { filename: 'src/data/treeData.json', status: 'modified' },
      { filename: 'src/App.jsx', status: 'modified' },
    ],
  };
  assert.deepEqual(undoSteps(commit), [
    { path: 'src/data/code/ch4.json', expectedRef: 'c2', from: { ref: 'c1', path: 'src/data/code/ch4.json' } },
    { path: 'src/data/treeData.json', expectedRef: 'c2', from: { ref: 'c1', path: 'src/data/treeData.json' } },
  ]);
  assert.deepEqual(undoSteps({ sha: 'root', parents: [], files: commit.files }), []);
});

test('text, dates and messages', () => {
  assert.equal(base64ToText(Buffer.from('Café “Code” – ok', 'utf8').toString('base64')), 'Café “Code” – ok');
  // Brussels time; ICU versions differ on the comma after the weekday.
  assert.match(formatDate('2026-10-20T12:05:00Z'), /^Tuesday,? 20 October 2026 at 14:05$/);
  const date = '2026-10-12T12:05:00Z';
  assert.equal(restoreMessage({ kind: 'Chapter', label: 'Chapter 4' }, date), 'Restore chapter “Chapter 4” to the version of 12 October 2026 at 14:05');
  assert.equal(undoMessage({ message: 'Update Part 1 “ch4”\n\nmore', date }), 'Undo “Update Part 1 “ch4”” (12 October 2026 at 14:05)');
  assert.equal(undoChangeMessage({ message: 'Update Part 1 “ch4”', date }, { label: '3. Educational Grants › Text' }), 'Undo the change to “3. Educational Grants › Text” from “Update Part 1 “ch4”” (12 October 2026 at 14:05)');
});
