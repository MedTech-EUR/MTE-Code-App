/**
 * What the Home page shows a returning reader: the pages they read last and their bookmarks,
 * as saved by useRecentHistory and useBookmarks. Pure, so it can be tested without the data:
 * the caller passes the lookups for chapters and Transparency units.
 */

/** How many recent pages and bookmarks the Home page lists. */
export const RETURN_VISIT_LIMIT = 3;

const isChapterNumber = (icon) => icon !== undefined && icon !== null && icon !== ''
  && !Number.isNaN(Number(icon));

/** "Chapter 4: Grants and Charitable Donations" for a numbered Code chapter, else its title. */
export function formatChapterTitle(chapter) {
  if (!chapter) return '';
  return isChapterNumber(chapter.icon) && (chapter.section || 'code') === 'code'
    ? `Chapter ${chapter.icon}: ${chapter.title}`
    : chapter.displayTitle || chapter.title;
}

/** A recently viewed page as a Home page row: its title and which publication it is in. */
export function describeRecentPage(entry) {
  return {
    title: formatChapterTitle(entry),
    note: entry.section === 'transparency' ? 'Transparency' : 'The Code',
  };
}

/**
 * A bookmark as a Home page row: the section's title, and the chapter or unit it is in.
 * `findChapter(id)` and `findTransparencyUnit(documentId, id)` return the item or undefined.
 */
export function describeBookmark(bookmark, { findChapter, findTransparencyUnit }) {
  const parent = bookmark.section === 'transparency'
    ? findTransparencyUnit?.(bookmark.documentId, bookmark.chapterId)
    : findChapter?.(bookmark.chapterId);
  return {
    title: bookmark.title,
    note: parent ? formatChapterTitle({ ...parent, section: bookmark.section || 'code' }) : undefined,
  };
}

/** The entries to list, newest first for pages and in saved order for bookmarks. */
export function selectReturnVisit(recentHistory = [], bookmarks = [], limit = RETURN_VISIT_LIMIT) {
  return {
    pages: recentHistory.slice(0, limit),
    bookmarks: bookmarks.slice(0, limit),
    moreBookmarks: Math.max(0, bookmarks.length - limit),
  };
}
