import { generateSectionId, getQaAnchorId } from './textUtils.js';
import {
  buildChapterPath,
  buildCodeSectionPath,
  buildTransparencySectionPath,
  buildTransparencyUnitPath,
} from './routeUtils.js';

// Finds references such as "Chapter 4", "Section 3 of Chapter 4", "Chapters 1, 2 and 4",
// "Part 2", "Annex III" and "Q&A 3" in reader text, and resolves them to the chapter, section
// or Q&A they name. Links are added when text is displayed; the stored text never changes.
// Nothing here is specific to one edition of the Code: numbers are read from the titles of the
// loaded chapters, sections and Q&As.

const CODE = 'code';
const TRANSPARENCY = 'transparency';

const ROMAN_NUMERALS = { I: 1, V: 5, X: 10, L: 50 };
const romanToNumber = (roman) => {
  let total = 0;
  for (let i = 0; i < roman.length; i += 1) {
    const value = ROMAN_NUMERALS[roman[i]];
    const next = ROMAN_NUMERALS[roman[i + 1]] || 0;
    total += value < next ? -value : value;
  }
  return total;
};

const plainText = (html) => String(html || '')
  .replace(/<[^>]*>/g, ' ')
  .replace(/&nbsp;/g, ' ')
  .replace(/&amp;/g, '&')
  .replace(/\s+/g, ' ')
  .trim();

// "3. Educational Grants" -> 3
const leadingNumber = (title) => {
  const match = String(title || '').match(/^\s*(\d+)\s*\./);
  return match ? Number(match[1]) : null;
};

const normaliseTitle = (title) => plainText(title)
  .replace(/^\s*\d+\s*\.\s*/, '')
  .replace(/\s*\([^)]*\)\s*$/, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

export const referenceKey = (target) => [
  target.publication,
  target.publication === TRANSPARENCY ? target.documentId : null,
  target.unitId,
  target.sectionId ?? null,
  target.qaIndex ?? null,
].filter((part) => part !== null && part !== undefined).join(':');

function addPublication(index, {
  publication,
  documentId = null,
  documentTitle = null,
  units,
  describeUnit,
  readQaNumber,
}) {
  const scope = {
    publication,
    documentId,
    chapters: new Map(),
    annexes: new Map(),
    parts: new Map(),
    units: new Map(),
    qas: new Map(),
  };
  const partMembers = new Map();

  units.forEach((unit) => {
    const unitLabel = describeUnit(unit);
    const sections = (unit.sections || []).map((section, sectionIndex) => {
      const sectionId = section.computedId || generateSectionId(unit.id, section.title, sectionIndex);
      const sectionTarget = {
        publication,
        documentId,
        unitId: unit.id,
        sectionId,
        kind: 'section',
        title: section.title || unitLabel,
        ownTitle: section.title || '',
        location: unitLabel,
        html: section.legalText || '',
        qas: (section.qas || []).map((qa) => ({
          label: qa.label || '',
          questionHtml: qa.q || '',
          answerHtml: qa.a || '',
        })),
      };
      (section.qas || []).forEach((qa, qaIndex) => {
        const number = readQaNumber(qa);
        if (number === null || scope.qas.has(number)) return;
        scope.qas.set(number, {
          publication,
          documentId,
          unitId: unit.id,
          sectionId,
          qaIndex,
          kind: 'qa',
          title: `Q&A ${number}`,
          location: section.title ? `${unitLabel} › ${section.title}` : unitLabel,
          questionHtml: qa.q || '',
          answerHtml: qa.a || '',
        });
      });
      return {
        number: leadingNumber(section.title),
        normalisedTitle: normaliseTitle(section.title),
        target: sectionTarget,
      };
    });
    const unitTarget = {
      publication,
      documentId,
      unitId: unit.id,
      kind: 'unit',
      title: unitLabel,
      ownTitle: unit.title || '',
      location: documentTitle,
      summaryHtml: unit.summary || '',
      sections: sections.map((section) => section.target),
    };
    scope.units.set(unit.id, { target: unitTarget, sections });

    const chapterNumber = /^\d+$/.test(String(unit.icon ?? ''))
      ? Number(unit.icon)
      : Number(String(unit.title || '').match(/^Chapter\s+(\d+)\b/)?.[1] ?? NaN);
    if (Number.isFinite(chapterNumber) && !scope.chapters.has(chapterNumber)) {
      scope.chapters.set(chapterNumber, unit.id);
    }
    const annex = String(unit.title || '').match(/^Annex\s+([IVXL]+)\b/);
    if (annex) scope.annexes.set(romanToNumber(annex[1]), unit.id);
    const part = String(unit.part || '').match(/^part(\d+)$/);
    if (part) {
      const members = partMembers.get(Number(part[1])) || [];
      members.push(unit.id);
      partMembers.set(Number(part[1]), members);
    }
  });

  // "Part 2" can only be linked when the part is a single chapter.
  partMembers.forEach((members, number) => {
    if (members.length === 1) scope.parts.set(number, members[0]);
  });

  index.scopes.set(publication === CODE ? CODE : documentId, scope);
}

