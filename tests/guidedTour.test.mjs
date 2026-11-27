import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { register } from 'tsx/esm/api';

const loader = register({ namespace: 'guided-tour-test' });
const { TPPTContent } = await loader.import('../src/components/TPPTContent.tsx', import.meta.url);
const renderAgenda = (practice) => renderToStaticMarkup(React.createElement(TPPTContent, { practice }));

test('the practice checker opens its own sample and the ordinary checker immediately restores the saved agenda', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  let reads = 0;
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem(key) {
        assert.equal(key, 'tppt_autosave_state');
        reads++;
        return JSON.stringify({ inputText: 'Draft for the annual workshop', sessions: [] });
      },
    },
  });
  try {
    const sample = renderAgenda(true);
    assert.match(sample, /Hands-on workshop/);
    assert.doesNotMatch(sample, /Draft for the annual workshop/);
    assert.equal(reads, 0);
    assert.match(renderAgenda(false), /Draft for the annual workshop/);
    assert.equal(reads, 1);
  } finally {
    if (original) Object.defineProperty(globalThis, 'localStorage', original);
    else delete globalThis.localStorage;
  }
});
