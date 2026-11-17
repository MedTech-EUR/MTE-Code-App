import test from 'node:test';
import assert from 'node:assert/strict';

import {
  describeBookmark,
  describeRecentPage,
  formatChapterTitle,
  selectReturnVisit,
} from '../src/utils/returnVisit.js';

test('numbered Code chapters read as "Chapter N: title"; other pages keep their title', () => {
  assert.equal(formatChapterTitle({ icon: '4', title: 'Grants' }), 'Chapter 4: Grants');
  assert.equal(formatChapterTitle({ icon: 'Globe', title: 'Scope' }), 'Scope');
  assert.equal(
    formatChapterTitle({ icon: '1', title: 'Applicability', displayTitle: 'Chapter 1: Applicability', section: 'transparency' }),
    'Chapter 1: Applicability',
  );
  assert.equal(formatChapterTitle(undefined), '');
});

test('a recent page says which publication it belongs to', () => {
  assert.deepEqual(describeRecentPage({ icon: '2', title: 'Events', section: 'code' }), {
    title: 'Chapter 2: Events',
    note: 'The Code',
  });
  assert.equal(describeRecentPage({ icon: 'Info', title: 'Preamble', section: 'transparency' }).note, 'Transparency');
});

test('a bookmark names the chapter or unit it is in, and still shows when that is gone', () => {
  const lookups = {
    findChapter: (id) => (id === 'ch1' ? { id, icon: '1', title: 'General Criteria' } : undefined),
    findTransparencyUnit: (doc, id) => (doc === 'dg' && id === 'u1' ? { id, title: 'Preamble' } : undefined),
  };
  assert.deepEqual(describeBookmark({ title: '3. Guests', chapterId: 'ch1', section: 'code' }, lookups), {
    title: '3. Guests',
    note: 'Chapter 1: General Criteria',
  });
  assert.equal(describeBookmark({ title: 'x', chapterId: 'u1', documentId: 'dg', section: 'transparency' }, lookups).note, 'Preamble');
  assert.equal(describeBookmark({ title: 'x', chapterId: 'gone', section: 'code' }, lookups).note, undefined);
});

test('the Home page lists at most three of each and counts the bookmarks left out', () => {
  const five = [1, 2, 3, 4, 5].map((n) => ({ id: String(n) }));
  const { pages, bookmarks, moreBookmarks } = selectReturnVisit(five, five);
  assert.deepEqual(pages.map((p) => p.id), ['1', '2', '3']);
  assert.equal(bookmarks.length, 3);
  assert.equal(moreBookmarks, 2);
  assert.deepEqual(selectReturnVisit(), { pages: [], bookmarks: [], moreBookmarks: 0 });
});
