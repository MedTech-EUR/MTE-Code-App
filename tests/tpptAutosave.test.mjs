import test from 'node:test';
import assert from 'node:assert/strict';

import { isEmptyTpptState, saveTpptState, TPPT_AUTOSAVE_KEY } from '../src/utils/tpptAutosave.js';

function createStorage() {
  const items = new Map();
  return {
    items,
    getItem: (key) => (items.has(key) ? items.get(key) : null),
    setItem: (key, value) => items.set(key, String(value)),
    removeItem: (key) => items.delete(key),
  };
}

const EMPTY = { inputText: '', sessions: [], qVenue: null, qStandalone: null, qSize: null };

test('an empty checker counts as empty, whitespace included', () => {
  assert.equal(isEmptyTpptState(EMPTY), true);
  assert.equal(isEmptyTpptState({ ...EMPTY, inputText: '  \n ' }), true);
  assert.equal(isEmptyTpptState({ ...EMPTY, inputText: '09:00 Welcome' }), false);
  assert.equal(isEmptyTpptState({ ...EMPTY, sessions: [{ id: '1' }] }), false);
  assert.equal(isEmptyTpptState({ ...EMPTY, qVenue: 'yes' }), false);
});

test('saving keeps the agenda, and starting over removes what was saved', () => {
  const storage = createStorage();
  const state = { ...EMPTY, inputText: '09:00 Hands-on lab' };

  saveTpptState(storage, state);
  assert.deepEqual(JSON.parse(storage.getItem(TPPT_AUTOSAVE_KEY)), state);

  saveTpptState(storage, EMPTY);
  assert.equal(storage.getItem(TPPT_AUTOSAVE_KEY), null);
  assert.equal(storage.items.size, 0);
});
