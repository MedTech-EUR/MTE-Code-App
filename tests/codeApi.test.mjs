import test from 'node:test';
import assert from 'node:assert/strict';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import worker from '../server.js';
import { CODE_API_FILES, CODE_API_PATH, codeApiAssetPathFor, handleCodeApiRequest } from '../code-api.js';
import { apiHtml, apiText, buildCodeApiFiles } from '../scripts/lib/code-api.mjs';
import { loadSplitCodeData } from '../scripts/lib/code-content.mjs';
import { CODE_EDITION } from '../src/data/codeEdition.js';
import { WEBSITE_PART_ID } from '../src/data/codeOrder.js';
import { generateSectionId, getQaAnchorId } from '../src/utils/textUtils.js';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { chapters } = loadSplitCodeData(projectRoot);
const files = buildCodeApiFiles(chapters);
const fileData = (file) => files.find((entry) => entry.file === file)?.data;
const codeChapters = chapters.filter((chapter) => chapter.part !== WEBSITE_PART_ID);
const whole = fileData(CODE_API_FILES.code);

// ---- The files the build writes ----

test('writes an index, the whole Code and one file per Code chapter, without website pages', () => {
  assert.deepEqual(
    files.map((entry) => entry.file).sort(),
    [CODE_API_FILES.index, CODE_API_FILES.code, ...codeChapters.map((chapter) => CODE_API_FILES.chapter(chapter.id))].sort(),
  );
  assert.deepEqual(whole.chapters.map((chapter) => chapter.id), codeChapters.map((chapter) => chapter.id));
  assert.ok(chapters.some((chapter) => chapter.part === WEBSITE_PART_ID), 'the data still has a website page to leave out');
});

test('keeps every section and Q&A, under the same IDs as their links in the app', () => {
  const ids = new Set();
  for (const [chapterIndex, source] of codeChapters.entries()) {
    const chapter = whole.chapters[chapterIndex];
    assert.equal(chapter.sections.length, source.sections.length, source.id);
    for (const [sectionIndex, section] of source.sections.entries()) {
      const apiSection = chapter.sections[sectionIndex];
      const sectionId = generateSectionId(source.id, section.title, sectionIndex);
      assert.equal(apiSection.id, sectionId);
      assert.equal(apiSection.url, `https://medtecheurope-code.org/code/${source.id}#${sectionId}`);
      assert.equal(apiSection.qas.length, (section.qas || []).length, sectionId);
      ids.add(apiSection.id);
      for (const [qaIndex, qa] of apiSection.qas.entries()) {
        assert.equal(qa.id, getQaAnchorId(sectionId, qaIndex));
        ids.add(qa.id);
      }
    }
  }
  const count = whole.chapters.reduce((sum, chapter) => (
    sum + chapter.sections.length + chapter.sections.reduce((qas, section) => qas + section.qas.length, 0)
  ), 0);
  assert.equal(ids.size, count, 'every ID is used once');
});

test('gives a Q&A its printed label apart from its question', () => {
  const qas = whole.chapters.flatMap((chapter) => chapter.sections.flatMap((section) => section.qas));
  assert.ok(qas.length > 0);
  for (const qa of qas) {
    if (qa.label) {
      assert.match(qa.label, /^Q&A \d+$/);
      assert.doesNotMatch(qa.question, /^Q&A\s*\d/);
    }
    assert.ok(qa.question.length > 0, qa.id);
  }
});