const codeChapterLabel = (chapter) => {
  if (/^\d+$/.test(String(chapter.icon ?? ''))) return `Chapter ${chapter.icon}: ${chapter.title}`;
  const part = String(chapter.part || '').match(/^part(\d+)$/);
  if (part && part[1] !== '1' && part[1] !== '3') return `Part ${part[1]}: ${chapter.title}`;
  return chapter.title;
};

/**
 * Builds lookup tables for the Code's chapters and each Transparency publication's units.
 * Pass the Code's own chapters (not website pages such as Version History).
 */
export function createReferenceIndex({ codeChapters = [], transparencyDocuments = [] } = {}) {
  const index = { scopes: new Map(), targets: new Map() };

  addPublication(index, {
    publication: CODE,
    units: codeChapters,
    describeUnit: codeChapterLabel,
    readQaNumber: (qa) => {
      const match = plainText(qa.q).match(/^Q&A\s*(\d+)\s*:/);
      return match ? Number(match[1]) : null;
    },
  });

  transparencyDocuments.forEach((document) => {
    addPublication(index, {
      publication: TRANSPARENCY,
      documentId: document.id,
      documentTitle: document.title,
      units: document.units || [],
      describeUnit: (unit) => unit.displayTitle || unit.title,
      readQaNumber: (qa) => {
        const match = plainText(qa.label).match(/^Q&A\s*(\d+)\b/);
        return match ? Number(match[1]) : null;
      },
    });
  });

  index.scopes.forEach((scope) => {
    scope.units.forEach(({ target, sections }) => {
      index.targets.set(referenceKey(target), target);
      sections.forEach((section) => index.targets.set(referenceKey(section.target), section.target));
    });
    scope.qas.forEach((target) => index.targets.set(referenceKey(target), target));
  });

  return index;
}

export const getReferenceTarget = (index, key) => index?.targets.get(key) ?? null;

// True for a plain left click. Reference links follow it inside the app; a click with a
// modifier key keeps the browser's own behaviour, such as opening a new tab.
export const isPlainLinkClick = (event) => (
  event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey
);

export function getReferenceHref(target) {
  const anchor = target.kind === 'qa'
    ? getQaAnchorId(target.sectionId, target.qaIndex)
    : target.sectionId;
  if (target.publication === CODE) {
    return anchor ? buildCodeSectionPath(target.unitId, anchor) : buildChapterPath(target.unitId);
  }
  return anchor
    ? buildTransparencySectionPath(target.documentId, target.unitId, anchor)
    : buildTransparencyUnitPath(target.documentId, target.unitId);
}

/**
 * Finds the target for an address inside a publication, such as a search result's section or
 * Q&A anchor: { publication, documentId?, unitId, anchor? }.
 */
export function findReferenceTarget(index, { publication, documentId = null, unitId, anchor = null }) {
  const base = publication === TRANSPARENCY ? `${publication}:${documentId}:${unitId}` : `${publication}:${unitId}`;
  if (!anchor) return getReferenceTarget(index, base);
  const qaAnchor = String(anchor).match(/^(.*)-qa-(\d+)$/);
  if (qaAnchor) {
    const qa = getReferenceTarget(index, `${base}:${qaAnchor[1]}:${Number(qaAnchor[2]) - 1}`);
    if (qa) return qa;
    return getReferenceTarget(index, `${base}:${qaAnchor[1]}`);
  }
  return getReferenceTarget(index, `${base}:${anchor}`);
}

// The anchor to scroll to when following a target (a section or a Q&A), or null for a chapter.
export const getReferenceAnchor = (target) => {
  if (target.kind === 'qa') return getQaAnchorId(target.sectionId, target.qaIndex);
  return target.sectionId ?? null;
};

const CODE_SUFFIX = /^[\s,)]*of\s+the\s+Code\b/i;
const OWN_SUFFIX = /^[\s,)]*of\s+(?:these|the)\s+(?:Disclosure\s+)?Guidelines\b/i;

