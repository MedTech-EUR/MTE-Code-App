import { htmlToPlainText } from '../../src/utils/htmlTextUtils.js';
import { SITE_ORIGIN } from '../../src/utils/pageMeta.js';

// Tags kept from the content's HTML, with every attribute removed except a table cell's span.
// Anything else (links, images, SVG, scripts) is dropped and its text kept as text.
const ALLOWED_TAGS = new Set([
  'p', 'br', 'hr', 'div', 'span', 'blockquote',
  'ul', 'ol', 'li',
  'strong', 'b', 'em', 'i', 'u', 'sup', 'sub', 'small',
  'h3', 'h4', 'h5', 'h6',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
]);
const VOID_TAGS = new Set(['br', 'hr']);
const DROPPED_WITH_CONTENT = /<(script|style|svg|template|iframe|object)\b[\s\S]*?<\/\1\s*>/gi;
const TAG = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g;
const SPAN_ATTRIBUTE = /\b(colspan|rowspan)\s*=\s*["']?(\d{1,2})\b/gi;

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Text of a title or question, which may carry entities or inline tags.
const plainText = (value) => escapeHtml(htmlToPlainText(value).replace(/\s+/g, ' ').trim());

/**
 * The content's HTML reduced to plain structure: allowed tags only, no attributes (but table
 * spans), every tag closed in order, and any other "<" or ">" escaped, so nothing in the text
 * can run script or close the page's own elements.
 */
export function sanitizeContentHtml(html) {
  const source = String(html ?? '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(DROPPED_WITH_CONTENT, '');
  const open = [];
  let output = '';
  let lastIndex = 0;

  const escapeText = (text) => text.replace(/</g, '&lt;').replace(/>/g, '&gt;');

  for (const match of source.matchAll(TAG)) {
    output += escapeText(source.slice(lastIndex, match.index));
    lastIndex = match.index + match[0].length;

    const [, closing, rawName, attributes] = match;
    const name = rawName.toLowerCase();
    if (!ALLOWED_TAGS.has(name)) continue;

    if (VOID_TAGS.has(name)) {
      if (!closing) output += `<${name}>`;
      continue;
    }

    if (closing) {
      const position = open.lastIndexOf(name);
      if (position === -1) continue;
      while (open.length > position) output += `</${open.pop()}>`;
      continue;
    }

    const spans = name === 'td' || name === 'th'
      ? [...attributes.matchAll(SPAN_ATTRIBUTE)].map(([, attribute, value]) => ` ${attribute.toLowerCase()}="${value}"`).join('')
      : '';
    output += `<${name}${spans}>`;
    open.push(name);
  }

  output += escapeText(source.slice(lastIndex));
  while (open.length) output += `</${open.pop()}>`;
  return output;
}

const link = (page) => `<a href="${escapeHtml(page.path)}">${escapeHtml(page.heading)}</a>`;

const linkList = (pages, withDescriptions = false) => (
  pages.length
    ? `<ul>${pages.map((page) => (
      `<li>${link(page)}${withDescriptions && page.description ? ` – ${escapeHtml(page.description)}` : ''}</li>`
    )).join('')}</ul>`
    : ''
);

function renderSections(sections) {
  return (sections || []).map((section) => {
    const qas = (section.qas || []).map((qa) => (
      `<h3>${plainText(qa.q)}</h3><div>${sanitizeContentHtml(qa.a)}</div>`
    )).join('');
    return `<section><h2>${plainText(section.title)}</h2><div>${sanitizeContentHtml(section.legalText)}</div>${qas}</section>`;
  }).join('');
}

function renderTree(tree, pagesByPath) {
  const start = (tree.nodes || []).find((node) => node.id === 'start') || tree.nodes?.[0];
  const related = [tree.relatedChapter].flat().filter(Boolean)
    .map((chapterId) => pagesByPath.get(`/code/${chapterId}`))
    .filter(Boolean);

  return [
    `<p>${plainText(tree.description)}</p>`,
    start?.text ? `<h2>${plainText(start.text)}</h2>` : '',
    start?.helpText ? `<p>${plainText(start.helpText)}</p>` : '',
    start?.options?.length ? `<ul>${start.options.map((option) => `<li>${plainText(option.label)}</li>`).join('')}</ul>` : '',
    related.length ? `<h2>Related chapters</h2>${linkList(related)}` : '',
  ].join('');
}

/** The page's main content, as the app shows it before any interaction. */
export function renderPageContent(page, pages) {
  const pagesByPath = new Map(pages.map((entry) => [entry.path, entry]));
  const ofKind = (kind) => pages.filter((entry) => entry.kind === kind);
  const heading = `<h1>${escapeHtml(page.heading)}</h1>`;
  const description = `<p>${escapeHtml(page.description)}</p>`;

  switch (page.kind) {
    case 'home':
      return heading + description + linkList(
        ['/code', '/transparency', '/trees', '/quiz', '/tppt'].map((path) => pagesByPath.get(path)).filter(Boolean),
        true,
      );
    case 'code-home':
      return heading + description + linkList(ofKind('code-chapter'), true);
    case 'code-chapter':
      return heading
        + (page.chapter.summary ? `<div>${sanitizeContentHtml(page.chapter.summary)}</div>` : '')
        + renderSections(page.chapter.sections);
    case 'trees-home':
      return heading + description + linkList([...ofKind('tree'), pagesByPath.get('/event-support')].filter(Boolean), true);
    case 'tree':
      return heading + renderTree(page.tree, pagesByPath);
    case 'transparency-home':
      return heading + description + linkList(
        pages.filter((entry) => entry.kind === 'transparency-document' || entry.path === '/transparency/historical-declarations'),
        true,
      );
    case 'transparency-document':
      return heading + description + linkList(
        ofKind('transparency-unit').filter((entry) => entry.document.id === page.document.id),
      );
    case 'transparency-unit':
      return `<p>${escapeHtml(page.document.title)}</p>${heading}${renderSections(page.unit.sections)}`;
    default:
      return heading + description;
  }
}

// Links to every page, grouped as the app's sidebar groups them, so each page can be found from
// any other.
function renderSiteNavigation(pages) {
  const groups = [
    ['The Code', pages.filter((page) => page.kind === 'code-home' || page.kind === 'code-chapter')],
    ['Decision Trees', pages.filter((page) => page.kind === 'trees-home' || page.kind === 'tree' || page.path === '/event-support')],
    ['Transparency', pages.filter((page) => page.kind.startsWith('transparency') || page.path === '/transparency/historical-declarations')],
    ['Tools', pages.filter((page) => page.path === '/quiz' || page.path === '/tppt')],
  ];
  return `<nav aria-label="All pages">${groups.map(([title, entries]) => (
    `<h2>${escapeHtml(title)}</h2>${linkList(entries)}`
  )).join('')}</nav>`;
}

// Shown only until the app starts, and to readers without JavaScript. The app's stylesheet
// resets headings and lists, so the text gets plain reading styles of its own.
const PRERENDER_STYLE = `<style>
.prerendered{max-width:48rem;margin:0 auto;padding:1.5rem 1rem 3rem;line-height:1.6}
.prerendered h1{font-size:1.75rem;line-height:1.25;font-weight:800;margin:1rem 0}
.prerendered h2{font-size:1.25rem;line-height:1.3;font-weight:700;margin:2rem 0 .5rem}
.prerendered h3,.prerendered h4,.prerendered h5{font-weight:700;margin:1.25rem 0 .25rem}
.prerendered p{margin:.6rem 0}
.prerendered ul,.prerendered ol{margin:.6rem 0;padding-left:1.25rem}
.prerendered ul{list-style:disc}
.prerendered ol{list-style:decimal}
.prerendered table{border-collapse:collapse;margin:1rem 0}
.prerendered th,.prerendered td{border:1px solid #cbd5e1;padding:.25rem .5rem;text-align:left;vertical-align:top}
.prerendered a{color:#007A86;text-decoration:underline}
.prerendered header a{color:inherit;font-weight:700;text-decoration:none}
.prerendered nav{margin-top:3rem;padding-top:1rem;border-top:1px solid #e2e8f0;font-size:.9rem}
</style>`;

function replaceOnce(html, pattern, replacement, label) {
  let replaced = false;
  const result = html.replace(pattern, () => {
    replaced = true;
    return replacement;
  });
  if (!replaced) throw new Error(`index.html no longer has ${label}; update scripts/lib/prerender.mjs.`);
  return result;
}

/**
 * The built index.html turned into one page's own HTML: its title, description, canonical
 * address and content. The app replaces the content when it starts.
 */
export function renderPageHtml(template, page, pages) {
  const url = `${SITE_ORIGIN}${page.path}`;
  const title = escapeHtml(page.title);
  const description = escapeHtml(page.description);
  const metaContent = (attribute, name, value) => [
    new RegExp(`<meta ${attribute}="${name}" content="[^"]*"\\s*/?>`),
    `<meta ${attribute}="${name}" content="${value}" />`,
    `the ${name} meta tag`,
  ];

  let html = template;
  html = replaceOnce(html, /<title>[\s\S]*?<\/title>/, `<title>${title}</title>`, 'a <title>');
  html = replaceOnce(html, ...metaContent('name', 'description', description));
  html = replaceOnce(html, ...metaContent('property', 'og:title', title));
  html = replaceOnce(html, ...metaContent('property', 'og:description', description));
  html = replaceOnce(html, ...metaContent('name', 'twitter:title', title));
  html = replaceOnce(html, ...metaContent('name', 'twitter:description', description));
  html = replaceOnce(
    html,
    /<\/head>/,
    `  <link rel="canonical" href="${escapeHtml(url)}" />\n    <meta property="og:url" content="${escapeHtml(url)}" />\n    ${PRERENDER_STYLE}\n  </head>`,
    '</head>',
  );
  html = replaceOnce(
    html,
    /<div id="root"><\/div>/,
    `<div id="root"><div class="prerendered"><header><a href="/">MedTech Europe Code of Ethical Business Practice</a></header><main>${renderPageContent(page, pages)}</main>${renderSiteNavigation(pages)}</div></div>`,
    'an empty <div id="root">',
  );
  return html;
}

/** sitemap.xml listing every page at its canonical address. */
export function renderSitemap(pages) {
  const urls = pages.map((page) => `  <url><loc>${escapeHtml(`${SITE_ORIGIN}${page.path}`)}</loc></url>`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
}