test('serves the text with its structure only, and as plain text', () => {
  const texts = whole.chapters.flatMap((chapter) => chapter.sections.flatMap((section) => [section, ...section.qas]));
  for (const { id, html, text } of texts) {
    for (const [, attributes] of html.matchAll(/<[a-z][a-z0-9]*\b([^>]*)>/gi)) {
      assert.match(attributes, /^(\s+(href|colspan|rowspan)="[^"]*")*$/, `${id}: only link addresses and table spans`);
    }
    assert.doesNotMatch(html, /<(svg|img|script|style|figure|iframe)\b/i, id);
    assert.doesNotMatch(text, /<\/?[a-z][a-z0-9]*\b[^>]*>/i, `${id}: no tags in the plain text`);
  }
  // The app's own chapter summaries are not Code text.
  for (const chapter of whole.chapters) assert.equal(chapter.summary, undefined);
});

test('describes the edition, the terms and every chapter in each answer', () => {
  const index = fileData(CODE_API_FILES.index);
  for (const { data } of files) {
    assert.equal(data.about.edition, CODE_EDITION);
    assert.match(data.about.contentHash, /^[0-9a-f]{16}$/);
    assert.ok(data.about.terms.reuse && data.about.terms.authority);
    assert.deepEqual(data.about, index.about);
  }
  assert.deepEqual(index.chapters.map((chapter) => chapter.id), whole.chapters.map((chapter) => chapter.id));
  for (const chapter of index.chapters) {
    // Each chapter's API address is answered by the file the build writes for it.
    assert.equal(codeApiAssetPathFor(new URL(chapter.api).pathname), `${CODE_API_PATH}/${CODE_API_FILES.chapter(chapter.id)}`);
    assert.deepEqual(fileData(CODE_API_FILES.chapter(chapter.id)).chapter, whole.chapters.find((entry) => entry.id === chapter.id));
  }
});

test('changes the content hash when the text changes, and only then', () => {
  assert.equal(buildCodeApiFiles(chapters)[0].data.about.contentHash, whole.about.contentHash);
  const edited = structuredClone(chapters);
  edited.find((chapter) => chapter.part !== WEBSITE_PART_ID).sections[0].legalText += ' Edited.';
  assert.notEqual(buildCodeApiFiles(edited)[0].data.about.contentHash, whole.about.contentHash);
});

test('keeps web links as absolute addresses and drops everything else', () => {
  assert.equal(
    apiHtml('<p class="x">See <a href="/code/ch4" class="cross-reference">Chapter 4</a>, <a href="http://www.example.org" target="_blank">example</a>.</p>'),
    '<p>See <a href="https://medtecheurope-code.org/code/ch4">Chapter 4</a>, <a href="http://www.example.org/">example</a>.</p>',
  );
  assert.equal(apiHtml('<a href="javascript:alert(1)">x</a><a>y</a><img src="/a.png" alt="z"><svg><path d="M0"/></svg>'), 'xy');
});

test('lays out the plain text in lines', () => {
  assert.equal(apiText('<p>One</p><p>Two<br/>Three</p>'), 'One\n\nTwo\nThree');
  assert.equal(apiText('<ul><li>A</li><li><strong>B</strong> &amp; c</li></ul>'), 'A\nB & c');
  assert.equal(apiText('<table><tr><th>X</th><th>Y</th></tr><tr><td>1</td><td> 2 </td></tr></table>'), 'X\tY\n1\t2');
  assert.equal(apiText('<strong>a.</strong> First.<br/><br/> <strong>b.</strong> Second.'), 'a. First.\n\nb. Second.');
});

// ---- The Worker ----

const FILES = new Map([
  [`${CODE_API_PATH}/index.json`, '{"index":true}'],
  [`${CODE_API_PATH}/code.json`, '{"code":true}'],
  [`${CODE_API_PATH}/chapters/ch4.json`, '{"chapter":"ch4"}'],
]);

function createAssets(files = FILES) {
  const requests = [];
  return {
    requests,
    async fetch(request) {
      requests.push(request);
      const { pathname } = new URL(request.url);
      if (!files.has(pathname)) return new Response('Not found', { status: 404 });
      const etag = `"${pathname.length}"`;
      if (request.headers.get('If-None-Match') === etag) return new Response(null, { status: 304, headers: { ETag: etag } });
      return new Response(request.method === 'HEAD' ? null : files.get(pathname), {
        headers: { 'Content-Type': 'application/json', ETag: etag, 'Cache-Control': 'public, max-age=0, must-revalidate' },
      });
    },
  };
}

async function call(path, init, { origin = 'https://medtecheurope-code.org', files } = {}) {
  const env = { ASSETS: createAssets(files) };
  const response = await worker.fetch(new Request(`${origin}${path}`, init), env);
  return { response, assets: env.ASSETS };
}

test('serves each API address its file, readable by any site', async () => {
  for (const [path, body] of [
    ['/api/code/v1', '{"index":true}'],
    ['/api/code/v1/', '{"index":true}'],
    ['/api/code/v1/code', '{"code":true}'],
    ['/api/code/v1/chapters/ch4', '{"chapter":"ch4"}'],
  ]) {
    const { response } = await call(path, { headers: { Origin: 'https://member.example' } });
    assert.equal(response.status, 200, path);
    assert.equal(await response.text(), body, path);
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), '*');
    assert.equal(response.headers.get('Content-Type'), 'application/json; charset=utf-8');
    assert.equal(response.headers.get('Cache-Control'), 'public, max-age=3600');
    assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff');
    assert.ok(response.headers.get('ETag'));
  }
});

