/**
 * Where the build keeps each page's own HTML (scripts/prerender-pages.mjs) and how the Worker
 * (server.js) finds it. The files are served under the page's address, never their own.
 */
export const PRERENDERED_DIRECTORY = 'prerendered';

const PRERENDERED_PREFIX = `/${PRERENDERED_DIRECTORY}`;

/** The file the build writes for a page path, relative to dist/. */
export function prerenderedFileFor(pagePath) {
  return pagePath === '/'
    ? `${PRERENDERED_DIRECTORY}/index.html`
    : `${PRERENDERED_DIRECTORY}${pagePath}.html`;
}

/**
 * The static-assets path that serves a page's file. The assets binding serves "x.html" at "x"
 * and "index.html" at its folder, and redirects the ".html" spellings.
 */
export function prerenderedAssetPathFor(pathname) {
  return pathname === '/' ? `${PRERENDERED_PREFIX}/` : `${PRERENDERED_PREFIX}${pathname}`;
}

export function isPrerenderedFilePath(pathname) {
  return pathname === PRERENDERED_PREFIX || pathname.startsWith(`${PRERENDERED_PREFIX}/`);
}
