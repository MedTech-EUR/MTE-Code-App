/**
 * Pages of this app that have moved to another site. The Worker (server.js) redirects their old
 * addresses, and the app does the same when it is opened at one from its offline copy
 * (src/main.jsx), so existing links and bookmarks keep working.
 */

/**
 * The CVS and e4ethics check on ethicalmedtech.eu. It replaced this app's decision tree
 * "Conference Vetting System check" (dt-annex1-cvs-scope) in November 2026, so the check is kept
 * in one place; the Home Hub card and the sidebar entry open it.
 */
export const CVS_CHECK_URL = 'https://www.ethicalmedtech.eu/cvs-e4ethics-check/';

const MOVED_PATHS = Object.freeze({
  '/trees/dt-annex1-cvs-scope': CVS_CHECK_URL,
});
// Old links to a decision tree named it after "#" on the home page.
const MOVED_HASHES = Object.freeze({
  '#dt-annex1-cvs-scope': CVS_CHECK_URL,
});

/** Where a moved page now lives, or null. Takes a URL or the browser's `location`. */
export function movedPageUrl({ pathname = '/', hash = '' } = {}) {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  if (Object.hasOwn(MOVED_PATHS, path)) return MOVED_PATHS[path];
  if (path === '/' && Object.hasOwn(MOVED_HASHES, hash)) return MOVED_HASHES[hash];
  return null;
}
