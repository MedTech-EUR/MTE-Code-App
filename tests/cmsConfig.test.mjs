// The content editor's configuration (public/admin/config.yml) stays in step with the data, the
// layout the editor writes (public/admin/lib/cms-format.js) and what the app accepts.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

import YAML from 'yaml';

import { CODE_CHAPTER_IDS } from '../src/data/codeOrder.js';
import { CHAPTER_FILES, EDITOR_FIELD_ORDER } from '../public/admin/lib/cms-format.js';
import { OUTCOME_LABELS } from '../public/admin/lib/trees.js';
import { TREE_CVS_MODES, TREE_CVS_TONES } from '../src/utils/treeCvs.js';
import { ALLOWED_OUTCOMES } from '../scripts/validate-data.mjs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const config = YAML.parse(read('public/admin/config.yml'));
const collection = (name) => config.collections.find((c) => c.name === name);
const field = (fields, name) => fields.find((f) => f.name === name);
const names = (fields) => fields.map((f) => f.name);
const optionValues = (f) => f.options.map((o) => (typeof o === 'string' ? o : o.value));

const CHAPTER_COLLECTIONS = { introductory: 'intro', part1: 'part1', part2: 'part2', part3: 'part3', website: 'website' };

test('the editor saves to the app’s repository through its sign-in Worker', () => {
  assert.equal(config.backend.name, 'github');
  assert.equal(config.backend.repo, 'MedTech-EUR/MTE-Code-App');
  assert.equal(config.backend.branch, 'main');
  assert.match(config.backend.base_url, /^https:\/\//);
  assert.doesNotMatch(config.backend.auth_endpoint, /^\//, 'Sveltia joins base_url and auth_endpoint with "/"');
  assert.deepEqual(config.output.json, { indent_style: 'space', indent_size: 2 });
  assert.equal(config.output.omit_empty_optional_fields, undefined, 'chapters keep their empty Q&A lists');
});

test('every Code chapter is listed once, in the Code’s order, under its part', () => {
  const listed = Object.keys(CHAPTER_COLLECTIONS).flatMap((name) => collection(name).files.map((file) => ({ ...file, collection: name })));
  assert.deepEqual(listed.map((file) => file.name), [...CODE_CHAPTER_IDS]);
  assert.deepEqual([...CHAPTER_FILES], [...CODE_CHAPTER_IDS]);
  for (const file of listed) {
    assert.equal(file.file, `src/data/code/${file.name}.json`);
    assert.ok(existsSync(new URL(`../${file.file}`, import.meta.url)), file.file);
    const chapter = JSON.parse(read(file.file));
    assert.equal(chapter.part, CHAPTER_COLLECTIONS[file.collection], `${file.name} is listed under its part`);
  }
});

test('chapter fields are in the order the editor writes them, HTML in the exact-HTML field', () => {
  const fieldSets = Object.keys(CHAPTER_COLLECTIONS).flatMap((name) => collection(name).files.map((file) => file.fields));
  for (const fields of new Set(fieldSets)) {
    assert.deepEqual(names(fields), EDITOR_FIELD_ORDER.chapter);
    assert.equal(field(fields, 'summary').widget, 'exact-html');
    const sections = field(fields, 'sections');
    assert.deepEqual(names(sections.fields), EDITOR_FIELD_ORDER.section);
    assert.equal(field(sections.fields, 'legalText').widget, 'exact-html');
    const qas = field(sections.fields, 'qas');
    assert.equal(qas.required, false, 'a section without Q&As can be saved');
    assert.deepEqual(names(qas.fields), EDITOR_FIELD_ORDER.qa);
  }
  // The Code's own chapters cannot gain, lose or reorder sections and Q&As (their links depend on
  // it), and a section without a title (the first one in Chapters 7, 8 and 10) can be saved.
  const chapterFields = collection('part1').files[0].fields;
  const sections = field(chapterFields, 'sections');
  assert.equal(field(sections.fields, 'title').required, false);
  assert.deepEqual([sections.allow_add, sections.allow_remove, sections.allow_reorder], [false, false, false]);
  const qas = field(sections.fields, 'qas');
  assert.deepEqual([qas.allow_add, qas.allow_remove, qas.allow_reorder], [false, false, false]);
});

test('decision tree fields are in the order the editor writes them', () => {
  const trees = field(collection('trees').files[0].fields, 'trees');
  assert.deepEqual(names(trees.fields), EDITOR_FIELD_ORDER.tree);
  const nodes = field(trees.fields, 'nodes');
  const type = (name) => nodes.types.find((t) => t.name === name);
  assert.deepEqual(['type', ...names(type('question').fields)], EDITOR_FIELD_ORDER.question);
  assert.deepEqual(['type', ...names(type('result').fields)], EDITOR_FIELD_ORDER.result);
  assert.deepEqual(names(field(type('question').fields, 'options').fields), EDITOR_FIELD_ORDER.option);
  const cvs = field(trees.fields, 'cvsCheck');
  const mode = field(cvs.fields, 'required');
  assert.deepEqual(names(mode.fields), EDITOR_FIELD_ORDER.cvsMode);
  assert.deepEqual(names(field(mode.fields, 'statuses').fields), EDITOR_FIELD_ORDER.cvsStatus);
});

test('the choices offered match what the app accepts', () => {
  const trees = field(collection('trees').files[0].fields, 'trees');
  assert.deepEqual(optionValues(field(trees.fields, 'relatedChapter')), CODE_CHAPTER_IDS.filter((id) => id !== 'changelog'));
  const result = field(trees.fields, 'nodes').types.find((t) => t.name === 'result');
  assert.deepEqual(new Set(optionValues(field(result.fields, 'outcome'))), ALLOWED_OUTCOMES);
  assert.deepEqual(new Set(Object.keys(OUTCOME_LABELS)), ALLOWED_OUTCOMES);
  assert.deepEqual(optionValues(field(result.fields, 'cvsCheck')), [...TREE_CVS_MODES]);
  const statuses = field(field(field(trees.fields, 'cvsCheck').fields, 'required').fields, 'statuses');
  assert.deepEqual(optionValues(field(statuses.fields, 'tone')), [...TREE_CVS_TONES]);
  // The categories the Decision Trees page lists (src/components/TreeLandingPage.jsx).
  const landing = read('src/components/TreeLandingPage.jsx');
  const block = landing.slice(landing.indexOf('const CATEGORY_CONFIG = {'), landing.indexOf('};', landing.indexOf('const CATEGORY_CONFIG = {')));
  const categories = [...block.matchAll(/^\s+([a-z]+):\s+\{/gm)].map((m) => m[1]);
  assert.deepEqual(optionValues(field(trees.fields, 'category')), categories);
});

test('the editor page registers the HTML field and the previews', () => {
  const script = read('public/admin/cms-fields.js');
  assert.match(script, /CMS\.registerWidget\('exact-html', HtmlField\)/);
  assert.match(script, /for \(const name of CHAPTER_FILES\) CMS\.registerPreviewTemplate\(name, ChapterPreview\)/);
  assert.match(script, /CMS\.registerPreviewTemplate\('treeData', TreesPreview\)/);
  assert.equal(collection('trees').files[0].name, 'treeData');
  for (const c of config.collections) assert.equal(c.editor?.preview, true, `${c.name} shows the preview`);
  const page = read('public/admin/index.html');
  assert.match(page, /window\.CMS_MANUAL_INIT = true/);
  assert.match(page, /@sveltia\/cms@\d+\.\d+\.\d+\/dist\/sveltia-cms\.js"\s+integrity="sha384-/, 'Sveltia is pinned to a version and its hash');
  // Manual start, then Sveltia, then the module that registers everything and starts it.
  const order = ['<script>window.CMS_MANUAL_INIT', 'src="https://unpkg.com/@sveltia/cms@', 'src="/admin/cms-fields.js"'].map((tag) => page.indexOf(tag));
  assert.ok(order.every((at, i) => at > 0 && (i === 0 || at > order[i - 1])), `script order ${order}`);
});
