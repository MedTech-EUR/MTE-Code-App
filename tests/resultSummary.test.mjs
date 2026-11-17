import test from 'node:test';
import assert from 'node:assert/strict';

import {
  GUIDANCE_NOTE,
  buildResultSummary,
  buildTreeSummary,
  formatSummaryDate,
} from '../src/utils/resultSummary.js';

const DATE = new Date('2026-11-17T10:00:00Z');

test('the date is written out in British English', () => {
  assert.equal(formatSummaryDate(DATE), '17 November 2026');
});

test('a decision-tree summary lists the answers, the result and its reference, then the link and the note', () => {
  const text = buildTreeSummary({
    title: 'Is My Event Location Compliant?',
    steps: [
      { question: 'Is the event in Europe?', answer: 'Yes' },
      { question: 'Is the venue  a leisure venue?', answer: 'Yes — it is primarily a leisure venue' },
    ],
    outcomeLabel: 'Non-Compliant',
    text: 'Venues known primarily for leisure are not compliant.',
    reference: 'Chapter 1, Section 2',
    url: 'https://medtecheurope-code.org/trees/dt-ch1-event-location',
    date: DATE,
  });
  assert.equal(text, [
    'Is My Event Location Compliant?',
    'The Code App · 17 November 2026',
    '',
    'Your answers',
    '1. Is the event in Europe?',
    '   Yes',
    '2. Is the venue a leisure venue?',
    '   Yes — it is primarily a leisure venue',
    '',
    'Result: Non-Compliant',
    'Venues known primarily for leisure are not compliant.',
    'Reference: Chapter 1, Section 2',
    '',
    'https://medtecheurope-code.org/trees/dt-ch1-event-location',
    '',
    GUIDANCE_NOTE,
    '',
  ].join('\n'));
});

test('empty lines and sections are left out', () => {
  const text = buildResultSummary({
    title: 'Check',
    date: DATE,
    sections: [
      { heading: 'Still to confirm', lines: [] },
      { heading: 'Conditions', lines: ['', { label: 'Reference', value: '' }, 'Kept'] },
    ],
  });
  assert.doesNotMatch(text, /Still to confirm|Reference/);
  assert.match(text, /Conditions\nKept/);
  assert.ok(text.trimEnd().endsWith(GUIDANCE_NOTE));
});
