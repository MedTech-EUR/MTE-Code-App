// After `vite build`: writes each page's own HTML (title, description, canonical address and
// text) to dist/prerendered/, which the Worker serves at the page's address, and the sitemap
// listing them. Runs after the service worker is generated, so these files are not precached:
// the installed app keeps using index.html. See ROUTING.md, "Hosting Requirement".
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PRERENDERED_DIRECTORY, prerenderedFileFor } from '../prerendered-pages.js';
import { createPageList } from '../src/utils/pageMeta.js';
import { loadSplitCodeData } from './lib/code-content.mjs';
import { renderPageHtml, renderSitemap } from './lib/prerender.mjs';
import { loadTransparencyData } from './lib/transparency-content.mjs';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const distDirectory = resolve(projectRoot, 'dist');

const pages = createPageList({
  chapters: loadSplitCodeData(projectRoot).chapters,
  trees: JSON.parse(readFileSync(resolve(projectRoot, 'src/data/treeData.json'), 'utf8')).trees,
  transparencyDocuments: loadTransparencyData(projectRoot),
});

const template = readFileSync(resolve(distDirectory, 'index.html'), 'utf8');

rmSync(resolve(distDirectory, PRERENDERED_DIRECTORY), { recursive: true, force: true });
for (const page of pages) {
  const file = resolve(distDirectory, prerenderedFileFor(page.path));
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, renderPageHtml(template, page, pages));
}

writeFileSync(resolve(distDirectory, 'sitemap.xml'), renderSitemap(pages));

console.log(`Wrote ${pages.length} pages to dist/${PRERENDERED_DIRECTORY}/ and dist/sitemap.xml.`);
