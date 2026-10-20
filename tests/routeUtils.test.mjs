import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { generateSectionId, getQaAnchorId, splitGlossaryDefinitions } from '../src/utils/textUtils.js';
import { loadSplitCodeData } from '../scripts/lib/code-content.mjs';
import { loadTransparencyData } from '../scripts/lib/transparency-content.mjs';
import {
  buildChapterPath,
  buildCodeSectionPath,
  buildEventSupportPath,
  buildHistoricalDeclarationsPath,
  buildQuizPath,
  buildTransparencyDocumentPath,
  buildTransparencyHomePath,
  buildTransparencySectionPath,
  buildTransparencyUnitPath,
  buildTreePath,
  createRouteUtils,
  HISTORICAL_DECLARATIONS_DOCUMENT_ID,
} from '../src/utils/routeUtils.js';

const testDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(testDirectory, '..');
const codeData = loadSplitCodeData(projectRoot);
const treeData = JSON.parse(readFileSync(resolve(projectRoot, 'src/data/treeData.json'), 'utf8'));
const FULL_CODE_DATA = codeData.chapters;
const TREE_DATA = treeData.trees;
const TRANSPARENCY_DOCUMENTS = loadTransparencyData(projectRoot);
const { parseAppLocation } = createRouteUtils(
  FULL_CODE_DATA,
  TREE_DATA,
  TRANSPARENCY_DOCUMENTS,
);

test('parses the canonical top-level routes', () => {
  assert.deepEqual(parseAppLocation('/', ''), {
    activeSection: null,
    activeId: 'home',
    anchor: null,
    canonicalUrl: '/',
  });
  assert.equal(parseAppLocation('/code', '').activeId, 'home');
  assert.equal(parseAppLocation('/trees', '').activeId, 'trees-home');
  assert.equal(parseAppLocation('/quiz', '').activeSection, 'quiz');
  assert.equal(parseAppLocation('/tppt', '').activeSection, 'tppt');
  assert.deepEqual(parseAppLocation('/event-support', ''), {
    activeSection: 'event-support',
    activeId: 'event-support-home',
    anchor: null,
    canonicalUrl: buildEventSupportPath(),
  });
  assert.equal(parseAppLocation('/event-support/', '').canonicalUrl, '/event-support');
  assert.equal(parseAppLocation('/event-support/extra', '').activeSection, null);
  assert.deepEqual(parseAppLocation('/transparency', ''), {
    activeSection: 'transparency',
    activeId: 'transparency-home',
    anchor: null,
    canonicalUrl: '/transparency',
  });
});

test('keeps Transparency document data optional for existing route consumers', () => {
  const legacyParser = createRouteUtils(FULL_CODE_DATA, TREE_DATA).parseAppLocation;

  assert.equal(legacyParser('/code/ch1', '').canonicalUrl, '/code/ch1');
  assert.equal(legacyParser('/trees', '').canonicalUrl, '/trees');
  assert.equal(legacyParser('/transparency/disclosure-guidelines', '').canonicalUrl, '/transparency');
});

test('round-trips every Transparency document and unit route', () => {
  for (const document of TRANSPARENCY_DOCUMENTS) {
    const documentPath = buildTransparencyDocumentPath(document.id);
    const parsedDocument = parseAppLocation(documentPath, '');

    assert.equal(buildTransparencyHomePath(), '/transparency');
    assert.equal(parsedDocument.activeSection, 'transparency');
    assert.equal(parsedDocument.activeDocumentId, document.id);
    assert.equal(parsedDocument.activeId, 'home');
    assert.equal(parsedDocument.canonicalUrl, documentPath);

    for (const unit of document.units) {
      const unitPath = buildTransparencyUnitPath(document.id, unit.id);
      const parsedUnit = parseAppLocation(unitPath, '');

      assert.equal(parsedUnit.activeSection, 'transparency');
      assert.equal(parsedUnit.activeDocumentId, document.id);
      assert.equal(parsedUnit.activeId, unit.id);
      assert.equal(parsedUnit.canonicalUrl, unitPath);
    }
  }
});

test('round-trips every Transparency section without changing its anchor ID', () => {
  const urls = new Set();

  for (const document of TRANSPARENCY_DOCUMENTS) {
    for (const unit of document.units) {
      unit.sections.forEach((section, index) => {
        const sectionId = generateSectionId(unit.id, section.title, index);
        const url = buildTransparencySectionPath(document.id, unit.id, sectionId);
        const parsed = parseAppLocation(
          buildTransparencyUnitPath(document.id, unit.id),
          `#${sectionId}`,
        );

        assert.equal(parsed.activeSection, 'transparency');
        assert.equal(parsed.activeDocumentId, document.id);
        assert.equal(parsed.activeId, unit.id);
        assert.equal(parsed.anchor, sectionId);
        assert.equal(parsed.canonicalUrl, url);
        assert.equal(urls.has(url), false, `Duplicate Transparency section URL: ${url}`);
        urls.add(url);
      });
    }
  }
});

