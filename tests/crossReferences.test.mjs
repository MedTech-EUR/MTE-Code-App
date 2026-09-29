import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createReferenceIndex,
  describeReferenceTarget,
  findCrossReferences,
  findReferenceTarget,
  getReferenceHref,
  getReferencePreviewHtml,
  linkCrossReferences,
  resolveTreeReference,
} from '../src/utils/crossReferences.js';
import { createGlossaryEntry, processReaderHtml } from '../src/utils/textUtils.js';

// Made-up publications: the rules must hold for any edition of the Code.
const codeChapters = [
  {
    id: 'intro',
    part: 'intro',
    title: 'Introduction',
    icon: 'Info',
    summary: '<p>What the rules are for.</p>',
    sections: [{ title: '1. Purpose', legalText: '<p>Purpose.</p>', qas: [{ q: 'Q&A 1: Why?', a: 'Because.' }] }],
  },
  {
    id: 'ch1',
    part: 'part1',
    title: 'Events',
    icon: '1',
    sections: [
      { title: 'Introductory Text', legalText: '<p>Events.</p>' },
      { title: '1. Venues', legalText: '<p>Venues.</p>' },
      { title: '2. Travel', legalText: '<p>Travel.</p>', qas: [{ q: 'Q&A 2: Which class?', a: 'Economy.' }] },
    ],
  },
  { id: 'ch2', part: 'part1', title: 'Grants', icon: '2', sections: [{ title: '1. Principles', legalText: '<p>Grants.</p>' }] },
  { id: 'ch3', part: 'part1', title: 'Samples', icon: '3', sections: [{ title: '1. Rules', legalText: '<p>Samples.</p>' }] },
  { id: 'part2', part: 'part2', title: 'Complaints', icon: 'Scale', sections: [{ title: '1. Procedure', legalText: '<p>Complaints.</p>' }] },
  { id: 'annex2', part: 'part3', title: 'Annex II: Values', icon: 'FileText', sections: [{ title: 'Values', legalText: '<p>Values.</p>' }] },
];
const transparencyDocuments = [{
  id: 'guidelines',
  title: 'Guidelines',
  units: [
    {
      id: 'g-ch1',
      title: 'Chapter 1: Scope',
      sections: [
        { title: '1. Scope', legalText: '<p>Scope.</p>', qas: [{ label: 'Q&A 3', q: 'Q: Who?', a: 'Members.' }] },
        { title: '2. Applicability', legalText: '<p>Applicability.</p>' },
      ],
    },
    { id: 'g-annex1', title: 'Annex I: Template', sections: [{ title: '', legalText: '<p>Template.</p>' }] },
  ],
}];

