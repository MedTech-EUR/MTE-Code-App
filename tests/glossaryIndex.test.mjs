import test from 'node:test';
import assert from 'node:assert/strict';

import { firstLetter, matchesTerm } from '../src/utils/glossaryIndex.js';

test('a term is listed under its first letter, in capitals and without accents', () => {
  assert.equal(firstLetter('Charitable Donations'), 'C');
  assert.equal(firstLetter('éducation'), 'E');
  assert.equal(firstLetter('"Quoted" Term'), 'Q');
  assert.equal(firstLetter(''), '');
});

test('every typed word must appear in the term, in any order and any case', () => {
  assert.ok(matchesTerm('Healthcare Professional (HCP)', 'hcp'));
  assert.ok(matchesTerm('Healthcare Professional (HCP)', 'professional health'));
  assert.ok(!matchesTerm('Healthcare Professional (HCP)', 'organisation'));
  assert.ok(matchesTerm('Anything', '   '));
});
