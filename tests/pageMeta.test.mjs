import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { prerenderedAssetPathFor, prerenderedFileFor } from '../prerendered-pages.js';
import { loadSplitCodeData } from '../scripts/lib/code-content.mjs';
import {
  renderPageHtml,
  renderSitemap,
  sanitizeContentHtml,
} from '../scripts/lib/prerender.mjs';
import { loadTransparencyData } from '../scripts/lib/transparency-content.mjs';
import { htmlToPlainText } from '../src/utils/htmlTextUtils.js';
import {
  createPageList,
  HOME_DESCRIPTION,
  HOME_TITLE,
  pagePathOf,
  SITE_ORIGIN,
  summarizeHtml,
} from '../src/utils/pageMeta.js';
import { createRouteUtils } from '../src/utils/routeUtils.js';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const chapters = loadSplitCodeData(projectRoot).chapters;
const trees = JSON.parse(readFileSync(resolve(projectRoot, 'src/data/treeData.json'), 'utf8')).trees;
const transparencyDocuments = loadTransparencyData(projectRoot);
const pages = createPageList({ chapters, trees, transparencyDocuments });
const { parseAppLocation } = createRouteUtils(chapters, trees, transparencyDocuments);
const indexHtml = readFileSync(resolve(projectRoot, 'index.html'), 'utf8');

test('index.html keeps the home page title and description', () => {
  assert.ok(indexHtml.includes(`<title>${HOME_TITLE}</title>`));
  assert.ok(indexHtml.includes(`<meta name="description" content="${HOME_DESCRIPTION}" />`));
});

test('every page is a canonical app route, listed once', () => {
  const paths = pages.map((page) => page.path);
  assert.equal(new Set(paths).size, paths.length);

  for (const page of pages) {
    const route = parseAppLocation(page.path, '');
    assert.equal(pagePathOf(route.canonicalUrl), page.path, `${page.path} should be canonical`);
  }
});

test('every chapter, decision tree and reader unit has a page', () => {
  const paths = new Set(pages.map((page) => page.path));
  chapters.forEach((chapter) => assert.ok(paths.has(`/code/${chapter.id}`), chapter.id));
  trees.forEach((tree) => assert.ok(paths.has(`/trees/${tree.id}`), tree.id));
  transparencyDocuments.forEach((document) => {
    document.units.forEach((unit) => {
      assert.ok(paths.has(`/transparency/${document.id}/${unit.id}`), unit.id);
    });
  });
  ['/', '/code', '/trees', '/event-support', '/transparency', '/quiz', '/tppt'].forEach((path) => {
    assert.ok(paths.has(path), path);
  });
});

test('every page has its own title and a description that fits search results', () => {
  const titles = pages.map((page) => page.title);
  assert.equal(new Set(titles).size, titles.length);

  for (const page of pages) {
    assert.ok(page.heading, `${page.path} heading`);
    assert.ok(page.description, `${page.path} description`);
    assert.ok(page.description.length <= 160, `${page.path} description is ${page.description.length} characters`);
    assert.doesNotMatch(page.description, /[<>]/, `${page.path} description has no tags`);
  }
});

test('summarizeHtml shortens at a word boundary', () => {
  assert.equal(summarizeHtml('<p><strong>Key:</strong> short text .</p>'), 'Key: short text.');
  const long = summarizeHtml(`<p>${'word '.repeat(60)}</p>`, 40);
  assert.ok(long.length <= 40);
  assert.match(long, /^(word )*word…$/);
});

test('page files and the addresses that serve them line up', () => {
  assert.equal(prerenderedFileFor('/'), 'prerendered/index.html');
  assert.equal(prerenderedAssetPathFor('/'), '/prerendered/');
  assert.equal(prerenderedFileFor('/code/ch4'), 'prerendered/code/ch4.html');
  assert.equal(prerenderedAssetPathFor('/code/ch4'), '/prerendered/code/ch4');
});

test('sanitizeContentHtml keeps structure and drops everything that could run or escape', () => {
  assert.equal(
    sanitizeContentHtml('<ul class="list-disc"><li onclick="x()"><strong>A</strong> &amp; b</li></ul>'),
    '<ul><li><strong>A</strong> &amp; b</li></ul>',
  );
  assert.equal(sanitizeContentHtml('a<script>alert(1)</script>b<!-- c -->'), 'ab');
  assert.equal(sanitizeContentHtml('<a href="javascript:x()">link</a> <img src=x onerror=y>'), 'link ');
  assert.equal(sanitizeContentHtml('x <img src=x onerror=alert(1)'), 'x &lt;img src=x onerror=alert(1)');
  assert.equal(sanitizeContentHtml('</div></div><p>text'), '<p>text</p>');
  assert.equal(sanitizeContentHtml('<div><p>a</div>'), '<div><p>a</p></div>');
  assert.equal(
    sanitizeContentHtml('<td colspan="2" style="x" rowspan=3>c</td>'),
    '<td colspan="2" rowspan="3">c</td>',
  );
});

test('each page file has its title, description, canonical address and full text', () => {
  // As the build leaves it: Vite moves the entry script into the head.
  const template = indexHtml
    .replace(/\s*<script type="module" src="\/src\/main.jsx"><\/script>/, '')
    .replace('</head>', '<script type="module" src="/assets/index.js"></script></head>');
  const visibleText = (html) => htmlToPlainText(html).replace(/\s+/g, ' ');

  for (const page of pages) {
    const html = renderPageHtml(template, page, pages);
    const canonical = `${SITE_ORIGIN}${page.path}`;

    assert.equal(html.match(/<title>/g).length, 1);
    assert.ok(html.includes(`<link rel="canonical" href="${canonical}" />`), page.path);
    assert.ok(html.includes(`<meta property="og:url" content="${canonical}" />`), page.path);
    assert.ok(html.includes('<script type="module" src="/assets/index.js"></script>'), page.path);
    assert.match(html, /<div id="root"><div class="prerendered">[\s\S]*<\/div><\/div>\s*<\/body>/);

    const text = visibleText(html);
    const sections = page.chapter?.sections || page.unit?.sections || [];
    for (const section of sections) {
      const opening = htmlToPlainText(section.legalText).replace(/\s+/g, ' ').trim().slice(0, 60);
      assert.ok(text.includes(opening), `${page.path} should include "${opening}"`);
      (section.qas || []).forEach((qa) => {
        const question = htmlToPlainText(qa.q).replace(/\s+/g, ' ').trim();
        assert.ok(text.includes(question), `${page.path} should include "${question}"`);
      });
    }
  }
});

test('renderPageHtml stops the build when index.html loses a tag it fills in', () => {
  assert.throws(
    () => renderPageHtml(indexHtml.replace('<div id="root"></div>', '<div id="app"></div>'), pages[0], pages),
    /empty <div id="root">/,
  );
});

test('the sitemap lists every page at its canonical address', () => {
  const sitemap = renderSitemap(pages);
  const locations = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  assert.deepEqual(locations, pages.map((page) => `${SITE_ORIGIN}${page.path}`));
});
