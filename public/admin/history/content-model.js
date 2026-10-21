/**
 * Content history in editors' terms: a content file seen as named fields ("3. Educational
 * Grants › Q&A 31 › Answer") rather than lines of JSON, so changes can be shown, and undone, one
 * field at a time. Tested by tests/contentModel.test.mjs.
 *
 * A field's key is the same in every version of the file: chapters are keyed by position (the
 * editor cannot add, remove or reorder their sections and Q&As), Version History updates by title
 * (new ones are added at the top) and decision trees by tree and step ID (steps can be added and
 * reordered).
 */
import { CHAPTER_PATH, formatEditorFile, TREES_PATH } from '../lib/cms-format.js';
import { OUTCOME_LABELS } from '../lib/trees.js';

const qaNumber = (q, index) => String(q ?? '').match(/^\s*(?:<[^>]+>\s*)*Q&(?:amp;)?A\s+\d+/)?.[0]?.replace(/<[^>]+>/g, '').trim() ?? `Q&A ${index + 1}`;

/**
 * Values as editors see them: an absent field, an empty text and an empty list all show as
 * empty, and a single ID is the same as a one-item list.
 */
function shown(value, kind) {
  if (kind === 'list') return Array.isArray(value) ? value : value == null || value === '' ? [] : [value];
  return value ?? '';
}

const sameValue = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/**
 * The fields of a parsed content file: a Map of key → { key, path, group, label, kind, value }.
 * `path` locates the value in this version's JSON; `kind` is 'html' (shown as text, its HTML on
 * request), 'text', 'list' (of texts) or 'value'.
 */
export function fieldsOf(path, data) {
  const fields = new Map();
  const add = (key, at, group, label, kind, value) => fields.set(key, { key, path: at, group, label, kind, value: shown(value, kind) });
  if (CHAPTER_PATH.test(path)) {
    const glossary = data.id === 'glossary';
    const website = data.part === 'website';
    const chapterGroup = website ? 'Page' : 'Chapter';
    add('title', ['title'], chapterGroup, website ? 'Title' : 'Chapter title', 'text', data.title);
    add('summary', ['summary'], chapterGroup, website ? 'Introduction' : 'Chapter summary', 'html', data.summary);
    for (const key of ['id', 'part', 'icon']) add(key, [key], chapterGroup, `Technical setting “${key}”`, 'value', data[key]);
    const titles = (data.sections ?? []).map((section) => section.title);
    const byTitle = website && titles.every((title, i) => title && titles.indexOf(title) === i);
    (data.sections ?? []).forEach((section, i) => {
      const group = section.title || `Section ${i + 1} (untitled)`;
      const base = byTitle ? `update:${section.title}` : `sections.${i}`;
      if (!byTitle) add(`${base}.title`, ['sections', i, 'title'], group, glossary ? 'Term' : 'Section title', 'text', section.title);
      add(`${base}.legalText`, ['sections', i, 'legalText'], group, glossary ? 'Definition' : 'Text', 'html', section.legalText);
      (section.qas ?? []).forEach((qa, k) => {
        const number = qaNumber(qa.q, k);
        add(`${base}.qas.${k}.q`, ['sections', i, 'qas', k, 'q'], group, `${number} · Question`, 'text', qa.q);
        add(`${base}.qas.${k}.a`, ['sections', i, 'qas', k, 'a'], group, `${number} · Answer`, 'html', qa.a);
      });
    });
    return fields;
  }
  if (path === TREES_PATH) {
    (data.trees ?? []).forEach((tree, t) => {
      const base = `tree:${tree.id}`;
      const group = `Tree “${tree.title || tree.id}”`;
      const at = (...rest) => ['trees', t, ...rest];
      add(`${base}/id`, at('id'), group, 'Tree ID', 'text', tree.id);
      add(`${base}/title`, at('title'), group, 'Title', 'text', tree.title);
      add(`${base}/relatedChapter`, at('relatedChapter'), group, 'Related chapters', 'list', tree.relatedChapter);
      add(`${base}/relatedSection`, at('relatedSection'), group, 'Related sections', 'list', tree.relatedSection);
      add(`${base}/category`, at('category'), group, 'Category', 'text', tree.category);
      add(`${base}/description`, at('description'), group, 'Description', 'text', tree.description);
      if (tree.cvsCheck) {
        add(`${base}/cvsCheck.title`, at('cvsCheck', 'title'), group, 'Live CVS check · Heading', 'text', tree.cvsCheck.title);
        for (const mode of ['required', 'national']) {
          const texts = tree.cvsCheck[mode];
          if (!texts) continue;
          const name = mode === 'required' ? 'Positive decision required' : 'National Event';
          for (const field of ['intro', 'otherStatus', 'noMatch']) {
            add(`${base}/cvsCheck.${mode}.${field}`, at('cvsCheck', mode, field), group, `Live CVS check · ${name} · ${{ intro: 'Introduction', otherStatus: 'Any other status', noMatch: 'Event not found' }[field]}`, 'text', texts[field]);
          }
          (texts.statuses ?? []).forEach((status, k) => {
            const label = `Live CVS check · ${name} · Status text ${k + 1}`;
            add(`${base}/cvsCheck.${mode}.statuses.${k}.labels`, at('cvsCheck', mode, 'statuses', k, 'labels'), group, `${label} · CVS statuses`, 'list', status.labels);
            add(`${base}/cvsCheck.${mode}.statuses.${k}.tone`, at('cvsCheck', mode, 'statuses', k, 'tone'), group, `${label} · Colour`, 'text', status.tone);
            add(`${base}/cvsCheck.${mode}.statuses.${k}.text`, at('cvsCheck', mode, 'statuses', k, 'text'), group, `${label} · Text`, 'text', status.text);
          });
        }
      }
      (tree.nodes ?? []).forEach((node, n) => {
        const stepKey = `${base}/step:${node.id}`;
        const stepGroup = `${group} › ${node.type === 'result' ? 'Result' : 'Question'} “${node.id}”`;
        const nodeAt = (...rest) => at('nodes', n, ...rest);
        add(`${stepKey}/type`, nodeAt('type'), stepGroup, 'Type', 'text', node.type);
        add(`${stepKey}/text`, nodeAt('text'), stepGroup, node.type === 'result' ? 'Answer' : 'Question', 'text', node.text);
        if (node.type === 'question') {
          add(`${stepKey}/helpText`, nodeAt('helpText'), stepGroup, 'Help text', 'text', node.helpText);
          (node.options ?? []).forEach((option, o) => {
            add(`${stepKey}/options.${o}.label`, nodeAt('options', o, 'label'), stepGroup, `Answer ${o + 1}`, 'text', option.label);
            add(`${stepKey}/options.${o}.next`, nodeAt('options', o, 'next'), stepGroup, `Answer ${o + 1} · leads to`, 'text', option.next);
          });
        } else {
          add(`${stepKey}/outcome`, nodeAt('outcome'), stepGroup, 'Outcome', 'text', OUTCOME_LABELS[node.outcome] ? `${OUTCOME_LABELS[node.outcome]} (${node.outcome})` : node.outcome);
          add(`${stepKey}/reference`, nodeAt('reference'), stepGroup, 'Code reference', 'text', node.reference);
          add(`${stepKey}/cvsCheck`, nodeAt('cvsCheck'), stepGroup, 'Live CVS check', 'text', node.cvsCheck);
        }
      });
    });
    return fields;
  }
  return fields;
}

