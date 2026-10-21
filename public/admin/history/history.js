/**
 * Content history (/admin/history/): see what changed in the Code app's content and undo it,
 * without Git. See docs/cms-guide.md, "Undoing a change".
 *
 * Views (the URL decides which one):
 * - /admin/history/                  recent saves, newest first, each with "Undo this save";
 * - /admin/history/?path=<file>      one item's versions, each with "Restore this version";
 * - /admin/history/?chapter=<id>     the same for a chapter, e.g. ?chapter=ch4.
 *
 * Changes are shown field by field ("3. Educational Grants › Text"), with the words that
 * changed marked. An undo puts back only the fields a save changed, so later edits to other parts
 * of the same chapter are kept.
 */
import {
  compareTexts,
  describePath,
  diffWords,
  firstLine,
  formatDate,
  isContentPath,
  isUnchanged,
  restoreMessage,
  undoChangeMessage,
  undoMessage,
  undoSteps,
} from './history-core.js';
import { compareContent, planUndo } from './content-model.js';
import { htmlToText } from '../lib/html-tools.js';
import { ConflictError, GitHubError, createGitHub, forgetToken, signIn, storedToken } from './github.js';

const main = document.getElementById('main');
const status = document.getElementById('status');
const userArea = document.getElementById('user');
const dialog = document.getElementById('confirm');

const state = {
  config: null, // { repo, branch, baseUrl, authEndpoint } from /admin/config.yml
  index: {}, // path -> { kind, label, context?, url? } from /admin/history/items.json
  items: [], // the same, as a list, for the finder
  gh: null,
  canWrite: false,
  feed: null, // recent saves already loaded: { saves, page, done }
};

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

/** Builds an element. Text is always set as text, never as HTML. */
function h(tag, props = {}, ...children) {
  const element = document.createElement(tag);
  for (const [key, value] of Object.entries(props ?? {})) {
    if (value == null || value === false) continue;
    if (key === 'class') element.className = value;
    else if (key.startsWith('on')) element.addEventListener(key.slice(2).toLowerCase(), value);
    else element.setAttribute(key, value === true ? '' : value);
  }
  for (const child of children.flat()) {
    if (child == null || child === false) continue;
    element.append(child instanceof Node ? child : String(child));
  }
  return element;
}

const hidden = (text) => h('span', { class: 'visually-hidden' }, text);

function say(message, tone = 'info') {
  status.textContent = message;
  status.dataset.tone = tone;
}

