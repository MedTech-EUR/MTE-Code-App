import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { tsImport } from 'tsx/esm/api';

const { HubFooter } = await tsImport('../src/components/HubPage.jsx', import.meta.url);
const { CODE_CHAPTERS, WEBSITE_CHAPTERS } = await tsImport('../src/data/codeData.js', import.meta.url);

test('the legal and privacy notices are website pages, kept apart from the Code', () => {
  assert.deepEqual(WEBSITE_CHAPTERS.map((page) => page.id), ['changelog', 'legal-notice', 'privacy']);
  assert.equal(CODE_CHAPTERS.some((chapter) => ['legal-notice', 'privacy'].includes(chapter.id)), false);
});

test('the footer on Home links to the legal and privacy notices with real addresses', () => {
  const markup = renderToStaticMarkup(React.createElement(HubFooter, { onNavigateChapter: () => {} }));

  assert.match(markup, /<nav aria-label="About this website"/);
  assert.match(markup, /<a href="\/code\/legal-notice"[^>]*>Legal Notice<\/a>.*<a href="\/code\/privacy"[^>]*>Privacy Notice<\/a>/);
});
