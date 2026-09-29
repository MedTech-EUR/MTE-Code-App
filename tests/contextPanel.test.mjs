import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { register } from 'tsx/esm/api';

import {
  createReferenceIndex,
  describeReferenceTarget,
  findReferenceTarget,
  getReferenceHref,
  referenceKey,
} from '../src/utils/crossReferences.js';

// ContextPanel.jsx is loaded through tsx, as in tests/glossaryInteraction.test.mjs. DOMPurify
// needs a browser DOM, which Node lacks, so text is passed through unchanged here.
const panelModules = register({ namespace: 'context-panel-test' });
const { default: DOMPurify } = await panelModules.import('dompurify', import.meta.url);
DOMPurify.sanitize = (html) => html;
const { ContextPanel } = await panelModules.import('../src/components/ContextPanel.jsx', import.meta.url);

// Made-up publications: the rules must hold for any edition of the Code.
const index = createReferenceIndex({
  codeChapters: [
    {
      id: 'ch1',
      part: 'part1',
      title: 'Events',
      icon: '1',
      summary: '<p>What the chapter is about.</p>',
      sections: [
        { title: '1. Venues', legalText: '<p>Venue text.</p>' },
        { title: '2. Travel', legalText: '<p>Travel text.</p>', qas: [{ q: 'Q&A 2: Which class?', a: 'Economy.' }] },
      ],
    },
    { id: 'ch2', part: 'part1', title: 'Royalties', icon: '2', sections: [{ title: '', legalText: '<p>Royalty text.</p>' }] },
  ],
  transparencyDocuments: [{
    id: 'guidelines',
    title: 'Guidelines',
    units: [{
      id: 'g-ch1',
      title: 'Chapter 1: Scope',
      sections: [
        { title: '1. Scope', legalText: '<p>Scope text.</p>' },
        { title: '2. Applicability', legalText: '<p>Applicability text.</p>' },
      ],
    }],
  }],
});

const render = (address) => {
  const target = findReferenceTarget(index, address);
  const item = { key: referenceKey(target), ...describeReferenceTarget(target), target, href: getReferenceHref(target) };
  return renderToStaticMarkup(React.createElement(ContextPanel, { key: item.key, item, onClose: () => {} }));
};
const rows = (markup) => [...markup.matchAll(/aria-expanded="(true|false)"[^>]*>.*?<span class="block text-\[13px\][^"]*">([^<]*)<\/span>/g)]
  .map(([, open, title]) => [title, open === 'true']);

test('a chapter lists its summary and sections; the summary starts open', () => {
  const markup = render({ publication: 'code', unitId: 'ch1' });

  assert.deepEqual(rows(markup), [['Summary', true], ['1. Venues', false], ['2. Travel', false]]);
  assert.match(markup, /What the chapter is about\./);
  assert.doesNotMatch(markup, /Venue text\.|Travel text\./);
  assert.match(markup, />Expand all</);
  assert.match(markup, />1 Q&amp;A</);
});

test('a chapter without a summary starts with its first section open', () => {
  const markup = render({ publication: 'transparency', documentId: 'guidelines', unitId: 'g-ch1' });

  assert.deepEqual(rows(markup), [['1. Scope', true], ['2. Applicability', false]]);
  assert.match(markup, /Scope text\./);
  assert.doesNotMatch(markup, /Applicability text\./);
  assert.match(markup, /href="\/transparency\/guidelines\/g-ch1#g-ch1-1-scope"[^>]*>Go to this section/);
});

test('a chapter that is a single section without a summary shows its text, as a section does', () => {
  const markup = render({ publication: 'code', unitId: 'ch2' });

  assert.deepEqual(rows(markup), []);
  assert.match(markup, /Royalty text\./);
  assert.doesNotMatch(markup, /In this chapter|Expand all|Go to this section/);
});

test('a section shows its text, with its Q&As one step away', () => {
  const markup = render({ publication: 'code', unitId: 'ch1', anchor: 'ch1-2-travel' });

  assert.match(markup, /Travel text\./);
  assert.deepEqual(rows(markup), [['1 Q&amp;A', false]]);
  assert.doesNotMatch(markup, /Economy\./);
});