/** Runs `task` for every item, a few at a time (GitHub prefers that to a burst). */
async function mapLimit(items, limit, task) {
  const results = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await task(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/** Explains a failure in plain words. */
function explain(error) {
  if (error instanceof ConflictError) {
    return `Nothing was changed: “${describePath(error.path, state.index).label}” was saved by someone else in the meantime. Look at its latest version, then try again if needed.`;
  }
  if (error instanceof GitHubError && error.status === 401) return 'Your sign-in has expired. Please sign in again.';
  if (error instanceof GitHubError && (error.status === 403 || error.status === 404)) {
    return 'GitHub did not allow this. Your account may not have permission to change the app’s content. Ask the maintainer.';
  }
  if (error.message === 'popup-blocked') return 'Your browser blocked the sign-in window. Allow pop-ups for this site, then try again.';
  return `Something went wrong (${error.message}). Nothing was changed. Try again, or tell the maintainer.`;
}

function itemTitle(path) {
  const item = describePath(path, state.index);
  return item.context ? `${item.label} (${item.context})` : item.label;
}

// ---------------------------------------------------------------------------
// Start-up and sign-in
// ---------------------------------------------------------------------------

/** repo, branch and the sign-in Worker come from the editor's configuration, so they never drift apart. */
async function readConfig() {
  const text = await (await fetch('/admin/config.yml', { cache: 'no-store' })).text();
  const backend = text.split(/\n(?=\S)/).find((block) => block.startsWith('backend:')) ?? '';
  const value = (key) => backend.match(new RegExp(`^\\s+${key}:\\s*['"]?([^'"\\s#]+)`, 'm'))?.[1];
  return { repo: value('repo'), branch: value('branch') ?? 'main', baseUrl: value('base_url'), authEndpoint: value('auth_endpoint') ?? 'auth' };
}

async function boot() {
  try {
    state.config = await readConfig();
    const index = await fetch('/admin/history/items.json', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : { items: [] }));
    state.items = index.items;
    state.index = Object.fromEntries(index.items.map((item) => [item.path, item]));
  } catch (error) {
    say(explain(error), 'error');
    return;
  }
  const token = storedToken();
  if (token) await startSession(token);
  else showSignIn();
}

function showSignIn(message) {
  userArea.replaceChildren();
  const button = h('button', { class: 'button button--primary', type: 'button' }, 'Sign in with GitHub');
  button.addEventListener('click', async () => {
    button.disabled = true;
    say('Waiting for GitHub…');
    try {
      await startSession(await signIn(state.config.baseUrl, state.config.authEndpoint));
    } catch (error) {
      say(explain(error), 'error');
      button.disabled = false;
    }
  });
  main.replaceChildren(
    h('h1', { tabindex: '-1' }, 'Content history'),
    h('p', {}, 'See what changed in the Code App’s content and put back an earlier version.'),
    h('p', {}, 'Sign in with the same GitHub account you use for the content editor.'),
    button,
  );
  if (message) say(message, 'error');
}

async function startSession(token) {
  state.gh = createGitHub({ token, repo: state.config.repo, branch: state.config.branch });
  try {
    const [user, repository] = await Promise.all([state.gh.user(), state.gh.repository()]);
    state.canWrite = Boolean(repository.permissions?.push);
    const signOut = h('button', { class: 'link-button', type: 'button' }, 'Sign out');
    signOut.addEventListener('click', () => {
      forgetToken();
      state.feed = null;
      showSignIn();
    });
    userArea.replaceChildren(`Signed in as ${user.name || user.login} · `, signOut);
    say('');
    route();
  } catch (error) {
    forgetToken();
    showSignIn(explain(error));
  }
}

// ---------------------------------------------------------------------------
// Navigation inside the page
// ---------------------------------------------------------------------------

function currentPath() {
  const params = new URLSearchParams(location.search);
  if (params.get('path')) return params.get('path');
  if (params.get('chapter')) return `src/data/code/${params.get('chapter').replace(/[^a-z0-9-]/g, '')}.json`;
  return null;
}

function navLink(text, search, props = {}) {
  const link = h('a', { href: `/admin/history/${search}`, ...props }, text);
  link.addEventListener('click', (event) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    history.pushState(null, '', link.href);
    route();
  });
  return link;
}

const itemLink = (path, ...content) => navLink(content, `?path=${encodeURIComponent(path)}`);

function route(message) {
  say('');
  const path = currentPath();
  (path ? showItem(path) : showRecent()).then(() => {
    main.querySelector('h1')?.focus();
    if (message) say(message, 'success');
  });
}
window.addEventListener('popstate', () => state.gh && route());

// ---------------------------------------------------------------------------
// Comparing two versions
// ---------------------------------------------------------------------------

/** A file's text at a save, or null if it did not exist there (or there is no save). */
const readText = (path, ref) => (ref ? state.gh.getText(path, ref) : Promise.resolve(null));

const MARK = { removed: '−', added: '+', same: ' ' };
const SPOKEN = { removed: 'Removed: ', added: 'Added: ', same: '' };