test('canonicalizes a Transparency section hash to its owning unit', () => {
  const document = TRANSPARENCY_DOCUMENTS[0];
  const owner = document.units[1];
  const sectionId = generateSectionId(owner.id, owner.sections[0].title, 0);
  const expected = buildTransparencySectionPath(document.id, owner.id, sectionId);

  assert.equal(
    parseAppLocation(buildTransparencyDocumentPath(document.id), `#${sectionId}`).canonicalUrl,
    expected,
  );
  assert.equal(
    parseAppLocation(
      buildTransparencyUnitPath(document.id, document.units[0].id),
      `#${sectionId}`,
    ).canonicalUrl,
    expected,
  );
});

test('round-trips every live chapter route', () => {
  for (const chapter of FULL_CODE_DATA) {
    const path = buildChapterPath(chapter.id);
    const parsed = parseAppLocation(path, '');
    assert.equal(parsed.activeSection, 'code');
    assert.equal(parsed.activeId, chapter.id);
    assert.equal(parsed.canonicalUrl, path);
  }
});

test('round-trips every live section link without changing its anchor ID', () => {
  const urls = new Set();

  for (const chapter of FULL_CODE_DATA) {
    chapter.sections.forEach((section, index) => {
      const sectionId = generateSectionId(chapter.id, section.title, index);
      const url = buildCodeSectionPath(chapter.id, sectionId);
      const parsed = parseAppLocation(buildChapterPath(chapter.id), `#${sectionId}`);

      assert.equal(parsed.activeId, chapter.id);
      assert.equal(parsed.anchor, sectionId);
      assert.equal(parsed.canonicalUrl, url);
      assert.equal(urls.has(url), false, `Duplicate section URL: ${url}`);
      urls.add(url);
    });
  }
});

test('round-trips every live Code Q&A anchor without using the printed Q&A number', () => {
  const sectionUrls = new Set();
  const qaUrls = new Set();

  for (const chapter of FULL_CODE_DATA) {
    chapter.sections.forEach((section, index) => {
      const sectionId = generateSectionId(chapter.id, section.title, index);
      sectionUrls.add(buildCodeSectionPath(chapter.id, sectionId));

      (section.qas || []).forEach((_qa, qaIndex) => {
        const qaAnchor = getQaAnchorId(sectionId, qaIndex);
        const url = buildCodeSectionPath(chapter.id, qaAnchor);

        const parsedFromChapter = parseAppLocation(buildChapterPath(chapter.id), `#${qaAnchor}`);
        assert.equal(parsedFromChapter.activeSection, 'code');
        assert.equal(parsedFromChapter.activeId, chapter.id);
        assert.equal(parsedFromChapter.anchor, qaAnchor);
        assert.equal(parsedFromChapter.anchorType, 'qa');
        assert.equal(parsedFromChapter.canonicalUrl, url);

        assert.equal(parseAppLocation('/', `#${qaAnchor}`).canonicalUrl, url);

        assert.equal(qaUrls.has(url), false, `Duplicate Q&A URL: ${url}`);
        qaUrls.add(url);
      });
    });
  }

  for (const url of qaUrls) {
    assert.equal(sectionUrls.has(url), false, `Q&A URL collides with a section URL: ${url}`);
  }
});

test('round-trips every live Transparency Q&A anchor without using the printed Q&A number', () => {
  const qaUrls = new Set();

  for (const document of TRANSPARENCY_DOCUMENTS) {
    for (const unit of document.units) {
      unit.sections.forEach((section, index) => {
        const sectionId = generateSectionId(unit.id, section.title, index);

        (section.qas || []).forEach((_qa, qaIndex) => {
          const qaAnchor = getQaAnchorId(sectionId, qaIndex);
          const url = buildTransparencySectionPath(document.id, unit.id, qaAnchor);

          const parsedFromUnit = parseAppLocation(
            buildTransparencyUnitPath(document.id, unit.id),
            `#${qaAnchor}`,
          );
          assert.equal(parsedFromUnit.activeSection, 'transparency');
          assert.equal(parsedFromUnit.activeDocumentId, document.id);
          assert.equal(parsedFromUnit.activeId, unit.id);
          assert.equal(parsedFromUnit.anchor, qaAnchor);
          assert.equal(parsedFromUnit.anchorType, 'qa');
          assert.equal(parsedFromUnit.canonicalUrl, url);

          const parsedFromDocument = parseAppLocation(
            buildTransparencyDocumentPath(document.id),
            `#${qaAnchor}`,
          );
          assert.equal(parsedFromDocument.activeSection, 'transparency');
          assert.equal(parsedFromDocument.activeDocumentId, document.id);
          assert.equal(parsedFromDocument.activeId, unit.id);
          assert.equal(parsedFromDocument.anchor, qaAnchor);
          assert.equal(parsedFromDocument.anchorType, 'qa');
          assert.equal(parsedFromDocument.canonicalUrl, url);

          assert.equal(qaUrls.has(url), false, `Duplicate Transparency Q&A URL: ${url}`);
          qaUrls.add(url);
        });
      });
    }
  }
});

