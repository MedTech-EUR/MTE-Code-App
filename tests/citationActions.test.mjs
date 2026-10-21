import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const fullTextSectionSource = await readFile(
  new URL('../src/components/FullTextSection.jsx', import.meta.url),
  'utf8',
);
const readerActionsSource = await readFile(
  new URL('../src/components/ReaderActions.jsx', import.meta.url),
  'utf8',
);

test('uses one shared Cite/Link menu without a redundant Link button', () => {
  assert.match(readerActionsSource, /<span>Cite\/Link<\/span>/);
  assert.doesNotMatch(readerActionsSource, /\bcopyLink\b/);
  assert.doesNotMatch(readerActionsSource, />\s*Link\s*<\/button>/);

  assert.match(readerActionsSource, />Formal Citation<\/div>/);
  assert.match(readerActionsSource, />Markdown Link<\/div>/);
  assert.match(readerActionsSource, />Direct Link URL<\/div>/);
});

test('sections and each of their Q&As share the same actions', () => {
  assert.equal(fullTextSectionSource.match(/<ReaderActions\b/g)?.length, 2);
  assert.doesNotMatch(fullTextSectionSource, /<span>Cite\/Link|>\s*Copy Text\s*<|☆ Bookmark/);
  // Each Q&A is cited, copied and bookmarked by its own anchor.
  assert.match(fullTextSectionSource, /copyCitation\(format, qaTitle, qa\.anchorId\)/);
  assert.match(fullTextSectionSource, /toggleBookmark\(qa\.anchorId, qaTitle\)/);
  assert.match(fullTextSectionSource, /isAnchorBookmarked\(qa\.anchorId\)/);
  assert.match(fullTextSectionSource, /<div key=\{qa\.anchorId\} id=\{qa\.anchorId\} className="group\/qa /);
});

test('hides Code section and Q&A actions only where they can be revealed by pointing or the keyboard', () => {
  // Hidden only on devices that can hover; shown on hover and on keyboard focus in the section or Q&A.
  assert.match(fullTextSectionSource, /'transition-opacity [^']*\[@media\(hover:hover\)\]:opacity-0'/);
  for (const group of ['section', 'qa']) {
    assert.match(fullTextSectionSource, new RegExp(`group-hover/${group}:opacity-100`));
    assert.match(fullTextSectionSource, new RegExp(`group-has-\\[:focus-visible\\]/${group}:opacity-100`));
  }
  // Code reader only.
  assert.match(fullTextSectionSource, /reveal=\{isCodeReader \? ACTIONS_REVEAL_ON_HOVER : ''\}/);
  assert.match(fullTextSectionSource, /reveal=\{isCodeReader \? QA_ACTIONS_REVEAL_ON_HOVER : ''\}/);
  // Never while the Cite/Link menu is open, and a bookmark stays visible.
  assert.match(readerActionsSource, /const actionsReveal = menuOpen \? '' : reveal;/);
  assert.match(readerActionsSource, /className=\{isBookmarked \? undefined : actionsReveal\}/);
});