/** Words that changed, marked in place: removed ones struck through, added ones underlined. */
function wordDiff(before, after) {
  const ops = diffWords(before ?? '', after ?? '');
  const box = h('div', { class: 'words' });
  if (!ops) {
    box.append(h('p', { class: 'note' }, 'The text changed too much to show word by word. Before:'), h('div', { class: 'words__block words__block--removed' }, before), h('p', { class: 'note' }, 'After:'), h('div', { class: 'words__block words__block--added' }, after));
    return box;
  }
  ops.forEach((op, i) => {
    if (op.type === 'equal') {
      // Long unchanged stretches are shortened to the lines next to the changes.
      const lines = op.value.split('\n');
      const keep = 2;
      const head = i === 0 ? [] : lines.slice(0, keep + 1);
      const tail = i === ops.length - 1 ? [] : lines.slice(-(keep + 1));
      if (head.length + tail.length >= lines.length) box.append(op.value);
      else box.append(head.join('\n'), h('span', { class: 'words__skip' }, `\n⋯ ${lines.length - head.length - tail.length} unchanged lines ⋯\n`), tail.join('\n'));
    } else if (op.type === 'delete') box.append(h('del', {}, hidden(' [removed: '), op.value, hidden('] ')));
    else box.append(h('ins', {}, hidden(' [added: '), op.value, hidden('] ')));
  });
  return box;
}

const asText = (value) => (Array.isArray(value) ? value.join(', ') : value == null ? '' : String(value));

/** One field's change: its name, then the words that changed (HTML fields as text, HTML on request). */
function renderChange(change, { onUndo } = {}) {
  const block = h('div', { class: `change change--${change.status}` });
  const verb = { changed: '', added: ' (added)', removed: ' (removed)' }[change.status];
  block.append(h('p', { class: 'change__label' }, change.label, verb));
  const before = asText(change.before);
  const after = asText(change.after);
  if (change.kind === 'html') {
    const textBefore = htmlToText(before);
    const textAfter = htmlToText(after);
    const onlyFormatting = textBefore === textAfter;
    const view = h('div', {}, onlyFormatting ? wordDiff(before, after) : wordDiff(textBefore, textAfter));
    if (onlyFormatting) block.append(h('p', { class: 'note' }, 'The words are the same; only the formatting changed (for example bold, links or line breaks). The HTML:'));
    block.append(view);
    if (!onlyFormatting) {
      let showingHtml = false;
      const toggle = h('button', { class: 'link-button', type: 'button', 'aria-pressed': 'false' }, 'Show the HTML');
      toggle.addEventListener('click', () => {
        showingHtml = !showingHtml;
        toggle.setAttribute('aria-pressed', String(showingHtml));
        toggle.textContent = showingHtml ? 'Show the text' : 'Show the HTML';
        view.replaceChildren(showingHtml ? wordDiff(before, after) : wordDiff(textBefore, textAfter));
        view.classList.toggle('words--html', showingHtml);
      });
      block.append(h('p', { class: 'change__tools' }, toggle));
    }
  } else {
    block.append(wordDiff(before, after));
  }
  if (onUndo) {
    const undo = h('button', { class: 'button button--small', type: 'button' }, 'Undo just this change', hidden(` to ${change.label}`));
    undo.addEventListener('click', () => onUndo(change));
    block.append(h('p', { class: 'change__tools' }, undo));
  }
  return block;
}

/**
 * "Before → after" for one file, field by field. With `save` (and permission to write), each
 * change made by that save gets "Undo just this change".
 */
function renderComparison(path, beforeText, afterText, { save } = {}) {
  if (beforeText == null && afterText == null) return h('p', { class: 'note' }, 'This item did not exist in either version.');
  const comparison = compareContent(path, beforeText, afterText);
  if (!comparison) return renderLineComparison(beforeText ?? '', afterText ?? '');
  if (comparison.layoutOnly) return h('p', { class: 'note' }, layoutNote(path));
  if (comparison.changes.length === 0) return h('p', { class: 'note' }, 'No difference.');
  const box = h('div', { class: 'changes' });
  let group = null;
  for (const change of comparison.changes) {
    if (change.group !== group) {
      group = change.group;
      box.append(h('h4', { class: 'changes__group' }, group));
    }
    const onUndo = save && state.canWrite && change.status === 'changed' ? (picked) => confirmUndo(save, { path, change: picked }) : null;
    box.append(renderChange(change, { onUndo }));
  }
  return box;
}

