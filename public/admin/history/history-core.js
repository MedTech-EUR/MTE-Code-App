/**
 * Content history: the parts that do not talk to GitHub or the page, so they can be tested with
 * `npm test` (tests/historyCore.test.mjs). The content editor's HTML field uses the comparison
 * too (its Changes tab).
 *
 * Vocabulary used on the page (for non-technical editors):
 * - a "save" is a Git commit (every save in the content editor is one);
 * - a "version" of an item is the item as it was after a save;
 * - "restore" and "undo" never rewrite history: they save the old content as a new change,
 *   which can itself be undone.
 */
import { isEditorFile, TREES_PATH, CHAPTER_PATH } from '../lib/cms-format.js';

/** The files editors manage: the Code chapters and the decision trees. */
export const isContentPath = (path) => typeof path === 'string' && isEditorFile(path);

/**
 * What a file is, in editors' terms: { kind, label, context?, url? }. `index` is the list built
 * with the app (/admin/history/items.json), which knows the current titles; a file not in it
 * gets a label from its path.
 */
export function describePath(path, index = {}) {
  if (index[path]) return index[path];
  if (path === TREES_PATH) return { kind: 'Decision trees', label: 'All decision trees', url: '/trees' };
  const chapter = path?.match(CHAPTER_PATH)?.[1];
  if (chapter) return { kind: 'Chapter', label: chapter, url: `/code/${chapter}` };
  return { kind: 'File', label: path };
}

/** First line of a commit message. */
export const firstLine = (message = '') => message.split('\n')[0].trim();

/** Bytes (base64, as GitHub sends them) to text. */
export function base64ToText(base64) {
  const binary = atob(base64.replace(/\s/g, ''));
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder('utf-8').decode(bytes);
}

/** "Tuesday, 20 October 2026 at 14:05", in Brussels time. */
export function formatDate(iso, { withWeekday = true } = {}) {
  return new Intl.DateTimeFormat('en-GB', {
    ...(withWeekday && { weekday: 'long' }),
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Brussels',
  }).format(new Date(iso));
}

// ---------------------------------------------------------------------------
// Comparing two versions
// ---------------------------------------------------------------------------

/**
 * Shortest edit script between two lists (Myers' algorithm), as
 * [{ type: 'equal' | 'delete' | 'insert', value }]. Returns null when the lists differ in more
 * than `maxEdits` places, where a detailed comparison would not help anyone.
 *
 * x walks through `a` (a step right deletes a[x]), y through `b` (a step down inserts b[y]);
 * k = x - y is the diagonal. `v[k]` is the furthest x reached on diagonal k.
 */
export function diffSequences(a, b, maxEdits = 1500) {
  const n = a.length;
  const m = b.length;
  const max = Math.min(n + m, maxEdits);
  const offset = max + 1;
  const v = new Int32Array(2 * max + 3);
  const trace = []; // trace[d] = v before round d, to walk back the path at the end
  for (let d = 0; d <= max; d += 1) {
    trace.push(v.slice());
    for (let k = -d; k <= d; k += 2) {
      const down = k === -d || (k !== d && v[offset + k - 1] < v[offset + k + 1]);
      let x = down ? v[offset + k + 1] : v[offset + k - 1] + 1;
      let y = x - k;
      while (x < n && y < m && a[x] === b[y]) {
        x += 1;
        y += 1;
      }
      v[offset + k] = x;
      if (x >= n && y >= m) return backtrack(trace, a, b, offset);
    }
  }
  return null;
}

function backtrack(trace, a, b, offset) {
  const ops = [];
  let x = a.length;
  let y = b.length;
  for (let d = trace.length - 1; d > 0; d -= 1) {
    const v = trace[d];
    const k = x - y;
    const down = k === -d || (k !== d && v[offset + k - 1] < v[offset + k + 1]);
    const prevK = down ? k + 1 : k - 1;
    const prevX = v[offset + prevK];
    const prevY = prevX - prevK;
    // The unchanged run that followed this edit.
    while (x > prevX && y > prevY) {
      x -= 1;
      y -= 1;
      ops.push({ type: 'equal', value: a[x] });
    }
    // The edit itself.
    if (down) ops.push({ type: 'insert', value: b[prevY] });
    else ops.push({ type: 'delete', value: a[prevX] });
    x = prevX;
    y = prevY;
  }
  // The unchanged run at the very start.
  while (x > 0 && y > 0) {
    x -= 1;
    y -= 1;
    ops.push({ type: 'equal', value: a[x] });
  }
  return ops.reverse();
}

/** Words, spaces and single punctuation marks (an HTML tag's "<", "/" and ">" each count). */
const tokens = (text) => text.match(/\s+|[\p{L}\p{N}]+|[^\s\p{L}\p{N}]/gu) ?? [];

/** The same, with the spaces after a word or mark kept with it (line breaks stay apart), for diffWords(). */
const wordTokens = (text) => text.match(/[\p{L}\p{N}]+[ \t]*|[^\s\p{L}\p{N}][ \t]*|\s+/gu) ?? [];

/**
 * Word-level differences between two texts: [{ type: 'equal' | 'delete' | 'insert', value }].
 * Neighbouring edits are joined, so a changed phrase reads as one deletion followed by one
 * insertion. Returns null if the texts are too different to compare word by word.
 */
export function diffWords(before, after, maxEdits = 2000) {
  const ops = diffSequences(wordTokens(before ?? ''), wordTokens(after ?? ''), maxEdits);
  if (!ops) return null;
  const result = [];
  let removed = '';
  let added = '';
  const flush = () => {
    if (removed) result.push({ type: 'delete', value: removed });
    if (added) result.push({ type: 'insert', value: added });
    removed = '';
    added = '';
  };
  for (const op of ops) {
    if (op.type === 'delete') removed += op.value;
    else if (op.type === 'insert') added += op.value;
    else {
      flush();
      if (result.at(-1)?.type === 'equal') result.at(-1).value += op.value;
      else result.push({ type: 'equal', value: op.value });
    }
  }
  flush();
  return joinShortMatches(result);
}

