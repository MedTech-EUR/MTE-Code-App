import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CVS_CHECK_TREE_ID, SECTIONS, TREE_PAGE_TOOLS } from '../src/config/sections.js';
import { loadSplitCodeData } from '../scripts/lib/code-content.mjs';
import { loadTransparencyData } from '../scripts/lib/transparency-content.mjs';
import { buildTreePath, createRouteUtils } from '../src/utils/routeUtils.js';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TREE_DATA = JSON.parse(readFileSync(resolve(projectRoot, 'src/data/treeData.json'), 'utf8')).trees;
const { parseAppLocation } = createRouteUtils(
  loadSplitCodeData(projectRoot).chapters,
  TREE_DATA,
  loadTransparencyData(projectRoot),
);

test('the Conference Vetting System check card opens its decision tree', () => {
  const card = SECTIONS.find((section) => section.id === 'cvs-check');
  assert.ok(card?.available, 'the card is on the Home Hub');
  const tree = TREE_DATA.find((item) => item.id === CVS_CHECK_TREE_ID);
  assert.ok(tree, `${CVS_CHECK_TREE_ID} is a decision tree`);
  assert.equal(card.title, tree.title, 'the card and the tree have the same name');
  const route = parseAppLocation(buildTreePath(CVS_CHECK_TREE_ID), '');
  assert.equal(route.activeSection, 'trees');
  assert.equal(route.activeId, CVS_CHECK_TREE_ID);
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