/** What to say when two versions differ but no field does. */
const layoutNote = (path) => (describePath(path, state.index).kind === 'Decision trees'
  ? 'No text changed: only the order of the trees or of their steps, or the file’s layout.'
  : 'No text changed: only the file’s layout.');

/** Line by line, for a file that cannot be read as content (damaged JSON, say). */
function renderLineComparison(before, after) {
  const groups = compareTexts(before, after);
  if (!groups) return h('p', { class: 'note' }, 'The two versions are too different to compare line by line.');
  if (isUnchanged(groups)) return h('p', { class: 'note' }, 'No difference.');
  const box = h('div', { class: 'diff' });
  const line = (text, kind) => h('div', { class: `diff__line diff__line--${kind}` }, h('span', { class: 'diff__mark', 'aria-hidden': 'true' }, MARK[kind]), hidden(SPOKEN[kind]), text || ' ');
  for (const group of groups) {
    if (group.type === 'same') {
      if (group.lines.length > 4) box.append(h('div', { class: 'diff__skip' }, `⋯ ${group.lines.length} unchanged lines`));
      else group.lines.forEach((text) => box.append(line(text, 'same')));
    } else {
      group.removed.forEach((text) => box.append(line(text, 'removed')));
      group.added.forEach((text) => box.append(line(text, 'added')));
    }
  }
  return box;
}

/** A button that shows or hides a comparison loaded on first use. */
function comparisonToggle(label, spokenContext, load) {
  const panel = h('div', { class: 'panel', hidden: true });
  const button = h('button', { class: 'link-button', type: 'button', 'aria-expanded': 'false' }, label, hidden(` ${spokenContext}`));
  let loaded = false;
  button.addEventListener('click', async () => {
    const open = button.getAttribute('aria-expanded') !== 'true';
    button.setAttribute('aria-expanded', String(open));
    panel.hidden = !open;
    if (open && !loaded) {
      loaded = true;
      panel.replaceChildren(h('p', { class: 'note' }, 'Loading…'));
      try {
        panel.replaceChildren(await load());
      } catch (error) {
        loaded = false;
        panel.replaceChildren(h('p', { class: 'note note--error' }, explain(error)));
      }
    }
  });
  return { button, panel };
}

// ---------------------------------------------------------------------------
// Recent changes
// ---------------------------------------------------------------------------

function toSave(commit) {
  return {
    sha: commit.sha,
    date: commit.commit.author.date,
    who: commit.commit.author.name || commit.author?.login || 'Unknown',
    message: commit.commit.message,
    parents: commit.parents,
    files: commit.files.filter((f) => isContentPath(f.filename) || isContentPath(f.previous_filename)),
  };
}

/** Loads older saves until at least `wanted` more content saves are listed (or none are left). */
async function loadSaves(wanted = 10) {
  const feed = state.feed;
  let added = 0;
  while (added < wanted && !feed.done) {
    feed.page += 1;
    const commits = await state.gh.listCommits({ page: feed.page, perPage: 30 });
    if (commits.length < 30) feed.done = true;
    // Merges repeat changes already listed with their own saves.
    const details = await mapLimit(commits.filter((c) => c.parents.length === 1), 6, (c) => state.gh.getCommit(c.sha));
    for (const save of details.map(toSave).filter((s) => s.files.length)) {
      feed.saves.push(save);
      added += 1;
    }
  }
}