test('links every Glossary definition by its term’s ID', () => {
  const glossary = FULL_CODE_DATA.find((chapter) => chapter.id === 'glossary');
  assert.ok(glossary.sections.length > 1, 'one section per definition');

  glossary.sections.forEach((section, index) => {
    const [{ entry }] = splitGlossaryDefinitions(section.legalText);
    const anchor = `glossary-${entry.id}`;
    assert.equal(generateSectionId(glossary.id, section.title, index), anchor);
    const route = parseAppLocation(buildChapterPath(glossary.id), `#${anchor}`);
    assert.equal(route.activeId, glossary.id);
    assert.equal(route.anchor, anchor);
    assert.equal(route.canonicalUrl, buildCodeSectionPath(glossary.id, anchor));
  });
});

test('keeps anchorType off every live section route', () => {
  for (const chapter of FULL_CODE_DATA) {
    chapter.sections.forEach((section, index) => {
      const sectionId = generateSectionId(chapter.id, section.title, index);
      const parsed = parseAppLocation(buildChapterPath(chapter.id), `#${sectionId}`);
      assert.equal('anchorType' in parsed, false);
    });
  }

  for (const document of TRANSPARENCY_DOCUMENTS) {
    for (const unit of document.units) {
      unit.sections.forEach((section, index) => {
        const sectionId = generateSectionId(unit.id, section.title, index);
        const parsed = parseAppLocation(
          buildTransparencyUnitPath(document.id, unit.id),
          `#${sectionId}`,
        );
        assert.equal('anchorType' in parsed, false);
      });
    }
  }
});

test('accepts and canonicalizes legacy chapter and section hashes', () => {
  assert.equal(parseAppLocation('/', '#ch1').canonicalUrl, '/code/ch1');
  assert.equal(
    parseAppLocation('/', '#ch1-2-event-location-and-venue').canonicalUrl,
    '/code/ch1#ch1-2-event-location-and-venue',
  );
});

test('accepts and canonicalizes legacy top-level tool hashes', () => {
  assert.equal(parseAppLocation('/', '#quiz').canonicalUrl, '/quiz');
  assert.equal(parseAppLocation('/', '#tppt').canonicalUrl, '/tppt');
});

test('round-trips every live decision-tree route and its legacy hash', () => {
  for (const tree of TREE_DATA) {
    const path = buildTreePath(tree.id);
    assert.equal(parseAppLocation(path, '').activeId, tree.id);
    assert.equal(parseAppLocation('/', `#${tree.id}`).canonicalUrl, path);
  }
});

test('keeps existing shared Quiz hashes on the Quiz path', () => {
  const hash = '#quiz?q=q1,q2,q3';
  assert.equal(buildQuizPath(hash), `/quiz${hash}`);
  assert.equal(parseAppLocation('/', hash).canonicalUrl, `/quiz${hash}`);
  assert.equal(parseAppLocation('/quiz', hash).canonicalUrl, `/quiz${hash}`);
});

test('routes the Historical Declarations registry as a Transparency special case', () => {
  const path = buildTransparencyDocumentPath(HISTORICAL_DECLARATIONS_DOCUMENT_ID);
  assert.equal(path, '/transparency/historical-declarations');

  const parsed = parseAppLocation(path, '');
  assert.equal(parsed.activeSection, 'transparency');
  assert.equal(parsed.activeDocumentId, HISTORICAL_DECLARATIONS_DOCUMENT_ID);
  // 'home', not the document id — matches a real document's own overview
  // route, since App.jsx's readerMode flag keys off activeId !== 'home' to
  // enable reader-only chrome that doesn't apply to this feature.
  assert.equal(parsed.activeId, 'home');
  assert.equal(parsed.canonicalUrl, path);

  // Works even when no real Transparency documents are registered, since it
  // never depends on transparencyDocumentIndex.
  const legacyParser = createRouteUtils(FULL_CODE_DATA, TREE_DATA).parseAppLocation;
  assert.equal(legacyParser(path, '').activeDocumentId, HISTORICAL_DECLARATIONS_DOCUMENT_ID);
});

test('preserves the Historical Declarations search-state hash through parsing', () => {
  const hash = '#search?q=acme&year=2024';
  assert.equal(
    buildHistoricalDeclarationsPath(hash),
    `/transparency/historical-declarations${hash}`,
  );

  const parsed = parseAppLocation('/transparency/historical-declarations', hash);
  assert.equal(parsed.canonicalUrl, `/transparency/historical-declarations${hash}`);
  assert.equal(parsed.anchor, null);
});

test('falls back safely for unknown paths and malformed URL encoding', () => {
  assert.equal(parseAppLocation('/not-a-route', '').canonicalUrl, '/');
  assert.equal(parseAppLocation('/code/%E0%A4%A', '').canonicalUrl, '/');
  assert.equal(parseAppLocation('/transparency/not-a-document', '').canonicalUrl, '/transparency');
  assert.equal(
    parseAppLocation('/transparency/disclosure-guidelines/not-a-unit', '').canonicalUrl,
    '/transparency/disclosure-guidelines',
  );
  assert.equal(
    parseAppLocation('/transparency/%E0%A4%A', '').canonicalUrl,
    '/transparency',
  );
});
