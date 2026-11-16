import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CVS_CHECK_URL, SECTIONS, TREE_PAGE_TOOLS } from '../src/config/sections.js';
import { movedPageUrl } from '../moved-pages.js';
import { loadSplitCodeData } from '../scripts/lib/code-content.mjs';
import { loadTransparencyData } from '../scripts/lib/transparency-content.mjs';
import { createRouteUtils } from '../src/utils/routeUtils.js';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TREE_DATA = JSON.parse(readFileSync(resolve(projectRoot, 'src/data/treeData.json'), 'utf8')).trees;
const { parseAppLocation } = createRouteUtils(
  loadSplitCodeData(projectRoot).chapters,
  TREE_DATA,
  loadTransparencyData(projectRoot),
);

test('the CVS checker card opens the check on ethicalmedtech.eu, and its text is about CVS only', () => {
  const card = SECTIONS.find((section) => section.id === 'cvs-check');
  assert.ok(card?.available, 'the card is on the Home Hub');
  assert.equal(card.href, CVS_CHECK_URL);
  assert.equal(card.title, 'CVS checker');
  assert.ok(!/e4ethics/i.test(`${card.title} ${card.subtitle} ${card.description}`), 'this app is about the MedTech Europe Code, so the card does not mention e4ethics');
  assert.equal(new URL(CVS_CHECK_URL).origin, 'https://www.ethicalmedtech.eu');
  // Only this card leaves the app.
  assert.deepEqual(SECTIONS.filter((section) => section.href).map((section) => section.id), ['cvs-check']);
});

test('the check is no longer a decision tree here, and its old addresses lead to the new page', () => {
  assert.ok(!TREE_DATA.some((tree) => tree.id === 'dt-annex1-cvs-scope'));
  assert.equal(movedPageUrl({ pathname: '/trees/dt-annex1-cvs-scope', hash: '' }), CVS_CHECK_URL);
  assert.equal(movedPageUrl({ pathname: '/trees/dt-annex1-cvs-scope/', hash: '' }), CVS_CHECK_URL);
  assert.equal(movedPageUrl({ pathname: '/', hash: '#dt-annex1-cvs-scope' }), CVS_CHECK_URL);
  for (const tree of TREE_DATA) assert.equal(movedPageUrl({ pathname: `/trees/${tree.id}`, hash: '' }), null, tree.id);
  for (const location of [{ pathname: '/', hash: '' }, { pathname: '/trees', hash: '' }, { pathname: '/code/annex1', hash: '#dt-annex1-cvs-scope' }, {}]) {
    assert.equal(movedPageUrl(location), null);
  }
});

test('each tool listed with the decision trees opens its own section, in a category the trees use', () => {
  const categories = new Set(TREE_DATA.map((tree) => tree.category));
  for (const tool of TREE_PAGE_TOOLS) {
    assert.equal(parseAppLocation(`/${tool.id}`, '').activeSection, tool.id, tool.id);
    assert.ok(categories.has(tool.category), `${tool.id}: category ${tool.category}`);
    assert.ok(tool.title?.trim() && tool.description?.trim(), `${tool.id}: title and description`);
    assert.ok(!TREE_DATA.some((tree) => tree.id === tool.id), `${tool.id} is not also a tree id`);
  }
});