async function showRecent() {
  const list = h('ol', { class: 'saves' });
  const more = h('button', { class: 'button', type: 'button' }, 'Show older changes');
  main.replaceChildren(...[
    h('h1', { tabindex: '-1' }, 'Content history'),
    h('p', { class: 'intro' }, 'Every save in the content editor is kept. Here you can see what changed and undo it. Nothing is ever deleted: an undo is saved as a new change, which you can undo here too.'),
    state.canWrite ? null : h('p', { class: 'note note--warning' }, 'Your GitHub account can see the history but not change the app’s content, so the Undo and Restore buttons are hidden.'),
    finder(),
    h('h2', {}, 'Recent changes'),
    list,
    more,
  ].filter(Boolean));
  const render = () => {
    list.replaceChildren(...state.feed.saves.map(renderSave));
    more.hidden = state.feed.done;
  };
  more.addEventListener('click', async () => {
    more.disabled = true;
    say('Loading older changes…');
    try {
      await loadSaves();
      render();
      say('');
    } catch (error) {
      say(explain(error), 'error');
    }
    more.disabled = false;
  });
  if (!state.feed) {
    state.feed = { saves: [], page: 0, done: false };
    say('Loading recent changes…');
    try {
      await loadSaves();
      say('');
    } catch (error) {
      state.feed = null;
      say(explain(error), 'error');
      return;
    }
  }
  render();
}

/** "3. Educational Grants › Text; Q&A 31 · Answer", filled in once the two versions are read. */
async function summarise(save, file, target) {
  try {
    const parent = save.parents[0]?.sha;
    const comparison = compareContent(file.filename, await readText(file.filename, parent), await readText(file.filename, save.sha));
    if (!comparison) return;
    if (comparison.layoutOnly) {
      target.textContent = layoutNote(file.filename);
      return;
    }
    const names = comparison.changes.map((change) => (change.group && change.group !== 'Chapter' && change.group !== 'Page' ? `${change.group} › ${change.label}` : change.label));
    target.textContent = names.length ? `Changed: ${names.slice(0, 4).join('; ')}${names.length > 4 ? `; and ${names.length - 4} more` : ''}.` : '';
  } catch {
    // The summary is a convenience; "What changed" shows the details or the error.
  }
}

function renderSave(save) {
  const items = h('ul', { class: 'save__items' });
  const parent = save.parents[0]?.sha;
  for (const file of save.files) {
    const path = isContentPath(file.filename) ? file.filename : file.previous_filename;
    const item = describePath(path, state.index);
    const summary = h('p', { class: 'save__summary' });
    const { button, panel } = comparisonToggle('What changed', `in ${itemTitle(path)}`, async () =>
      renderComparison(path, await readText(file.previous_filename ?? file.filename, parent), file.status === 'removed' ? null : await readText(file.filename, save.sha), { save }),
    );
    items.append(
      h('li', {},
        h('span', { class: 'badge' }, item.kind), ' ',
        h('strong', {}, itemTitle(path)),
        h('span', { class: 'actions' }, button, itemLink(path, 'History', hidden(` of ${itemTitle(path)}`))),
        summary,
        panel,
      ),
    );
    if (file.status === 'modified') summarise(save, file, summary);
  }
  let undo = null;
  if (state.canWrite && save.parents.length === 1) {
    undo = h('button', { class: 'button', type: 'button' }, 'Undo this save');
    undo.addEventListener('click', () => confirmUndo(save));
  }
  return h('li', { class: 'save' },
    h('p', { class: 'save__when' }, h('strong', {}, formatDate(save.date)), ` · ${save.who}`),
    h('p', { class: 'save__message' }, firstLine(save.message)),
    items,
    undo,
  );
}

// ---------------------------------------------------------------------------
// Finder: open an item's history by name
// ---------------------------------------------------------------------------

