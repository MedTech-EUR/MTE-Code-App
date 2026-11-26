// The Code API's answers (code-api.js), made from the Code's chapter files at build time:
// an index of the chapters, the whole Code, and one file per chapter. Every section and Q&A
// keeps the ID of its link in the app, so the API and the app always point at the same text.
// The wording is the chapter files' own; only the screen styling is removed. See docs/code-api.md.
import { createHash } from 'node:crypto';

import { CODE_API_FILES, CODE_API_PATH } from '../../code-api.js';
import { CODE_EDITION } from '../../src/data/codeEdition.js';
import { CODE_PARTS, WEBSITE_PART_ID } from '../../src/data/codeOrder.js';
import { htmlToPlainText } from '../../src/utils/htmlTextUtils.js';
import { SITE_ORIGIN, codeChapterHeading } from '../../src/utils/pageMeta.js';
import { buildChapterPath, buildCodeSectionPath } from '../../src/utils/routeUtils.js';
import { generateSectionId, getQaAnchorId } from '../../src/utils/textUtils.js';
import { sanitizeContentHtml } from './prerender.mjs';

// The terms every answer carries. Their wording is MedTech Europe's legal team's to change;
// `publishedEdition` is the published PDF of the edition in CODE_EDITION.
export const CODE_API_TERMS = Object.freeze({
  owner: 'MedTech Europe AISBL',
  reuse: 'MedTech Europe owns the MedTech Europe Code of Ethical Business Practice. You may reproduce the text from this API, in whole or in part, without changing its wording, provided you name the Code and its edition as the source and link to the page on medtecheurope-code.org that the text comes from.',
  authority: 'This text is provided for convenience. Where it differs from the edition published by MedTech Europe, the published edition prevails. It is not legal advice.',
  publishedEdition: 'https://www.medtecheurope.org/wp-content/uploads/2017/06/code-september-2024.pdf',
});

const TITLE = 'MedTech Europe Code of Ethical Business Practice';
const LABELLED_QUESTION = /^(Q&A\s*\d+)\s*[:.]\s*/;

const apiUrl = (file = '') => `${SITE_ORIGIN}${CODE_API_PATH}${file}`;
const pageUrl = (path) => `${SITE_ORIGIN}${path}`;

// A link in the text, as an absolute web address (links within the app point at its site).
function absoluteLink(href) {
  try {
    const url = new URL(href, SITE_ORIGIN);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch {
    return null;
  }
}

/** The text's HTML with only its structure: no styling, icons or images; web links kept. */
export const apiHtml = (html) => sanitizeContentHtml(html, { linkHref: absoluteLink }).trim();

// Opening a list item or table row starts a new line; other blocks are separated by a line break.
const NEW_LINE_TAGS = /<(li|tr)\b[^>]*>/gi;
const BLOCK_TAGS = /<\/?(p|div|ul|ol|h[1-6]|table|thead|tbody|tfoot|blockquote|figure|section)\b[^>]*>|<br\s*\/?>|<hr\s*\/?>/gi;

/** The text as plain text: paragraphs and list items on their own lines, table cells by tabs. */
export function apiText(html) {
  const marked = String(html ?? '')
    .replace(/<(script|style|svg|template)\b[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<\/t[dh]\s*>/gi, '\t')
    .replace(NEW_LINE_TAGS, '\n')
    .replace(BLOCK_TAGS, '\n');
  return htmlToPlainText(marked)
    .split('\n')
    .map((line) => line.replace(/ +/g, ' ').replace(/ *\t */g, '\t').replace(/^[ \t]+|[ \t]+$/g, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const plainLine = (html) => htmlToPlainText(html).replace(/\s+/g, ' ').trim();

function toApiQa(chapterId, sectionId, qa, index) {
  const id = getQaAnchorId(sectionId, index);
  const question = plainLine(qa.q);
  const labelled = LABELLED_QUESTION.exec(question);
  return {
    id,
    label: labelled ? labelled[1].replace(/\s+/, ' ') : null,
    question: labelled ? question.slice(labelled[0].length) : question,
    url: pageUrl(buildCodeSectionPath(chapterId, id)),
    html: apiHtml(qa.a),
    text: apiText(qa.a),
  };
}

function toApiSection(chapterId, section, index) {
  const id = generateSectionId(chapterId, section.title, index);
  return {
    id,
    title: plainLine(section.title || ''),
    url: pageUrl(buildCodeSectionPath(chapterId, id)),
    html: apiHtml(section.legalText),
    text: apiText(section.legalText),
    qas: (section.qas || []).map((qa, qaIndex) => toApiQa(chapterId, id, qa, qaIndex)),
  };
}

const PARTS_BY_ID = new Map(CODE_PARTS.map((part) => [part.id, part]));

function chapterSummary(chapter, sections) {
  const part = PARTS_BY_ID.get(chapter.part);
  return {
    id: chapter.id,
    heading: codeChapterHeading(chapter),
    title: plainLine(chapter.title),
    part: { id: part.id, label: part.label },
    url: pageUrl(buildChapterPath(chapter.id)),
    api: apiUrl(`/chapters/${chapter.id}`),
    sectionCount: sections.length,
    qaCount: sections.reduce((count, section) => count + section.qas.length, 0),
  };
}

const FIELDS = Object.freeze({
  'chapters[].id': 'The chapter ID, as in its address on medtecheurope-code.org (/code/{id}).',
  'sections[].id, qas[].id': 'The ID of the section or Q&A, the same as its link anchor in the app. It changes only when that link changes.',
  'qas[].label': 'The Q&A number printed in the Code (for example "Q&A 25"). A new edition may renumber Q&As; use the ID to refer to one.',
  'html': 'The text with its structure (paragraphs, lists, tables, bold, links) and nothing else: no attributes but link addresses and table spans.',
  'text': 'The same text as plain text: paragraphs and list items on their own lines, table cells separated by tabs.',
  'url': 'The page in the app that shows this text.',
  'about.contentHash': 'Changes whenever any of the text changes.',
});

/**
 * The API's files: [{ file, data }], file relative to CODE_API_PATH. Only the Code's own
 * chapters are included (not website pages such as Version History), with their Code text
 * only: the app's own chapter summaries are not part of the Code.
 */
export function buildCodeApiFiles(chapters) {
  const codeChapters = chapters
    .filter((chapter) => chapter.part !== WEBSITE_PART_ID)
    .map((chapter) => {
      if (!PARTS_BY_ID.has(chapter.part)) throw new Error(`${chapter.id}: unknown part "${chapter.part}".`);
      const sections = (chapter.sections || []).map((section, index) => toApiSection(chapter.id, section, index));
      return { ...chapterSummary(chapter, sections), sections };
    });

  const contentHash = createHash('sha256').update(JSON.stringify(codeChapters)).digest('hex').slice(0, 16);
  const about = {
    title: TITLE,
    edition: CODE_EDITION,
    contentHash,
    website: pageUrl('/code'),
    terms: CODE_API_TERMS,
  };
  const summaries = codeChapters.map(({ sections, ...summary }) => summary);

  return [
    {
      file: CODE_API_FILES.index,
      data: {
        about,
        addresses: {
          index: apiUrl(),
          code: apiUrl('/code'),
          chapter: apiUrl('/chapters/{chapterId}'),
        },
        fields: FIELDS,
        chapters: summaries,
      },
    },
    { file: CODE_API_FILES.code, data: { about, chapters: codeChapters } },
    ...codeChapters.map((chapter) => ({ file: CODE_API_FILES.chapter(chapter.id), data: { about, chapter } })),
  ];
}