// Chapter and annex numbers in a Transparency publication usually mean its own chapters, but
// "... of the Code", or a number the publication does not have, means the Code's.
function pickScope(index, context, kind, number, suffix) {
  const code = index.scopes.get(CODE);
  if (context?.publication !== TRANSPARENCY) return code;
  const own = index.scopes.get(context.documentId);
  if (!own || CODE_SUFFIX.test(suffix)) return code;
  if (OWN_SUFFIX.test(suffix)) return own;
  const table = kind === 'annex' ? own.annexes : own.chapters;
  return table.has(number) ? own : code;
}

const findSection = (unit, number) => unit.sections.find((section) => section.number === number) || null;

const REFERENCE_PATTERN = new RegExp([
  // Section 3 of Chapter 4 · Section 1, Chapter 1
  String.raw`(?<sectionOfChapter>\b[Ss]ection\s*(?<s1>\d+)(?:\.\d+)*\.?\s*(?:,\s*|\s+of\s+(?:the\s+)?)Chapter\s*(?<c1>\d+)\b)`,
  // Chapter 4, Section 3 · Chapter 3, Section2
  String.raw`(?<chapterSection>\bChapter\s*(?<c2>\d+)\s*,\s*[Ss]ection\s*(?<s2>\d+)\b)`,
  // Chapters 1, 2 and 4
  String.raw`(?<chapterList>\bChapters\s+(?<list>\d+(?:\s*(?:,|and|&amp;|&)\s*\d+)+))`,
  String.raw`(?<chapter>\bChapter\s*(?<c3>\d+)\b)`,
  String.raw`(?<part>\bPart\s+(?<p>\d+)\b)`,
  String.raw`(?<annex>\bAnnex\s+(?<a>[IVXL]+)\b)`,
  // Q&A 3, but not a Q&A's own "Q&A 3:" heading
  String.raw`(?<qa>\bQ&(?:amp;)?A\s*(?<q>\d+)\b(?!\s*:))`,
  // Section 2.2: how Transparency publications cite their own sections
  String.raw`(?<decimal>\b[Ss]ection\s+(?<dc>\d+)\.(?<ds>\d+)\b)`,
].join('|'), 'g');

