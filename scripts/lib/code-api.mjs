// Generate the current Code, durable item responses and framed excerpts from the chapter files.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

import { CODE_API_FILES, CODE_API_PATH } from '../../code-api.js';
import { CODE_EDITION, CODE_VERSION, CODE_PDF } from '../../src/data/codeEdition.js';
import { CODE_PARTS, WEBSITE_PART_ID } from '../../src/data/codeOrder.js';
import { htmlToPlainText } from '../../src/utils/htmlTextUtils.js';
import { SITE_ORIGIN, codeChapterHeading } from '../../src/utils/pageMeta.js';
import { buildChapterPath, buildCodeSectionPath } from '../../src/utils/routeUtils.js';
import { generateSectionId, getQaAnchorId } from '../../src/utils/textUtils.js';
import { renderLiveEmbed } from './code-embed.mjs';
import { validateLiveIds } from './code-live-ids.mjs';
import { sanitizeContentHtml } from './prerender.mjs';

// Published with each JSON response. The release metadata supplies the source PDF.
export const CODE_API_TERMS = Object.freeze({
  owner: 'MedTech Europe AISBL',
  reuse: 'You may display and reproduce verbatim excerpts or the full Code, including in company intranets, training and compliance tools. Attribute MedTech Europe and link to the official source. Identify commentary, translations and adaptations separately. Do not present altered text as official, sell the Code itself or charge for access to this feed without prior written permission.',
  authority: 'This text is provided for convenience. Where it differs from the edition published by MedTech Europe, the published edition prevails. It is not legal advice.',
  publishedEdition: CODE_PDF,
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
function plainBlocks(html) {
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

// Work on the sanitizer's structural table markup, expanding cells into every row
// and column they cover. This keeps e.g. annex VI's event type beside each setting.
function tableText(table) {
  const grid = [];
  const rows = [...table.matchAll(/<tr>([\s\S]*?)<\/tr>/gi)];
  for (const [row, match] of rows.entries()) {
    grid[row] ??= [];
    let col = 0;
    for (const cell of match[1].matchAll(/<t[hd]([^>]*)>([\s\S]*?)<\/t[hd]>/gi)) {
      while (grid[row][col] !== undefined) col++;
      const height = Number(/rowspan="(\d+)"/.exec(cell[1])?.[1] ?? 1);
      const width = Number(/colspan="(\d+)"/.exec(cell[1])?.[1] ?? 1);
      const value = plainLine(cell[2]);
      for (let r = row; r < Math.min(row + height, rows.length); r++) {
        grid[r] ??= [];
        for (let c = col; c < col + width; c++) grid[r][c] = value;
      }
      col += width;
    }
  }
  return grid.map((row) => row.join('\t')).join('\n');
}

export function apiText(html) {
  return apiHtml(html).split(/(<table>[\s\S]*?<\/table>)/gi)
    .map((block) => block.startsWith('<table>') ? tableText(block) : plainBlocks(block))
    .filter(Boolean).join('\n\n');
}

function toApiQa(chapterId, sectionId, qa, index) {
  const anchorId = getQaAnchorId(sectionId, index);
  const question = plainLine(qa.q);
  const labelled = LABELLED_QUESTION.exec(question);
  return {
    id: qa.liveId,
    anchorId,
    label: labelled ? labelled[1].replace(/\s+/, ' ') : null,
    question: labelled ? question.slice(labelled[0].length) : question,
    url: pageUrl(buildCodeSectionPath(chapterId, anchorId)),
    html: apiHtml(qa.a),
    text: apiText(qa.a),
  };
}

function toApiSection(chapterId, section, index) {
  const anchorId = generateSectionId(chapterId, section.title, index);
  const figure = /<img\b[^>]*src="(\/code-assets\/[a-zA-Z0-9._-]+)"[^>]*alt="([^"]*)"[^>]*>/.exec(section.legalText);
  return {
    ...(figure ? { figure: { url: pageUrl(figure[1]), description: plainLine(figure[2]) } } : {}),
    id: section.liveId,
    anchorId,
    title: plainLine(section.title || ''),
    url: pageUrl(buildCodeSectionPath(chapterId, anchorId)),
    html: apiHtml(section.legalText),
    text: apiText(section.legalText),
    qas: (section.qas || []).map((qa, qaIndex) => toApiQa(chapterId, anchorId, qa, qaIndex)),
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
  'sections[].id, qas[].id': 'Permanent ID used by the item endpoint and live embed. anchorId is its current location in the reader.',
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
const registryUrl = new URL('../../src/data/code-live-ids.json', import.meta.url);
export function buildCodeApiFiles(chapters, registry = JSON.parse(readFileSync(registryUrl, 'utf8'))) {
  validateLiveIds(chapters, registry);
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
    version: CODE_VERSION,
    contentHash,
    website: pageUrl('/code'),
    terms: CODE_API_TERMS,
  };
  const summaries = codeChapters.map(({ sections, ...summary }) => summary);

  const items = [];
  for (const chapter of codeChapters) {
    const { sections, ...chapterInfo } = chapter;
    for (const section of sections) {
      const { qas, html, text, ...sectionInfo } = section;
      for (const record of [section, ...qas]) {
        const isSection = record === section;
        const data = { about, chapter: chapterInfo, section: isSection ? section : sectionInfo };
        if (!isSection) data.qa = record;
        items.push({ file: CODE_API_FILES.item(record.id), data });
        for (const showVersion of [false, true]) {
          for (const includeQas of [false, true]) {
            items.push({
              file: CODE_API_FILES.embed(record.id, includeQas, showVersion),
              body: renderLiveEmbed(data, includeQas, showVersion),
            });
          }
        }
      }
    }
  }
  return [
    ...registry.withdrawn.map((id) => ({ file: 'withdrawn/' + id + '.txt', body: 'Withdrawn' })),
    {
      file: CODE_API_FILES.index,
      data: {
        about,
        addresses: {
          index: apiUrl(),
          code: apiUrl('/code'),
          chapter: apiUrl('/chapters/{chapterId}'),
          item: apiUrl('/items/{id}'),
          embed: apiUrl('/embed/{id}'),
        },
        fields: FIELDS,
        chapters: summaries,
      },
    },
    { file: CODE_API_FILES.code, data: { about, chapters: codeChapters } },
    ...items,
    ...codeChapters.map((chapter) => ({ file: CODE_API_FILES.chapter(chapter.id), data: { about, chapter } })),
  ];
}
