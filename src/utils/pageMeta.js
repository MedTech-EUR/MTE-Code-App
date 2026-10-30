import { SECTIONS, TREE_PAGE_TOOLS } from '../config/sections.js';
import { htmlToPlainText } from './htmlTextUtils.js';
import {
  buildChapterPath,
  buildCodeHomePath,
  buildEventSupportPath,
  buildHistoricalDeclarationsPath,
  buildHomePath,
  buildQuizPath,
  buildTpptPath,
  buildTransparencyDocumentPath,
  buildTransparencyHomePath,
  buildTransparencyUnitPath,
  buildTreePath,
  buildTreesHomePath,
} from './routeUtils.js';

// The address search engines are told to index. www and trailing-slash variants redirect here
// (server.js).
export const SITE_ORIGIN = 'https://medtecheurope-code.org';

// The home page keeps the title and description written in index.html; tests/pageMeta.test.mjs
// keeps the two in step.
export const HOME_TITLE = 'MedTech Europe Code of Ethical Business Practice | The Code App';
export const HOME_DESCRIPTION = 'The full MedTech Europe Code of Ethical Business Practice: chapter text, Disclosure Guidelines, decision trees, the TPPT checker and the declarations archive.';

const TITLE_SUFFIX = 'MedTech Europe Code';
const MAX_DESCRIPTION_LENGTH = 160;

const pageTitle = (heading) => `${heading} | ${TITLE_SUFFIX}`;
const sectionById = (id) => SECTIONS.find((section) => section.id === id);

/**
 * Plain text for a meta description: tags removed, whitespace collapsed, and cut at a word
 * boundary with an ellipsis when it runs past the length search results show.
 */
export function summarizeHtml(html, maxLength = MAX_DESCRIPTION_LENGTH) {
  const text = htmlToPlainText(html).replace(/\s+/g, ' ').replace(/ ([.,;:!?])/g, '$1').trim();
  if (text.length <= maxLength) return text;

  const cut = text.slice(0, maxLength - 1);
  const lastSpace = cut.lastIndexOf(' ');
  const shortened = lastSpace > maxLength / 2 ? cut.slice(0, lastSpace) : cut;
  return `${shortened.replace(/[\s,;:.–—-]+$/, '')}…`;
}

// The first text a reader unit opens with, for units that have no summary of their own.
const firstSectionText = (unit) => (
  (unit.sections || []).map((section) => section.legalText).find((text) => htmlToPlainText(text).trim()) || ''
);

/** The reader's heading for a Code chapter: "Chapter 4: Grants and Charitable Donations". */
export function codeChapterHeading(chapter) {
  return /^\d+$/.test(String(chapter.icon ?? ''))
    ? `Chapter ${chapter.icon}: ${chapter.title}`
    : chapter.title;
}

/**
 * Every page a visitor can open directly, in the order the sitemap lists them, each with its
 * canonical path, the heading it shows, its title and its description. Code chapters, decision
 * trees and reader units also carry their content (`chapter`, `tree`, `document`, `unit`).
 */
export function createPageList({ chapters, trees, transparencyDocuments }) {
  const pages = [];
  const add = (page) => pages.push({ ...page, title: page.title ?? pageTitle(page.heading) });

  add({
    kind: 'home',
    path: buildHomePath(),
    heading: 'The MedTech Europe Code of Ethical Business Practice',
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
  });

  add({
    kind: 'code-home',
    path: buildCodeHomePath(),
    heading: 'All Chapters',
    description: sectionById('code').description,
  });
  chapters.forEach((chapter) => {
    add({
      kind: 'code-chapter',
      path: buildChapterPath(chapter.id),
      heading: codeChapterHeading(chapter),
      description: summarizeHtml(chapter.summary || firstSectionText(chapter)),
      chapter,
    });
  });

  add({
    kind: 'trees-home',
    path: buildTreesHomePath(),
    heading: sectionById('trees').title,
    description: sectionById('trees').description,
  });
  trees.forEach((tree) => {
    add({
      kind: 'tree',
      path: buildTreePath(tree.id),
      heading: tree.title,
      description: summarizeHtml(tree.description),
      tree,
    });
  });
  const eventSupport = TREE_PAGE_TOOLS.find((tool) => tool.id === 'event-support');
  add({
    kind: 'tool',
    path: buildEventSupportPath(),
    heading: eventSupport.title,
    description: eventSupport.description,
  });

  add({
    kind: 'transparency-home',
    path: buildTransparencyHomePath(),
    heading: sectionById('transparency').title,
    description: sectionById('transparency').description,
  });
  transparencyDocuments.forEach((document) => {
    add({
      kind: 'transparency-document',
      path: buildTransparencyDocumentPath(document.id),
      heading: document.title,
      description: summarizeHtml(document.description),
      document,
    });
    (document.units || []).forEach((unit) => {
      add({
        kind: 'transparency-unit',
        path: buildTransparencyUnitPath(document.id, unit.id),
        heading: unit.title,
        title: pageTitle(`${unit.title} – ${document.title}`),
        description: summarizeHtml(unit.summary || firstSectionText(unit)),
        document,
        unit,
      });
    });
  });
  add({
    kind: 'tool',
    path: buildHistoricalDeclarationsPath(),
    heading: 'Historical Declarations',
    description: 'Search past transparency declarations by company, beneficiary, year, or country.',
  });

  [['quiz', buildQuizPath()], ['tppt', buildTpptPath()]].forEach(([id, path]) => {
    add({
      kind: 'tool',
      path,
      heading: sectionById(id).title,
      description: sectionById(id).description,
    });
  });

  return pages;
}

/** The path a page is listed under: the route's canonical URL without its anchor. */
export function pagePathOf(url) {
  return String(url || '/').split('#')[0] || '/';
}

/**
 * Shows the page's title and description in the browser tab and the document head, and points
 * the canonical link at it, so they follow the reader around the app.
 */
export function setDocumentPageMeta(page, doc = globalThis.document) {
  if (!page || !doc) return;

  doc.title = page.title;
  doc.querySelector('meta[name="description"]')?.setAttribute('content', page.description);

  let canonical = doc.querySelector('link[rel="canonical"]');
  if (!canonical) {
    canonical = doc.createElement('link');
    canonical.setAttribute('rel', 'canonical');
    doc.head.appendChild(canonical);
  }
  canonical.setAttribute('href', `${SITE_ORIGIN}${page.path}`);
}
