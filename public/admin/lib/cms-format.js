/**
 * The JSON layout the content editor (Sveltia CMS, public/admin/config.yml) writes, so files kept
 * in that layout change only where they were edited. `npm run format:data` applies it and
 * `npm run validate:data` checks it. Runs in Node and in the browser (Content history).
 *
 * - Every file: 2-space indentation and a final newline, as JSON.stringify(value, null, 2), and
 *   no spaces at the start or end of any text: the editor trims every text before it saves.
 * - Code chapters (src/data/code/*.json): keys in the order the editor lists the fields.
 * - Decision trees (src/data/treeData.json): keys in the editor's field order, the related
 *   chapters and sections always as lists, and optional fields present even when empty ("" for
 *   texts, null for the CVS check texts of a tree without them and for a CVS mode without
 *   texts), because the editor writes every field it shows.
 */

export const TREES_PATH = 'src/data/treeData.json';
export const CHAPTER_PATH = /^src\/data\/code\/([a-z0-9-]+)\.json$/;

/**
 * The chapter files the content editor lists, in the Code's order (src/data/codeOrder.js;
 * public/admin/config.yml lists the same files, which tests/cmsConfig.test.mjs checks).
 */
export const CHAPTER_FILES = Object.freeze([
  'scope', 'admin', 'intro',
  'ch1', 'ch2', 'ch3', 'ch4', 'ch5', 'ch6', 'ch7', 'ch8', 'ch9', 'ch10',
  'part2',
  'glossary', 'annex1', 'annex2', 'annex3', 'annex4', 'annex5', 'annex6', 'annex7',
  'changelog',
]);

/** True for the files the content editor writes. */
export const isEditorFile = (path) => path === TREES_PATH || CHAPTER_PATH.test(path);

/** JSON text in the editor's indentation. */
export const toJsonText = (value) => `${JSON.stringify(value, null, 2)}\n`;

/** Every text trimmed, as the editor does before saving (Sveltia CMS trims all text values). */
export function trimTexts(value) {
  if (typeof value === 'string') return value.trim();
  if (Array.isArray(value)) return value.map(trimTexts);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, trimTexts(item)]));
  return value;
}

const asList = (value) => {
  if (Array.isArray(value)) return value;
  return value == null || value === '' ? [] : [value];
};

/** Copies `source` with `keys` first, in that order; any other keys follow as they were. */
function ordered(source, keys, defaults = {}) {
  const result = {};
  for (const key of keys) {
    if (key in source) result[key] = source[key];
    else if (key in defaults) result[key] = defaults[key];
  }
  for (const [key, value] of Object.entries(source)) if (!(key in result)) result[key] = value;
  return result;
}

const CHAPTER_KEYS = ['id', 'part', 'title', 'icon', 'summary', 'sections'];
const SECTION_KEYS = ['title', 'legalText', 'qas'];
const QA_KEYS = ['q', 'a'];

/** A Code chapter in the editor's key order (its values are never changed). */
export function canonicalChapter(chapter) {
  return ordered(
    {
      ...chapter,
      sections: (chapter.sections ?? []).map((section) =>
        ordered({ ...section, qas: (section.qas ?? []).map((qa) => ordered(qa, QA_KEYS)) }, SECTION_KEYS),
      ),
    },
    CHAPTER_KEYS,
  );
}

const CVS_MODE_KEYS = ['intro', 'statuses', 'otherStatus', 'noMatch'];
const CVS_STATUS_KEYS = ['labels', 'tone', 'text'];

function canonicalCvsCheck(cvsCheck) {
  const result = ordered(cvsCheck, ['title', 'required', 'national'], { required: null, national: null });
  for (const mode of ['required', 'national']) {
    if (!result[mode]) continue;
    result[mode] = ordered(
      { ...result[mode], statuses: (result[mode].statuses ?? []).map((status) => ordered({ ...status, labels: asList(status.labels) }, CVS_STATUS_KEYS, { tone: '' })) },
      CVS_MODE_KEYS,
      { noMatch: '' },
    );
  }
  return result;
}

const TREE_KEYS = ['id', 'title', 'relatedChapter', 'relatedSection', 'category', 'description', 'cvsCheck', 'nodes'];
const QUESTION_KEYS = ['type', 'id', 'text', 'helpText', 'options'];
const RESULT_KEYS = ['type', 'id', 'text', 'outcome', 'reference', 'cvsCheck'];
const OPTION_KEYS = ['label', 'next'];

/** The editor's field order for each kind of object (config.yml lists the fields in this order). */
export const EDITOR_FIELD_ORDER = Object.freeze({
  chapter: CHAPTER_KEYS,
  section: SECTION_KEYS,
  qa: QA_KEYS,
  tree: TREE_KEYS,
  question: QUESTION_KEYS,
  result: RESULT_KEYS,
  option: OPTION_KEYS,
  cvsMode: CVS_MODE_KEYS,
  cvsStatus: CVS_STATUS_KEYS,
});

function canonicalNode(node) {
  if (node.type === 'question') {
    return ordered({ ...node, options: (node.options ?? []).map((option) => ordered(option, OPTION_KEYS)) }, QUESTION_KEYS, { helpText: '' });
  }
  if (node.type === 'result') return ordered(node, RESULT_KEYS, { reference: '', cvsCheck: '' });
  return node;
}

/** The decision trees file in the editor's layout (the same trees, nodes and texts). */
export function canonicalTrees(data) {
  return ordered(
    {
      ...data,
      trees: (data.trees ?? []).map((tree) => {
        const result = ordered(
          {
            ...tree,
            relatedChapter: asList(tree.relatedChapter),
            relatedSection: asList(tree.relatedSection),
            nodes: (tree.nodes ?? []).map(canonicalNode),
          },
          TREE_KEYS,
          { cvsCheck: null },
        );
        if (result.cvsCheck) result.cvsCheck = canonicalCvsCheck(result.cvsCheck);
        return result;
      }),
    },
    ['trees'],
  );
}

/** A content file's text in the editor's layout, or null for files the editor does not write. */
export function formatEditorFile(path, value) {
  if (path === TREES_PATH) return toJsonText(canonicalTrees(trimTexts(value)));
  if (CHAPTER_PATH.test(path)) return toJsonText(canonicalChapter(trimTexts(value)));
  return null;
}