// Each result: { start, end, text, status, target?, label?, note? } with status
//   'linked'     resolved to what it names
//   'fallback'   the chapter exists but the section it names does not; linked to the chapter
//   'unresolved' names a chapter, annex or Q&A that does not exist; not linked
//   'skipped'    deliberately not linked (the page itself, or a paragraph number)
function resolveMatch(match, suffix, index, context) {
  const groups = match.groups;
  const text = match[0];
  const start = match.index;
  const result = (status, extra = {}) => [{ start, end: start + text.length, text, status, ...extra }];
  const isCurrentUnit = (scope, unitId) => (
    scope.publication === (context?.publication || CODE)
    && (scope.publication === CODE || scope.documentId === context?.documentId)
    && unitId === context?.unitId
  );
  const unitLink = (scope, unitId) => {
    if (isCurrentUnit(scope, unitId)) return { status: 'skipped', note: 'the page itself' };
    return { status: 'linked', target: scope.units.get(unitId).target };
  };
  const fromLink = ({ status, ...details }) => result(status, details);

  if (groups.sectionOfChapter || groups.chapterSection) {
    const chapterNumber = Number(groups.c1 ?? groups.c2);
    const sectionNumber = Number(groups.s1 ?? groups.s2);
    const scope = pickScope(index, context, 'chapter', chapterNumber, suffix);
    const unitId = scope?.chapters.get(chapterNumber);
    if (!unitId) return result('unresolved', { note: `Chapter ${chapterNumber} does not exist` });
    const section = findSection(scope.units.get(unitId), sectionNumber);
    if (section) return result('linked', { target: section.target });
    const link = unitLink(scope, unitId);
    if (link.status === 'skipped') return result('skipped', { note: link.note });
    return result('fallback', {
      target: link.target,
      note: `Chapter ${chapterNumber} has no section ${sectionNumber}; linked to the chapter`,
    });
  }

  if (groups.chapterList) {
    const listStart = start + text.indexOf(groups.list);
    return [...groups.list.matchAll(/\d+/g)].map((numberMatch) => {
      const number = Number(numberMatch[0]);
      const entryStart = listStart + numberMatch.index;
      const entry = { start: entryStart, end: entryStart + numberMatch[0].length, text: numberMatch[0], label: `Chapter ${number}` };
      const scope = pickScope(index, context, 'chapter', number, suffix);
      const unitId = scope?.chapters.get(number);
      if (!unitId) return { ...entry, status: 'unresolved', note: `Chapter ${number} does not exist` };
      return { ...entry, ...unitLink(scope, unitId) };
    });
  }

  if (groups.chapter) {
    const number = Number(groups.c3);
    const scope = pickScope(index, context, 'chapter', number, suffix);
    const unitId = scope?.chapters.get(number);
    if (!unitId) return result('unresolved', { note: `Chapter ${number} does not exist` });
    return fromLink(unitLink(scope, unitId));
  }

  if (groups.part) {
    const number = Number(groups.p);
    const scope = index.scopes.get(CODE);
    const unitId = scope?.parts.get(number);
    // A part made of several chapters has no single page to open.
    if (!unitId) return result('skipped', { note: `Part ${number} is not a single chapter` });
    return fromLink(unitLink(scope, unitId));
  }

  if (groups.annex) {
    const number = romanToNumber(groups.a);
    const scope = pickScope(index, context, 'annex', number, suffix);
    const unitId = scope?.annexes.get(number);
    if (!unitId) return result('unresolved', { note: `Annex ${groups.a} does not exist` });
    return fromLink(unitLink(scope, unitId));
  }

  if (groups.qa) {
    const number = Number(groups.q);
    const scope = context?.publication === TRANSPARENCY
      ? index.scopes.get(context.documentId)
      : index.scopes.get(CODE);
    const target = scope?.qas.get(number);
    if (!target) return result('unresolved', { note: `Q&A ${number} does not exist` });
    return result('linked', { target });
  }

  if (groups.decimal) {
    // In the Code, "Section 1.1" is a paragraph number, not a section of its own.
    if (context?.publication !== TRANSPARENCY) return result('skipped', { note: 'paragraph number' });
    const scope = index.scopes.get(context.documentId);
    const chapterNumber = Number(groups.dc);
    const sectionNumber = Number(groups.ds);
    const unitId = scope?.chapters.get(chapterNumber);
    if (!unitId) return result('unresolved', { note: `Chapter ${chapterNumber} does not exist` });
    const section = findSection(scope.units.get(unitId), sectionNumber);
    // When the reference quotes a title ("Section 2.2 Aggregate Disclosure"), it must match.
    const quotedTitle = suffix.trim().match(/^[A-Z][A-Za-z-]*/)?.[0]?.toLowerCase();
    const titleMatches = !quotedTitle || section?.normalisedTitle.split(' ')[0] === quotedTitle;
    if (section && titleMatches) return result('linked', { target: section.target });
    const link = unitLink(scope, unitId);
    if (link.status === 'skipped') return result('skipped', { note: link.note });
    return result('fallback', {
      target: link.target,
      note: section
        ? `Section ${chapterNumber}.${sectionNumber} is titled "${section.target.title}"; linked to the chapter`
        : `Chapter ${chapterNumber} has no section ${sectionNumber}; linked to the chapter`,
    });
  }

  return [];
}

const UNLINKED_ELEMENT_TAG = /^<(\/?)(a|button|h[1-6])\b/i;

// Calls onReference for every reference found in the visible text of an HTML fragment, with
// the text that follows it (used to read "... of the Code").
function scanHtml(html, index, context, onText) {
  const parts = String(html).split(/(<[^>]*>)/);
  let unlinkedDepth = 0;
  return parts.map((part, partIndex) => {
    if (part.startsWith('<')) {
      const tag = part.match(UNLINKED_ELEMENT_TAG);
      if (tag) unlinkedDepth = Math.max(0, unlinkedDepth + (tag[1] ? -1 : 1));
      return part;
    }
    if (unlinkedDepth > 0 || !part.trim()) return part;
    let following = '';
    for (let next = partIndex + 1; next < parts.length && following.length < 80; next += 1) {
      if (!parts[next].startsWith('<')) following += parts[next];
    }
    return onText(part, following);
  }).join('');
}

function findInText(text, following, index, context) {
  const found = [];
  for (const match of text.matchAll(REFERENCE_PATTERN)) {
    const suffix = text.slice(match.index + match[0].length) + following;
    found.push(...resolveMatch(match, suffix, index, context));
  }
  return found;
}

/**
 * Lists every reference in an HTML fragment with how it resolves. Used by data validation.
 * context: { publication: 'code' | 'transparency', documentId?, unitId }
 */
export function findCrossReferences(html, { index, context } = {}) {
  const references = [];
  if (!html || !index) return references;
  scanHtml(html, index, context, (text, following) => {
    references.push(...findInText(text, following, index, context));
    return text;
  });
  return references;
}