/**
 * A lone mark or space that happens to match between two edits (the ">" of one tag matched with
 * the ">" of another) splits one change into pieces; folding it into the edits on both sides
 * reads better: "<strong>New</strong>" added, rather than "<strong", ">" and "New</strong>".
 */
function joinShortMatches(ops) {
  const edits = [];
  for (const op of ops) {
    const last = edits.at(-1);
    if (op.type === 'equal') edits.push({ equal: op.value });
    else if (last && !('equal' in last)) last[op.type] = (last[op.type] ?? '') + op.value;
    else edits.push({ [op.type]: op.value });
  }
  for (let i = 1; i < edits.length - 1; i += 1) {
    const [before, match, after] = [edits[i - 1], edits[i], edits[i + 1]];
    if ('equal' in before || !('equal' in match) || 'equal' in after) continue;
    if (!/^[^\p{L}\p{N}]{1,2}$/u.test(match.equal)) continue;
    const join = (key) => (before[key] ?? '') + match.equal + (after[key] ?? '');
    edits.splice(i - 1, 3, { delete: join('delete'), insert: join('insert') });
    i -= 1;
  }
  return edits.flatMap((edit) => ('equal' in edit
    ? [{ type: 'equal', value: edit.equal }]
    : [edit.delete && { type: 'delete', value: edit.delete }, edit.insert && { type: 'insert', value: edit.insert }].filter(Boolean)));
}

/**
 * Line changes between two texts, grouped for display:
 * [{ type: 'same', lines }, { type: 'change', removed: [...], added: [...], pairs }]
 * In a change, `pairs` holds word-level differences for lines that were edited (one removed
 * line matched with one added line), so small edits are easy to spot. Returns null if the
 * texts are too different to compare in detail.
 */
export function compareTexts(before, after) {
  const a = (before ?? '').split('\n');
  const b = (after ?? '').split('\n');
  const ops = diffSequences(a, b);
  if (!ops) return null;
  const groups = [];
  for (const op of ops) {
    const last = groups.at(-1);
    if (op.type === 'equal') {
      if (last?.type === 'same') last.lines.push(op.value);
      else groups.push({ type: 'same', lines: [op.value] });
    } else {
      const change = last?.type === 'change' ? last : (groups.push({ type: 'change', removed: [], added: [] }), groups.at(-1));
      (op.type === 'delete' ? change.removed : change.added).push(op.value);
    }
  }
  for (const group of groups.filter((g) => g.type === 'change')) {
    group.pairs = group.removed.slice(0, group.added.length).map((removed, i) => {
      const words = diffSequences(tokens(removed), tokens(group.added[i]), 400);
      return words && { removed, added: group.added[i], words };
    });
  }
  return groups;
}

/** True if a comparison found no difference. */
export const isUnchanged = (groups) => Array.isArray(groups) && groups.every((g) => g.type === 'same');

// ---------------------------------------------------------------------------
// Planning a restore or an undo of whole files
// ---------------------------------------------------------------------------

/**
 * A step puts one file in a given state:
 *   { path, expectedSha | expectedRef, from } or { path, expectedSha, text }
 * - What the file must still be for the step to go ahead, so that a change someone else saved
 *   in the meantime is never overwritten: expectedSha, its Git blob ID as the editor saw it
 *   (null: it did not exist), or expectedRef, "as it was after this save" (a commit SHA).
 * - from: { ref, path } to copy that version of the file, null to remove the file, or
 * - text: the file's new content (an undo or restore of single fields, see content-model.js).
 */

/**
 * Steps that undo a save by putting every content file it touched back as it was before.
 * `commit` is GitHub's commit with its file list (GET /commits/:sha).
 */
export function undoSteps(commit) {
  const parent = commit.parents?.[0]?.sha;
  if (!parent) return [];
  const steps = [];
  for (const file of commit.files ?? []) {
    const touchesContent = isContentPath(file.filename) || isContentPath(file.previous_filename);
    if (!touchesContent) continue;
    if (file.status === 'added' || file.status === 'copied') {
      steps.push({ path: file.filename, expectedRef: commit.sha, from: null });
    } else if (file.status === 'removed') {
      steps.push({ path: file.filename, expectedRef: commit.sha, from: { ref: parent, path: file.filename } });
    } else if (file.status === 'renamed') {
      steps.push(
        { path: file.filename, expectedRef: commit.sha, from: null },
        { path: file.previous_filename, expectedRef: commit.sha, from: { ref: parent, path: file.previous_filename } },
      );
    } else {
      steps.push({ path: file.filename, expectedRef: commit.sha, from: { ref: parent, path: file.filename } });
    }
  }
  return steps;
}

/** Commit message for a restore of a whole item, in the style of the editor's own messages. */
export function restoreMessage(item, versionDate) {
  return `Restore ${item.kind.toLowerCase()} “${item.label}” to the version of ${formatDate(versionDate, { withWeekday: false })}`;
}

/** Commit message for an undo of a save. */
export function undoMessage(save) {
  return `Undo “${firstLine(save.message)}” (${formatDate(save.date, { withWeekday: false })})`;
}

/** Commit message for an undo of one change within a save. */
export function undoChangeMessage(save, change) {
  return `Undo the change to “${change.label}” from “${firstLine(save.message)}” (${formatDate(save.date, { withWeekday: false })})`;
}
