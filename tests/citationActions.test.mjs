import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const fullTextSectionSource = await readFile(
  new URL('../src/components/FullTextSection.jsx', import.meta.url),
  'utf8',
);

test('uses one shared Cite/Link menu without a redundant Link button', () => {
  assert.match(fullTextSectionSource, /<span>Cite\/Link<\/span>/);
  assert.doesNotMatch(fullTextSectionSource, /\bcopyLink\b/);
  assert.doesNotMatch(fullTextSectionSource, />\s*Link\s*<\/button>/);

  assert.match(fullTextSectionSource, />Formal Citation<\/div>/);
  assert.match(fullTextSectionSource, />Markdown Link<\/div>/);
  assert.match(fullTextSectionSource, />Direct Link URL<\/div>/);
});

test('hides Code section actions only where they can be revealed by pointing or the keyboard', () => {
  // Hidden only on devices that can hover; shown on hover and on keyboard focus in the section.
  assert.match(fullTextSectionSource, /'transition-opacity [^']*\[@media\(hover:hover\)\]:opacity-0'/);
  assert.match(fullTextSectionSource, /group-hover\/section:opacity-100/);
  assert.match(fullTextSectionSource, /group-has-\[:focus-visible\]\/section:opacity-100/);
  // Code sections only, never while the Cite/Link menu is open, and a bookmark stays visible.
  assert.match(fullTextSectionSource, /bookmarkSection === 'code' && !citeMenuOpen \? ACTIONS_REVEAL_ON_HOVER : ''/);
  assert.match(fullTextSectionSource, /className=\{isBookmarked \? undefined : actionsReveal\}/);
});