const index = createReferenceIndex({ codeChapters, transparencyDocuments });
const inCode = (unitId) => ({ index, context: { publication: 'code', unitId } });
const inGuidelines = (unitId) => ({ index, context: { publication: 'transparency', documentId: 'guidelines', unitId } });
const links = (html) => [...html.matchAll(/<a href="([^"]+)" class="cross-reference" data-reference="([^"]+)"(?: aria-label="([^"]+)")?>([^<]*)<\/a>/g)]
  .map(([, href, key, label, text]) => ({ href, key, label, text }));
const unlink = (html) => html.replace(/<a href="[^"]*" class="cross-reference"[^>]*>([^<]*)<\/a>/g, '$1');

test('links chapter, section, part, annex and Q&A references without changing the text', () => {
  const html = '<p>See Chapter 2; Section 2 of Chapter 1; Chapter 1, Section2; Part 2; Annex II and Q&amp;A 2.</p>';
  const linked = linkCrossReferences(html, inCode('intro'));

  assert.equal(unlink(linked), html);
  assert.deepEqual(links(linked).map(({ text, href }) => [text, href]), [
    ['Chapter 2', '/code/ch2'],
    ['Section 2 of Chapter 1', '/code/ch1#ch1-2-travel'],
    ['Chapter 1, Section2', '/code/ch1#ch1-2-travel'],
    ['Part 2', '/code/part2'],
    ['Annex II', '/code/annex2'],
    ['Q&amp;A 2', '/code/ch1#ch1-2-travel-qa-1'],
  ]);
});

test('links each chapter of a list and names it for screen readers', () => {
  const linked = linkCrossReferences('<p>Chapters 1, 2 and 3 of the Code.</p>', inCode('ch2'));

  // The page never links to itself.
  assert.deepEqual(links(linked).map(({ text, label }) => [text, label]), [
    ['1', 'Chapter 1'],
    ['3', 'Chapter 3'],
  ]);
});

test('leaves a Q&A heading, a paragraph number and the page itself unlinked', () => {
  const found = findCrossReferences(
    '<p>Q&A 2: Which class? This Chapter 1 and Section 1.1 above apply.</p>',
    inCode('ch1'),
  );

  assert.deepEqual(found.map(({ text, status }) => [text, status]), [
    ['Chapter 1', 'skipped'],
    ['Section 1.1', 'skipped'],
  ]);
});

test('reports a missing section as a fallback to its chapter and a missing chapter as unresolved', () => {
  const found = findCrossReferences('<p>Section 5 of Chapter 1 and Chapter 12.</p>', inCode('intro'));

  assert.equal(found[0].status, 'fallback');
  assert.equal(getReferenceHref(found[0].target), '/code/ch1');
  assert.match(found[0].note, /no section 5/);
  assert.equal(found[1].status, 'unresolved');
  assert.equal(found[1].target, undefined);
});

test('in a Transparency publication, reads whose chapter or annex a reference means', () => {
  const linked = linkCrossReferences(
    '<p>Chapter 1 and Annex I here, Chapter 1 of the Code, <em>Section 1 of Chapter 2</em> of the Code, and Q&amp;A 3.</p>',
    inGuidelines('g-annex1'),
  );

  // Its own Chapter 1; "of the Code" means the Code's; it has no Chapter 2, so that is the
  // Code's too; Q&A numbers are the publication's own. "Annex I" is the page itself.
  assert.deepEqual(links(linked).map(({ text, href }) => [text, href]), [
    ['Chapter 1', '/transparency/guidelines/g-ch1'],
    ['Chapter 1', '/code/ch1'],
    ['Section 1 of Chapter 2', '/code/ch2#ch2-1-principles'],
    ['Q&amp;A 3', '/transparency/guidelines/g-ch1#g-ch1-1-scope-qa-1'],
  ]);
});

test('links a numbered Transparency section only when its quoted title matches', () => {
  const found = findCrossReferences(
    '<p>Section 1.2 Applicability and Section 1.1 Retention.</p>',
    inGuidelines('g-annex1'),
  );

  assert.equal(found[0].status, 'linked');
  assert.equal(getReferenceHref(found[0].target), '/transparency/guidelines/g-ch1#g-ch1-2-applicability');
  assert.equal(found[1].status, 'fallback');
  assert.equal(getReferenceHref(found[1].target), '/transparency/guidelines/g-ch1');
});

test('does not link inside existing links or headings', () => {
  const html = '<h3>Chapter 2 rules</h3><p><a href="https://example.org">Chapter 2 online</a></p>';
  assert.equal(linkCrossReferences(html, inCode('intro')), html);
});

test('glossary terms inside a reference link stay plain, and search highlighting skips links', () => {
  const entry = createGlossaryEntry('Grants:', '<p><strong>Grants:</strong> means …</p>');
  const glossaryMap = { [entry.id]: entry };
  const linkReferences = (html) => linkCrossReferences(html, inCode('intro'));

  const processed = processReaderHtml('<p>Grants follow Chapter 2.</p>', { glossaryMap, linkReferences });
  assert.match(processed, /data-term="grants">Grants<\/span> follow <a href="\/code\/ch2"/);

  const highlighted = processReaderHtml('<p>Chapter 2.</p>', { query: 'Chapter', highlight: true, glossaryMap, linkReferences });
  assert.doesNotMatch(highlighted, /cross-reference/);
});

test('resolves decision-tree citations to the most specific target', () => {
  const href = (text) => getReferenceHref(resolveTreeReference(text, index));

  assert.equal(href('Chapter 1 — Q&A 2'), '/code/ch1#ch1-2-travel-qa-1');
  assert.equal(href('Q&A 1'), '/code/intro#intro-1-purpose-qa-1');
  assert.equal(href('Chapter 1, Section 1 — Venue rules'), '/code/ch1#ch1-1-venues');
  assert.equal(href('Chapter 1 — Travel (2)'), '/code/ch1#ch1-2-travel');
  assert.equal(href('Chapter 1 — Events'), '/code/ch1');
  assert.equal(href('Introduction — Purpose'), '/code/intro#intro-1-purpose');
  assert.equal(href('Annex II'), '/code/annex2');
  assert.equal(resolveTreeReference('Chapter 9 — Missing', index), null);
});

test('finds preview targets for search result anchors and describes them', () => {
  const qa = findReferenceTarget(index, { publication: 'code', unitId: 'ch1', anchor: 'ch1-2-travel-qa-1' });
  assert.equal(qa.kind, 'qa');
  assert.match(describeReferenceTarget(qa).html, /Which class\?/);
  assert.doesNotMatch(describeReferenceTarget(qa).html, /Q&A 2:/);

  const chapter = findReferenceTarget(index, { publication: 'code', unitId: 'intro' });
  assert.equal(describeReferenceTarget(chapter).label, 'Chapter');
  assert.equal(describeReferenceTarget(chapter).html, '<p>What the rules are for.</p>');

  const section = findReferenceTarget(index, {
    publication: 'transparency',
    documentId: 'guidelines',
    unitId: 'g-ch1',
    anchor: 'g-ch1-2-applicability',
  });
  assert.equal(section.location, 'Chapter 1: Scope');
});

test('describes a chapter with each of its sections in full, and a section with its Q&As', () => {
  const chapter = describeReferenceTarget(findReferenceTarget(index, { publication: 'code', unitId: 'ch1' }));

  // No summary: the panel opens the first section instead.
  assert.equal(chapter.html, '');
  assert.deepEqual(chapter.sections.map(({ title, html, href }) => [title, html, href]), [
    ['Introductory Text', '<p>Events.</p>', '/code/ch1#ch1-introductory-text'],
    ['1. Venues', '<p>Venues.</p>', '/code/ch1#ch1-1-venues'],
    ['2. Travel', '<p>Travel.</p>', '/code/ch1#ch1-2-travel'],
  ]);
  assert.deepEqual(chapter.sections[2].qas, [{ label: '', questionHtml: 'Q&A 2: Which class?', answerHtml: 'Economy.' }]);
  assert.equal(chapter.sections[2].target.kind, 'section');

  // A chapter's only, untitled section is its full text.
  const annex = describeReferenceTarget(findReferenceTarget(index, {
    publication: 'transparency',
    documentId: 'guidelines',
    unitId: 'g-annex1',
  }));
  assert.deepEqual(annex.sections.map(({ title, href }) => [title, href]), [
    ['Full text', '/transparency/guidelines/g-annex1#g-annex1-section-0'],
  ]);

  const section = describeReferenceTarget(findReferenceTarget(index, {
    publication: 'transparency',
    documentId: 'guidelines',
    unitId: 'g-ch1',
    anchor: 'g-ch1-1-scope',
  }));
  assert.equal(section.html, '<p>Scope.</p>');
  assert.deepEqual(section.qas, [{ label: 'Q&A 3', questionHtml: 'Q: Who?', answerHtml: 'Members.' }]);
});

test('compact reference previews retain text when a chapter has no summary', () => {
  const describe = (unitId, anchor) => describeReferenceTarget(findReferenceTarget(index, {
    publication: 'code', unitId, anchor,
  }));

  assert.equal(getReferencePreviewHtml(describe('intro')), '<p>What the rules are for.</p>');
  assert.equal(getReferencePreviewHtml(describe('ch1')), '<p>Events.</p>');
  assert.equal(getReferencePreviewHtml(describe('ch1', 'ch1-2-travel')), '<p>Travel.</p>');
  assert.match(getReferencePreviewHtml(describe('ch1', 'ch1-2-travel-qa-1')), /Economy\./);
  assert.equal(getReferencePreviewHtml(null), '');
  assert.equal(getReferencePreviewHtml({ html: '', sections: [] }), '');
});