function finder() {
  const results = h('ul', { class: 'finder__results', id: 'finder-results' });
  const input = h('input', { id: 'finder', type: 'search', autocomplete: 'off', 'aria-controls': 'finder-results', placeholder: 'e.g. Chapter 4, Glossary, CVS check' });
  const search = () => {
    const words = input.value.toLowerCase().split(/\s+/).filter(Boolean);
    const matches = words.length
      ? state.items.filter((item) => words.every((w) => `${item.label} ${item.context ?? ''} ${item.kind}`.toLowerCase().includes(w))).slice(0, 15)
      : [];
    results.replaceChildren(...matches.map((item) => h('li', {}, h('span', { class: 'badge' }, item.kind), ' ', itemLink(item.path, itemTitle(item.path)))));
  };
  input.addEventListener('input', search);
  return h('div', { class: 'finder' }, h('label', { for: 'finder' }, 'Find a chapter, the decision trees or the Version History'), input, results);
}

// ---------------------------------------------------------------------------
// One item's history
// ---------------------------------------------------------------------------

const VERSIONS_PER_PAGE = 30;

async function showItem(path) {
  const item = describePath(path, state.index);
  const list = h('ol', { class: 'versions' });
  const more = h('button', { class: 'button', type: 'button', hidden: true }, 'Show older versions');
  main.replaceChildren(
    navLink('← Recent changes', ''),
    h('h1', { tabindex: '-1' }, itemTitle(path)),
    h('p', { class: 'intro' }, h('span', { class: 'badge' }, item.kind), ' ', item.url ? h('a', { href: item.url, target: '_blank', rel: 'noopener' }, 'Open in the app') : null),
  );
  if (!isContentPath(path)) {
    main.append(h('p', { class: 'note note--warning' }, 'This file is not part of the content the editor manages, so its history is not shown here.'));
    return;
  }
  main.append(h('h2', {}, 'Versions'), list, more);

  let page = 0;
  const loadPage = async () => {
    page += 1;
    const commits = await state.gh.listCommits({ path, page, perPage: VERSIONS_PER_PAGE });
    more.hidden = commits.length < VERSIONS_PER_PAGE;
    const versions = await mapLimit(commits.filter((c) => c.parents.length === 1), 6, async (c) => {
      const save = toSave(await state.gh.getCommit(c.sha));
      const file = save.files.find((f) => f.filename === path || f.previous_filename === path);
      const gone = Boolean(file && (file.status === 'removed' || (file.status === 'renamed' && file.previous_filename === path)));
      return { ...save, gone };
    });
    versions.forEach((version) => list.append(renderVersion(path, item, version, list.children.length === 0)));
  };
  more.addEventListener('click', async () => {
    more.disabled = true;
    say('Loading older versions…');
    try {
      await loadPage();
      say('');
    } catch (error) {
      say(explain(error), 'error');
    }
    more.disabled = false;
  });

  say('Loading versions…');
  try {
    await loadPage();
  } catch (error) {
    say(explain(error), 'error');
    return;
  }
  say(list.children.length ? '' : 'No saves found for this item.');
}

function renderVersion(path, item, version, isLatest) {
  const parent = version.parents[0]?.sha;
  const { button, panel } = comparisonToggle('What changed in this save', `of ${formatDate(version.date)}`, async () =>
    renderComparison(path, await readText(path, parent), version.gone ? null : await readText(path, version.sha), { save: version }),
  );
  let action = null;
  if (state.canWrite && !version.gone && !isLatest) {
    action = h('button', { class: 'button', type: 'button' }, 'Restore this version');
    action.addEventListener('click', () => confirmRestore(path, item, { ref: version.sha, date: version.date }));
  }
  return h('li', { class: 'version' },
    h('p', { class: 'save__when' },
      h('strong', {}, formatDate(version.date)), ` · ${version.who}`,
      isLatest && !version.gone ? h('span', { class: 'badge badge--current' }, 'Current version') : null,
      version.gone ? h('span', { class: 'badge badge--deleted' }, 'Deleted') : null,
    ),
    h('p', { class: 'save__message' }, firstLine(version.message)),
    h('p', { class: 'actions' }, button, action),
    panel,
  );
}

