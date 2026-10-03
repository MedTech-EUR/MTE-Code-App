import scope from './code/scope.json';
import admin from './code/admin.json';
import intro from './code/intro.json';
import chapter1 from './code/ch1.json';
import chapter2 from './code/ch2.json';
import chapter3 from './code/ch3.json';
import chapter4 from './code/ch4.json';
import chapter5 from './code/ch5.json';
import chapter6 from './code/ch6.json';
import chapter7 from './code/ch7.json';
import chapter8 from './code/ch8.json';
import chapter9 from './code/ch9.json';
import chapter10 from './code/ch10.json';
import part2 from './code/part2.json';
import glossary from './code/glossary.json';
import annex1 from './code/annex1.json';
import annex2 from './code/annex2.json';
import annex3 from './code/annex3.json';
import annex4 from './code/annex4.json';
import annex5 from './code/annex5.json';
import annex6 from './code/annex6.json';
import annex7 from './code/annex7.json';
import changelog from './code/changelog.json';
import privacy from './code/privacy.json';
import { CODE_CHAPTER_IDS } from './codeOrder';

const CHAPTERS_BY_ID = {
  scope,
  admin,
  intro,
  ch1: chapter1,
  ch2: chapter2,
  ch3: chapter3,
  ch4: chapter4,
  ch5: chapter5,
  ch6: chapter6,
  ch7: chapter7,
  ch8: chapter8,
  ch9: chapter9,
  ch10: chapter10,
  part2,
  glossary,
  annex1,
  annex2,
  annex3,
  annex4,
  annex5,
  annex6,
  annex7,
  changelog,
  privacy,
};

export const FULL_CODE_DATA = CODE_CHAPTER_IDS.map((id) => {
  const chapter = CHAPTERS_BY_ID[id];
  if (chapter?.id !== id) throw new Error(`Code chapter adapter mismatch for "${id}".`);
  return chapter;
});

// Website pages (Version History, Privacy Notice) are stored and routed like Code chapters, but they describe
// the app, not the Code: the sidebar, the Code landing page and chapter-to-chapter navigation
// keep them apart from the Code's own chapters.
export const WEBSITE_PART_ID = 'website';
export const CODE_CHAPTERS = FULL_CODE_DATA.filter((chapter) => chapter.part !== WEBSITE_PART_ID);
export const WEBSITE_CHAPTERS = FULL_CODE_DATA.filter((chapter) => chapter.part === WEBSITE_PART_ID);

export const updateSearchStatus = (message) => {
  const statusEl = document.getElementById('search-status');
  if (statusEl) {
    statusEl.textContent = message;
  }
};
