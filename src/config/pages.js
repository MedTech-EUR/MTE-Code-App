import { FULL_CODE_DATA } from '../data/codeData';
import { TRANSPARENCY_DOCUMENTS } from '../data/transparency/transparencyData';
import { TREE_DATA } from '../data/treeData';
import { createPageList, pagePathOf } from '../utils/pageMeta';

export const PAGES = createPageList({
  chapters: FULL_CODE_DATA,
  trees: TREE_DATA,
  transparencyDocuments: TRANSPARENCY_DOCUMENTS,
});

const PAGES_BY_PATH = new Map(PAGES.map((page) => [page.path, page]));

/** The page a route's canonical URL shows; the home page for any URL that is not listed. */
export function getPageForUrl(url) {
  return PAGES_BY_PATH.get(pagePathOf(url)) ?? PAGES_BY_PATH.get('/');
}
