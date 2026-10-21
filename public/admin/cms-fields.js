/**
 * The Code App's content editor: the HTML field, the previews and start-up. index.html sets
 * CMS_MANUAL_INIT, so Sveltia CMS waits until this module has registered everything.
 *
 * - The HTML field (`widget: exact-html` in config.yml) keeps the stored HTML exactly as typed.
 *   Edit shows the HTML, Preview shows it as the app does, Changes shows what was changed since
 *   the field was opened, and a note appears while a tag is left open or out of order.
 * - Chapter previews show a chapter as the app lays it out; the decision trees preview walks each
 *   tree from its start and flags answers that lead nowhere.
 * Previews use the app's own stylesheet, copied to /admin/app-style.css by the build
 * (vite.config.ts, adminFiles()).
 */
import { CHAPTER_FILES } from './lib/cms-format.js';
import { checkHtml, htmlToText } from './lib/html-tools.js';
import { inspectTree, OUTCOME_LABELS } from './lib/trees.js';
import { diffWords } from './history/history-core.js';

const { CMS, h, createClass, DOMPurify } = window;

const APP_STYLE = '/admin/app-style.css';
const READER_CLASSES = 'prose prose-slate max-w-none text-gray-800 leading-relaxed reader-content';

/** HTML for display: scripts and event handlers are removed (the app does the same). */
const clean = (html) => DOMPurify.sanitize(html ?? '');

// ---------------------------------------------------------------------------
// The HTML field
// ---------------------------------------------------------------------------

/** The entry's data as plain values, however the editor hands it over. */
function entryData(entry) {
  const data = typeof entry?.get === 'function' ? entry.get('data') : entry?.data;
  return (typeof data?.toJS === 'function' ? data.toJS() : data) ?? {};
}

/**
 * The saved text of the field at `keyPath` (e.g. "sections.2.legalText"), read from the file as
 * it was when the entry was opened. Undefined when it cannot be known for sure: an item was
 * added to or removed from one of the lists on the way, so positions no longer match.
 */
function savedValue(entry, keyPath) {
  const raw = typeof entry?.get === 'function' ? entry.get('raw') : entry?.raw;
  if (!raw || !keyPath) return undefined;
  let saved;
  try {
    saved = JSON.parse(raw);
  } catch {
    return undefined;
  }
  let current = entryData(entry);
  for (const part of keyPath.split('.')) {
    if (Array.isArray(saved) && (!Array.isArray(current) || saved.length !== current.length)) return undefined;
    saved = saved?.[part];
    current = current?.[part];
  }
  return typeof saved === 'string' ? saved : undefined;
}

// Otherwise the text a field had when it was first shown, kept until the next save.
const firstSeen = new Map();
CMS.registerEventListener({ name: 'postSave', handler: () => firstSeen.clear() });

