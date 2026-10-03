import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { tsImport } from 'tsx/esm/api';

const { HubFooter } = await tsImport('../src/components/HubPage.jsx', import.meta.url);
const { CODE_CHAPTERS, WEBSITE_CHAPTERS } = await tsImport('../src/data/codeData.js', import.meta.url);

test('the privacy notice is a website page, kept apart from the Code', () => {
  assert.deepEqual(WEBSITE_CHAPTERS.map((page) => page.id), ['changelog', 'privacy']);
  assert.equal(CODE_CHAPTERS.some((chapter) => chapter.id === 'privacy'), false);
});

test('the footer on Home links to the privacy notice with a real address', () => {
  const markup = renderToStaticMarkup(React.createElement(HubFooter, { onNavigateChapter: () => {} }));

  assert.match(markup, /<nav aria-label="About this website"/);
  assert.match(markup, /<a href="\/code\/privacy"[^>]*>Privacy Notice<\/a>/);
});