// ---------------------------------------------------------------------------
// Restore and undo (with a preview of exactly what will change)
// ---------------------------------------------------------------------------

/** Asks for confirmation, shows the previews, and saves the change. */
function confirm({ title, intro, previews, confirmLabel, steps, message }) {
  const error = h('p', { class: 'note note--error', role: 'alert', hidden: true });
  const yes = h('button', { class: 'button button--primary', type: 'button' }, confirmLabel);
  const no = h('button', { class: 'button', type: 'button' }, 'Cancel');
  dialog.replaceChildren(
    h('h2', { id: 'confirm-title' }, title),
    h('p', {}, intro),
    h('h3', {}, 'What will change in the app'),
    ...previews,
    h('p', { class: 'note' }, 'Nothing is deleted from the history: this is saved as a new change, which you can undo here too. The app shows it a few minutes later, once it has been rebuilt.'),
    error,
    h('div', { class: 'dialog__buttons' }, yes, no),
  );
  dialog.setAttribute('aria-labelledby', 'confirm-title');
  let saving = false;
  let refreshOnClose = false;
  dialog.oncancel = (event) => saving && event.preventDefault();
  dialog.onclose = () => refreshOnClose && route();
  no.addEventListener('click', () => dialog.close());
  yes.addEventListener('click', async () => {
    saving = true;
    yes.disabled = true;
    no.disabled = true;
    error.hidden = true;
    say('Saving…');
    try {
      const sha = await state.gh.applySteps(steps, message);
      saving = false;
      dialog.close();
      state.feed = null; // the list of recent changes now has a new entry
      route(sha ? 'Done. The app shows the change in a few minutes.' : 'Nothing to do: the content already is this way.');
    } catch (failure) {
      saving = false;
      error.textContent = explain(failure);
      error.hidden = false;
      say('');
      no.disabled = false;
      if (failure instanceof ConflictError) {
        yes.hidden = true;
        no.textContent = 'Close';
        refreshOnClose = true;
      } else {
        yes.disabled = false;
      }
    }
  });
  dialog.showModal();
}

/** Tells the editor why an undo cannot go ahead, in a dialog with only Close. */
function explainBlocked(title, paragraphs) {
  const close = h('button', { class: 'button', type: 'button' }, 'Close');
  close.addEventListener('click', () => dialog.close());
  dialog.replaceChildren(h('h2', { id: 'confirm-title' }, title), ...paragraphs, h('div', { class: 'dialog__buttons' }, close));
  dialog.setAttribute('aria-labelledby', 'confirm-title');
  dialog.oncancel = null;
  dialog.onclose = null;
  dialog.showModal();
}

async function confirmRestore(path, item, version) {
  say('Preparing…');
  try {
    const head = await state.gh.headSha();
    const [current, target, expectedSha] = await Promise.all([readText(path, head), readText(path, version.ref), state.gh.blobSha(path, head)]);
    say('');
    confirm({
      title: 'Restore this version?',
      intro: `“${itemTitle(path)}” will go back to how it was after the save of ${formatDate(version.date)}. Every change saved after that to this item will be undone; the changes are listed below.`,
      previews: [h('h4', {}, itemTitle(path)), renderComparison(path, current, target)],
      confirmLabel: 'Restore this version',
      steps: [{ path, expectedSha, from: { ref: version.ref, path } }],
      message: restoreMessage(item, version.date),
    });
  } catch (error) {
    say(explain(error), 'error');
  }
}

/**
 * Undoes a save (`only` unset), or one change within it (`only`: { path, change }). Only the
 * fields the save changed are put back; later changes to other fields of the same item are kept.
 * If a field was changed again later, nothing is done and the editor is told which one.
 */