/** The value at `path` in raw JSON (the outcome field shows a label, so read the stored value). */
const valueAt = (data, path) => path.reduce((value, key) => value?.[key], data);

function parse(text) {
  if (text == null) return null;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/**
 * The field-by-field difference between two versions of a content file:
 * { changes: [{ key, group, label, kind, status: 'changed' | 'added' | 'removed', before, after }],
 *   layoutOnly } — `layoutOnly` is true when the files differ but no field does: only the file's
 *   layout (or, for the decision trees, the order of trees or steps) changed.
 * Returns null when either version is not a content file that can be read (compare lines then).
 */
export function compareContent(path, beforeText, afterText) {
  const before = parse(beforeText);
  const after = parse(afterText);
  if (before === undefined || after === undefined || (!CHAPTER_PATH.test(path) && path !== TREES_PATH)) return null;
  const a = before ? fieldsOf(path, before) : new Map();
  const b = after ? fieldsOf(path, after) : new Map();
  const changes = [];
  for (const [key, field] of b) {
    const old = a.get(key);
    if (!old) changes.push({ ...field, status: 'added', before: undefined, after: field.value });
    else if (!sameValue(old.value, field.value)) changes.push({ ...field, status: 'changed', before: old.value, after: field.value });
  }
  for (const [key, field] of a) if (!b.has(key)) changes.push({ ...field, status: 'removed', before: field.value, after: undefined });
  return { changes, layoutOnly: changes.length === 0 && beforeText !== afterText };
}

/**
 * Plans an undo of the fields a save changed, keeping everything changed since in other fields.
 * `keys` limits it to some of those fields ("undo just this change").
 * Returns { changes, ready, done, conflicts, structural, text }:
 * - ready: changes that can be undone (the field is still as the save left it);
 * - done: changes already undone (the field is back as it was before the save);
 * - conflicts: changes to fields edited again later, which cannot be undone here without losing
 *   that later work;
 * - structural: fields the save added or removed (a new update, a tree step): undone only by
 *   putting the whole file back, which the page offers when nothing changed since;
 * - text: the file with the ready changes undone, or null when there is nothing to do, or a
 *   conflict or a structural change stops a field-by-field undo.
 */
export function planUndo(path, { parentText, saveText, headText }, keys = null) {
  const parent = parse(parentText);
  const saved = parse(saveText);
  const head = parse(headText);
  if (!parent || !saved || !head) return null;
  const comparison = compareContent(path, parentText, saveText);
  if (!comparison) return null;
  const P = fieldsOf(path, parent);
  const H = fieldsOf(path, head);
  const changes = comparison.changes.filter((change) => !keys || keys.includes(change.key));
  const ready = [];
  const done = [];
  const conflicts = [];
  const structural = [];
  for (const change of changes) {
    const now = H.get(change.key);
    if (change.status !== 'changed') structural.push(change);
    else if (!now) conflicts.push(change);
    else if (sameValue(now.value, change.after)) ready.push(change);
    else if (sameValue(now.value, change.before)) done.push(change);
    else conflicts.push(change);
  }
  if (conflicts.length || structural.length || ready.length === 0) return { changes, ready, done, conflicts, structural, text: null };
  const next = structuredClone(head);
  for (const change of ready) {
    const target = H.get(change.key).path;
    const parentValue = valueAt(parent, P.get(change.key).path);
    const owner = valueAt(next, target.slice(0, -1));
    owner[target.at(-1)] = structuredClone(parentValue);
  }
  return { changes, ready, done, conflicts, structural, text: formatEditorFile(path, next) };
}
