import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { tsImport } from 'tsx/esm/api';

const { TreeResultCard, TREE_ANSWER_NOTE } = await tsImport('../src/components/TreeResultCard.jsx', import.meta.url);
const { LandingPage, OFFICIAL_CODE_URL } = await tsImport('../src/components/LandingPage.jsx', import.meta.url);

const escapeHtml = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

test('every decision-tree answer says it is guidance, whatever its outcome', () => {
  for (const outcome of ['compliant', 'non-compliant', 'conditional', 'consult-legal', 'in-scope', 'more-info']) {
    const markup = renderToStaticMarkup(React.createElement(TreeResultCard, { outcome, text: 'Answer text.' }));
    assert.ok(markup.includes(escapeHtml(TREE_ANSWER_NOTE)), outcome);
  }
  assert.match(TREE_ANSWER_NOTE, /not legal advice or a CVS decision/);
});

test('the Code start page links to the official text and says it prevails', () => {
  const markup = renderToStaticMarkup(React.createElement(LandingPage, { onSelectChapter: () => {} }));

  assert.ok(markup.includes(`href="${OFFICIAL_CODE_URL}" target="_blank" rel="noopener noreferrer"`));
  assert.match(markup, /if the two differ, the PDF prevails\./);
  assert.match(OFFICIAL_CODE_URL, /^https:\/\/www\.medtecheurope\.org\//);
});