async function confirmUndo(save, only = null) {
  say('Preparing…');
  try {
    const parent = save.parents[0]?.sha;
    const head = await state.gh.headSha();
    const files = only ? [{ filename: only.path, status: 'modified' }] : save.files;
    const steps = [];
    const previews = [];
    const blocked = [];
    let alreadyUndone = 0;
    for (const file of files) {
      const path = file.filename;
      const [parentText, saveText, headText, expectedSha] = await Promise.all([
        readText(file.previous_filename ?? path, parent),
        file.status === 'removed' ? null : readText(path, save.sha),
        readText(path, head),
        state.gh.blobSha(path, head),
      ]);
      const plan = file.status === 'modified' ? planUndo(path, { parentText, saveText, headText }, only ? [only.change.key] : null) : null;
      if (plan) {
        if (plan.conflicts.length) blocked.push({ path, changes: plan.conflicts, reason: 'later' });
        else if (plan.structural.length) {
          // A save that added or removed parts is undone by putting the whole file back, which
          // is only safe if nothing was saved to it since.
          if (headText === saveText) {
            steps.push({ path, expectedSha, from: { ref: parent, path } });
            previews.push(h('h4', {}, itemTitle(path)), renderComparison(path, headText, parentText));
          } else blocked.push({ path, changes: plan.structural, reason: 'structure' });
        // Putting the old value back can leave the file as it is (only spaces at the ends of a
        // text changed, which the editor trims anyway): nothing to undo there.
        } else if (plan.text && plan.text !== headText) {
          steps.push({ path, expectedSha, text: plan.text });
          previews.push(h('h4', {}, itemTitle(path)), renderComparison(path, headText, plan.text));
        } else alreadyUndone += 1;
        continue;
      }
      // Added, removed or unreadable files: whole-file undo, only if nothing changed since.
      const whole = undoSteps({ ...save, files: [file] });
      for (const step of whole) {
        steps.push(step);
        previews.push(h('h4', {}, itemTitle(step.path)), renderComparison(step.path, await readText(step.path, head), step.from ? await readText(step.from.path, step.from.ref) : null));
      }
    }
    say('');
    if (blocked.length) {
      const later = blocked.filter((item) => item.reason === 'later');
      const structure = blocked.filter((item) => item.reason === 'structure');
      const list = (items) => items.map(({ path, changes }) => h('div', {}, h('h4', {}, itemTitle(path)), h('ul', {}, changes.map((change) => h('li', {}, `${change.group} › ${change.label}${change.status === 'added' ? ' (added)' : change.status === 'removed' ? ' (removed)' : ''}`)))));
      explainBlocked('This can’t be undone automatically', [
        ...(later.length ? [
          h('p', {}, only
            ? 'This text was changed again by a later save, so undoing this change here would also undo that later work.'
            : 'Some of the texts this save changed were changed again by later saves, so undoing it here would also undo that later work:'),
          ...(only ? [] : list(later)),
        ] : []),
        ...(structure.length ? [
          h('p', {}, 'This save added or removed parts (for example a Version History update or a decision-tree step), and the item has been saved again since, so it cannot be undone part by part:'),
          ...list(structure),
        ] : []),
        h('p', {}, 'Undo the later saves first (newest first), or open the item’s History and restore the version you want.'),
      ]);
      return;
    }
    if (steps.length === 0) {
      say(alreadyUndone ? 'Nothing to undo: these changes have already been undone.' : 'Nothing to undo.', 'success');
      return;
    }
    confirm({
      title: only ? 'Undo this change?' : 'Undo this save?',
      intro: only
        ? `“${only.change.group} › ${only.change.label}” goes back to how it was before the save of ${formatDate(save.date)} by ${save.who}. Nothing else changes.`
        : `The changes saved on ${formatDate(save.date)} by ${save.who} will be undone. Changes saved since to other parts of the same items are kept.`,
      previews,
      confirmLabel: only ? 'Undo this change' : 'Undo this save',
      steps,
      message: only ? undoChangeMessage(save, { label: `${only.change.group} › ${only.change.label}` }) : undoMessage(save),
    });
  } catch (error) {
    say(explain(error), 'error');
  }
}

boot();