const escapeAttribute = (value) => String(value)
  .replace(/&/g, '&amp;')
  .replace(/"/g, '&quot;')
  .replace(/</g, '&lt;');

/**
 * Wraps each resolvable reference in a link. The link's href is the real address, so it also
 * works when opened in a new tab; data-reference identifies the target for in-app previews.
 */
export function linkCrossReferences(html, { index, context } = {}) {
  if (!html || !index) return html;
  return scanHtml(html, index, context, (text, following) => {
    const links = findInText(text, following, index, context)
      .filter((reference) => reference.target && (reference.status === 'linked' || reference.status === 'fallback'));
    if (links.length === 0) return text;
    let output = '';
    let cursor = 0;
    links.forEach((reference) => {
      output += text.slice(cursor, reference.start);
      const label = reference.label ? ` aria-label="${escapeAttribute(reference.label)}"` : '';
      output += `<a href="${escapeAttribute(getReferenceHref(reference.target))}" class="cross-reference" data-reference="${escapeAttribute(referenceKey(reference.target))}"${label}>${reference.text}</a>`;
      cursor = reference.end;
    });
    return output + text.slice(cursor);
  });
}

/**
 * Resolves a decision-tree result's citation, such as "Chapter 4 — Q&A 28",
 * "Scope — Section 1" or "Annex VI — Company Events", to the most specific Code target.
 */
export function resolveTreeReference(reference, index) {
  const code = index?.scopes.get(CODE);
  if (!code || !reference) return null;
  const text = plainText(reference);

  const qa = text.match(/Q&A\s*(\d+)/);
  if (qa && code.qas.has(Number(qa[1]))) return code.qas.get(Number(qa[1]));

  const [head, ...rest] = text.split(/\s+[—–]\s+|\s*\/\s*/);
  const detail = rest.join(' ');
  let unitId = null;
  const chapter = head.match(/^Chapter\s*(\d+)/);
  const annex = head.match(/^Annex\s+([IVXL]+)\b/);
  if (chapter) unitId = code.chapters.get(Number(chapter[1])) || null;
  else if (annex) unitId = code.annexes.get(romanToNumber(annex[1])) || null;
  else {
    const wanted = normaliseTitle(head);
    code.units.forEach((unit, id) => {
      if (!unitId && normaliseTitle(unit.target.title) === wanted) unitId = id;
    });
  }
  if (!unitId) return null;
  const unit = code.units.get(unitId);

  const sectionNumber = text.match(/Section\s*(\d+)/);
  if (sectionNumber) {
    const section = findSection(unit, Number(sectionNumber[1]));
    if (section) return section.target;
  }
  const wanted = normaliseTitle(detail);
  // "Chapter 5 — Consulting Arrangements" repeats the chapter's own title: open the chapter.
  if (wanted && wanted !== normaliseTitle(unit.target.ownTitle)) {
    const section = unit.sections.find(({ normalisedTitle }) => normalisedTitle
      && (normalisedTitle === wanted || wanted.includes(normalisedTitle) || normalisedTitle.includes(wanted)));
    if (section) return section.target;
  }
  return unit.target;
}

/**
 * Content for the side panel's view of a target:
 * { label, title, location, html, actionLabel, sections?, qas? }.
 * html is shown straight away: a Q&A, a section's text, or a chapter's summary (empty when the
 * chapter has none). A section also lists its Q&As, and a chapter each of its sections in full
 * ({ key, title, html, qas, target, href }), for the panel to expand on request.
 */
export function describeReferenceTarget(target) {
  if (target.kind === 'qa') {
    return {
      label: 'Q&A',
      title: target.title,
      location: target.location,
      html: `<p><strong>${target.questionHtml.replace(/^\s*Q&(?:amp;)?A\s*\d+\s*:\s*/, '')}</strong></p><p>${target.answerHtml}</p>`,
      actionLabel: 'Go to this Q&A',
    };
  }
  if (target.kind === 'section') {
    return {
      label: 'Section',
      title: target.title,
      location: target.location,
      html: target.html,
      qas: target.qas,
      actionLabel: 'Go to this section',
    };
  }
  return {
    label: 'Chapter',
    title: target.title,
    location: target.location,
    html: target.summaryHtml,
    sections: target.sections.map((section) => ({
      key: referenceKey(section),
      // A chapter's only section is often untitled: it is the chapter's full text.
      title: section.ownTitle || (target.sections.length === 1 ? 'Full text' : section.title),
      html: section.html,
      qas: section.qas,
      target: section,
      href: getReferenceHref(section),
    })),
    actionLabel: 'Open this chapter',
  };
}

// Compact references in decision trees and the checker's small-screen dialog keep a chapter's
// first section visible when it has no summary; the side panel can browse every section.
export function getReferencePreviewHtml(preview) {
  return preview?.html || preview?.sections?.[0]?.html || '';
}
