import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildQaTitle,
  formatCitation,
  formatQaPlainText,
  getQaNumberLabel,
} from '../src/utils/citationText.js';

test('getQaNumberLabel reads the printed Q&A number from a label or the question', () => {
  assert.equal(getQaNumberLabel({ label: 'Q&A 8', q: 'Q: In what currency…?' }), 'Q&A 8');
  assert.equal(getQaNumberLabel({ q: 'Q&A 31: Can an Educational Grant…?' }), 'Q&A 31');
  assert.equal(getQaNumberLabel({ q: '<strong>Q&amp;A 4:</strong> Do the…' }), 'Q&A 4');
  assert.equal(getQaNumberLabel({ q: 'Is it appropriate…? See Q&A 3.' }), '', 'only a number the question opens with');
  assert.equal(getQaNumberLabel(undefined), '');
});

test('buildQaTitle names the section and the Q&A', () => {
  assert.equal(buildQaTitle('Ch 4 - 3. Educational Grants', { q: 'Q&A 31: Can…?' }), 'Ch 4 - 3. Educational Grants, Q&A 31');
  assert.equal(buildQaTitle('Scope', { q: 'Untitled question?' }), 'Scope, Q&A');
});

test('formatQaPlainText labels the question and answer once', () => {
  assert.equal(
    formatQaPlainText({ question: 'Q&A 31: Can an Educational Grant…?', answer: 'A: Yes, provided…' }),
    'Q&A 31: Can an Educational Grant…?\nA: Yes, provided…\n',
  );
  assert.equal(
    formatQaPlainText({ label: 'Q&A 8', question: 'Q: In what currency…?', answer: 'In the currency…' }),
    'Q&A 8\nQ: In what currency…?\nA: In the currency…\n',
  );
  assert.equal(formatQaPlainText({ question: 'Which Affiliate…?', answer: 'The one…' }), 'Q: Which Affiliate…?\nA: The one…\n');
});

test('formatCitation builds each Cite/Link format', () => {
  const citation = {
    sourceTitle: 'MedTech Europe Code of Ethical Business Practice',
    markdownLabel: 'MedTech Europe Code',
    title: 'Ch 4 - 3. Educational Grants, Q&A 31',
    url: 'https://medtecheurope-code.org/code/ch4#ch4-3-educational-grants-qa-3',
    date: new Date('2026-10-21T10:00:00Z'),
  };
  assert.equal(
    formatCitation('formal', citation),
    'MedTech Europe Code of Ethical Business Practice, Ch 4 - 3. Educational Grants, Q&A 31. (Accessed 21 October 2026). Available at: https://medtecheurope-code.org/code/ch4#ch4-3-educational-grants-qa-3',
  );
  assert.equal(
    formatCitation('markdown', citation),
    '[Ch 4 - 3. Educational Grants, Q&A 31 - MedTech Europe Code](https://medtecheurope-code.org/code/ch4#ch4-3-educational-grants-qa-3)',
  );
  assert.equal(formatCitation('url', citation), citation.url);
});