test('answers on either host, without redirecting', async () => {
  const { response } = await call('/api/code/v1/code', undefined, { origin: 'https://www.medtecheurope-code.org' });
  assert.equal(response.status, 200);
});

test('answers an unchanged file with 304 and a HEAD request without a body', async () => {
  const first = await call('/api/code/v1/code');
  const etag = first.response.headers.get('ETag');
  const again = await call('/api/code/v1/code', { headers: { 'If-None-Match': etag, Cookie: 'a=b' } });
  assert.equal(again.response.status, 304);
  assert.equal(again.response.headers.get('Access-Control-Allow-Origin'), '*');
  assert.equal(again.assets.requests[0].headers.get('Cookie'), null, 'only cache validators are passed on');

  const head = await call('/api/code/v1', { method: 'HEAD' });
  assert.equal(head.response.status, 200);
  assert.equal(await head.response.text(), '');
});

test('reports unknown addresses and chapters as JSON errors', async () => {
  for (const path of ['/api/code', '/api/code/v2', '/api/code/v1/code.json', '/api/code/v1/chapters', '/api/code/v1/chapters/CH4', '/api/code/v1/chapters/..%2Fcode', '/api/code/v1/chapters/ch4/extra']) {
    const { response, assets } = await call(path);
    assert.equal(response.status, 404, path);
    assert.equal((await response.json()).error.code, 'NOT_FOUND', path);
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), '*');
    assert.deepEqual(assets.requests, [], `${path}: no file is read`);
  }
  const missing = await call('/api/code/v1/chapters/ch99');
  assert.equal(missing.response.status, 404);
  assert.equal((await missing.response.json()).error.code, 'CHAPTER_NOT_FOUND');
});

test('accepts reading only', async () => {
  const post = await call('/api/code/v1/code', { method: 'POST', body: '{}' });
  assert.equal(post.response.status, 405);
  assert.equal(post.response.headers.get('Allow'), 'GET, HEAD, OPTIONS');

  const preflight = await call('/api/code/v1/code', { method: 'OPTIONS', headers: { Origin: 'https://member.example' } });
  assert.equal(preflight.response.status, 204);
  assert.equal(preflight.response.headers.get('Access-Control-Allow-Origin'), '*');
  assert.match(preflight.response.headers.get('Access-Control-Allow-Headers'), /If-None-Match/);
});

test('says the API is unavailable when the build wrote no API files', async () => {
  const env = { ASSETS: createAssets(new Map()) };
  const response = await handleCodeApiRequest(new Request(`https://medtecheurope-code.org${CODE_API_PATH}`), env);
  assert.equal(response.status, 503);
});