/** A page for the preview frame: the app's stylesheet, the reader's text classes, the HTML. */
function previewDocument(html) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><base target="_blank">
<link rel="stylesheet" href="${APP_STYLE}">
<style>
  :where(body) { margin: 0; padding: 16px 20px; background: #fff; color: #1e293b; font: 16px/1.65 system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif; }
  :where(table) { border-collapse: collapse; } :where(td, th) { border: 1px solid #cbd5e1; padding: 6px 8px; }
  :where(ul) { list-style: disc; padding-left: 1.5rem; } :where(ol) { list-style: decimal; padding-left: 1.5rem; }
  img { max-width: 100%; height: auto; }
</style></head>
<body><div class="${READER_CLASSES}">${clean(html)}</div></body></html>`;
}

const TABS = [
  { id: 'edit', label: 'Edit' },
  { id: 'preview', label: 'Preview' },
  { id: 'changes', label: 'Changes' },
];

const CONTEXT_LINES = 2;

/** An unchanged stretch, shortened to the lines next to the changes around it. */
function shortenUnchanged(text, { first, last }) {
  const lines = text.split('\n');
  const head = first ? [] : lines.slice(0, CONTEXT_LINES + 1);
  const tail = last ? [] : lines.slice(-(CONTEXT_LINES + 1));
  if (head.length + tail.length >= lines.length) return [text];
  const skipped = lines.length - head.length - tail.length;
  return [head.join('\n'), `\n⋯ ${skipped} unchanged line${skipped === 1 ? '' : 's'} ⋯\n`, tail.join('\n')].filter((part) => part !== '');
}

/** Word-level differences as elements: removed words struck through, added ones underlined. */
function renderDiff(before, after) {
  const ops = diffWords(before, after);
  if (!ops) return h('p', { className: 'mte-html__note' }, 'The text changed too much to show word by word.');
  return ops.flatMap((op, i) => {
    if (op.type === 'equal') {
      return shortenUnchanged(op.value, { first: i === 0, last: i === ops.length - 1 })
        .map((part, j) => h('span', { key: `${i}-${j}`, className: part.startsWith('\n⋯') ? 'mte-html__skip' : undefined }, part));
    }
    const Tag = op.type === 'delete' ? 'del' : 'ins';
    return [h(Tag, { key: i }, h('span', { className: 'visually-hidden' }, op.type === 'delete' ? ' [removed: ' : ' [added: '), op.value, h('span', { className: 'visually-hidden' }, '] '))];
  });
}

const HtmlField = createClass({
  getInitialState() {
    return { tab: 'edit', keyPath: null, showHtml: false };
  },

  componentDidMount() {
    // The field's place in the entry, from the editor's own markup (stable, unlike forID).
    const keyPath = this.root?.closest('[data-key-path]')?.getAttribute('data-key-path') ?? null;
    const key = `${location.hash.split('?')[0]}|${keyPath ?? this.props.forID}`;
    if (!firstSeen.has(key)) firstSeen.set(key, this.props.value ?? '');
    this.setState({ keyPath, key });
  },

  baseline() {
    const saved = savedValue(this.props.entry, this.state.keyPath);
    if (saved !== undefined) return saved;
    return firstSeen.get(this.state.key) ?? this.props.value ?? '';
  },

  setTab(tab) {
    this.setState({ tab });
  },

  onTabKey(event) {
    const index = TABS.findIndex((tab) => tab.id === this.state.tab);
    const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
    if (!step) return;
    event.preventDefault();
    const next = TABS[(index + step + TABS.length) % TABS.length].id;
    this.setTab(next);
    requestAnimationFrame(() => this.tabRefs?.[next]?.focus());
  },

  resizePreview(frame) {
    const document = frame?.contentDocument;
    if (!document?.body) return;
    const fit = () => { frame.style.height = `${document.documentElement.scrollHeight + 2}px`; };
    fit();
    this.observer?.disconnect();
    this.observer = new ResizeObserver(fit);
    this.observer.observe(document.body);
  },

  componentWillUnmount() {
    this.observer?.disconnect();
  },

  renderChanges(baseline, value) {
    if (baseline === value) return h('p', { className: 'mte-html__note' }, 'No changes since this text was opened.');
    const textBefore = htmlToText(baseline);
    const textAfter = htmlToText(value);
    const onlyFormatting = textBefore === textAfter;
    const showHtml = this.state.showHtml || onlyFormatting;
    return h('div', {},
      h('p', { className: 'mte-html__note' },
        onlyFormatting
          ? 'The words are the same; only the formatting changed (for example bold, links or line breaks). The HTML changes:'
          : showHtml ? 'Changes to the HTML since this text was opened:' : 'Changes to the text since it was opened (removed words struck through, added words underlined):',
        ' ',
        onlyFormatting ? null : h('button', { type: 'button', className: 'mte-html__link', onClick: () => this.setState({ showHtml: !showHtml }) }, showHtml ? 'Show the text changes' : 'Show the HTML changes'),
      ),
      h('div', { className: `mte-html__changes${showHtml ? ' mte-html__changes--html' : ''}` }, showHtml ? renderDiff(baseline, value) : renderDiff(textBefore, textAfter)),
      h('p', { className: 'mte-html__note', style: { marginTop: '0.5rem' } },
        h('button', { type: 'button', className: 'mte-html__link', onClick: () => this.props.onChange(baseline) }, 'Undo my changes to this text'),
      ),
    );
  },

  render() {
    const value = this.props.value ?? '';
    const baseline = this.state.key ? this.baseline() : value;
    const changed = value !== baseline;
    const problems = checkHtml(value);
    const id = this.props.forID;
    this.tabRefs = this.tabRefs ?? {};
    const tabs = h('div', { className: 'mte-html__tabs', role: 'tablist', 'aria-label': 'Show the text as' },
      TABS.map((tab) => h('button', {
        key: tab.id,
        type: 'button',
        role: 'tab',
        id: `${id}-tab-${tab.id}`,
        className: 'mte-html__tab',
        'aria-selected': this.state.tab === tab.id,
        'aria-controls': `${id}-panel`,
        tabIndex: this.state.tab === tab.id ? 0 : -1,
        ref: (element) => { this.tabRefs[tab.id] = element; },
        onClick: () => this.setTab(tab.id),
        onKeyDown: (event) => this.onTabKey(event),
      }, tab.label, tab.id === 'changes' && changed ? h('span', { className: 'mte-html__dot', 'aria-label': ' (changed)' }) : null)),
    );
    let panel;
    if (this.state.tab === 'edit') {
      panel = h('textarea', {
        id,
        className: 'mte-html__source',
        value,
        spellCheck: true,
        'aria-describedby': problems.length ? `${id}-warnings` : undefined,
        onChange: (event) => this.props.onChange(event.target.value),
      });
    } else if (this.state.tab === 'preview') {
      panel = h('iframe', {
        className: 'mte-html__preview',
        title: 'Preview of this text as the app shows it',
        // Same origin so the frame can be sized to its content; no scripts can run in it.
        sandbox: 'allow-same-origin allow-popups allow-popups-to-escape-sandbox',
        srcDoc: previewDocument(value),
        onLoad: (event) => this.resizePreview(event.currentTarget),
      });
    } else {
      panel = this.renderChanges(baseline, value);
    }
    return h('div', { className: 'mte-html', ref: (element) => { this.root = element; } },
      h('div', { className: 'mte-html__bar' }, tabs,
        h('span', { className: 'mte-html__state' }, changed ? 'Changed since opened' : 'Saved text')),
      h('div', { id: `${id}-panel`, role: 'tabpanel', 'aria-labelledby': `${id}-tab-${this.state.tab}` }, panel),
      problems.length
        ? h('div', { id: `${id}-warnings`, className: 'mte-html__warnings', role: 'status' },
          h('strong', {}, 'Check the HTML before saving: '),
          'the text may not show as intended, and a save with these problems will not be published.',
          h('ul', {}, problems.slice(0, 5).map((problem, i) => h('li', { key: i }, problem.message))))
        : null,
    );
  },
});

// ---------------------------------------------------------------------------
// Previews
// ---------------------------------------------------------------------------

const html = (value, className = READER_CLASSES) => h('div', { className, dangerouslySetInnerHTML: { __html: clean(value) } });

const qaNumber = (q, index) => (q ?? '').match(/^\s*Q&(?:amp;)?A\s+\d+/)?.[0]?.trim() ?? `Q&A ${index + 1}`;

/** A chapter as the app shows it: title, summary, sections with their Q&As. */
const ChapterPreview = createClass({
  render() {
    const chapter = entryData(this.props.entry);
    return h('article', { className: 'mte-preview' },
      h('p', { className: 'mte-preview__kicker' }, 'Preview: how the app shows this page'),
      h('h1', { className: 'text-3xl font-bold text-gray-900 mb-4' }, chapter.title || 'Untitled'),
      chapter.summary ? html(chapter.summary, `${READER_CLASSES} mte-preview__summary`) : null,
      (chapter.sections ?? []).map((section, i) => h('section', { key: i, className: 'mb-8' },
        section.title ? h('h2', { className: 'text-xl font-bold text-gray-800 mt-6 mb-3' }, section.title) : null,
        html(section.legalText),
        (section.qas ?? []).length
          ? h('div', { className: 'mt-4 space-y-4' }, section.qas.map((qa, k) => h('div', { key: k, className: 'bg-gray-50 p-4 rounded-lg border border-gray-100' },
            h('p', { className: 'text-xs font-bold text-[#007A86] mb-1' }, qaNumber(qa.q, k)),
            h('p', { className: 'font-bold text-gray-900 mb-1' }, qa.q),
            html(`A: ${qa.a ?? ''}`, 'text-gray-700 prose prose-sm max-w-none reader-content'))))
          : null)),
    );
  },
});

const TreeStep = ({ node, byId }) => h('li', { className: `mte-tree__step mte-tree__step--${node.type}` },
  h('p', { className: 'mte-tree__id' }, node.type === 'question' ? 'Question' : 'Result', ' · ', h('code', {}, node.id),
    node.type === 'result' ? h('span', { className: `mte-tree__outcome mte-tree__outcome--${node.outcome}` }, OUTCOME_LABELS[node.outcome] ?? 'No outcome') : null,
    node.type === 'result' && node.cvsCheck ? h('span', { className: 'mte-tree__cvs' }, `Live CVS check: ${node.cvsCheck}`) : null),
  h('p', { className: 'mte-tree__text' }, node.text),
  node.helpText ? h('p', { className: 'mte-tree__help' }, node.helpText) : null,
  node.type === 'result' && node.reference ? h('p', { className: 'mte-tree__ref' }, `Reference: ${node.reference}`) : null,
  node.type === 'question'
    ? h('ul', { className: 'mte-tree__answers' }, (node.options ?? []).map((option, i) => h('li', { key: i },
      option.label || '(no label)', ' → ',
      byId.has(option.next) ? h('code', {}, option.next) : h('strong', { className: 'mte-tree__broken' }, option.next ? `“${option.next}” does not exist` : 'leads nowhere'))))
    : null,
);

/** Every tree, walked from its start, with any answer that leads nowhere flagged. */
const TreesPreview = createClass({
  render() {
    const trees = entryData(this.props.entry).trees ?? [];
    const inspected = trees.map((tree) => ({ tree, ...inspectTree(tree) }));
    const total = inspected.reduce((sum, item) => sum + item.problems.length, 0);
    return h('article', { className: 'mte-preview mte-tree' },
      h('p', { className: 'mte-preview__kicker' }, 'Preview: each tree from its first question'),
      h('p', { className: total ? 'mte-tree__summary mte-tree__summary--problems' : 'mte-tree__summary' },
        total ? `${total} problem${total === 1 ? '' : 's'} to fix before saving (listed under each tree).` : 'Every answer leads to an existing step.'),
      inspected.map(({ tree, order, unreached, problems, byId }) => h('section', { key: tree.id || tree.title, className: 'mte-tree__tree' },
        h('h2', {}, tree.title || 'Untitled tree'),
        h('p', { className: 'mte-tree__meta' }, 'ID ', h('code', {}, tree.id), ` · listed with: ${(tree.relatedChapter ?? []).join(', ') || 'no chapter'} · category: ${tree.category || 'none'}`),
        problems.length ? h('ul', { className: 'mte-tree__problems' }, problems.map((problem, i) => h('li', { key: i }, problem))) : null,
        h('ol', { className: 'mte-tree__steps' }, order.map((node) => h(TreeStep, { key: node.id, node, byId }))),
        unreached.length ? h('p', { className: 'mte-tree__unreached' }, `Not reached from “start”: ${unreached.map((node) => node.id).join(', ')}.`) : null,
      )),
    );
  },
});

CMS.registerWidget('exact-html', HtmlField);
CMS.registerPreviewStyle(APP_STYLE);
CMS.registerPreviewStyle('/admin/preview.css');
for (const name of CHAPTER_FILES) CMS.registerPreviewTemplate(name, ChapterPreview);
CMS.registerPreviewTemplate('treeData', TreesPreview);
CMS.init();
