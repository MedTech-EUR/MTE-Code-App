export const CODE_CHAPTER_IDS = Object.freeze([
  'scope',
  'admin',
  'intro',
  'ch1',
  'ch2',
  'ch3',
  'ch4',
  'ch5',
  'ch6',
  'ch7',
  'ch8',
  'ch9',
  'ch10',
  'part2',
  'glossary',
  'annex1',
  'annex2',
  'annex3',
  'annex4',
  'annex5',
  'annex6',
  'annex7',
  'changelog',
]);

// The parts the Code's chapters are listed under, in the sidebar, on the Code's own page and in
// the Code API. Kept here, beside the order, so the build's Node scripts can read them too.
export const CODE_PARTS = Object.freeze([
  { id: 'intro', label: 'Introductory Chapters' },
  { id: 'part1', label: 'Part 1: The Code' },
  { id: 'part2', label: 'Part 2: Complaint Handling' },
  { id: 'part3', label: 'Part 3: Annexes & Glossary' },
]);

// Website pages (Version History) are stored and routed like Code chapters but are not the Code.
export const WEBSITE_PART_ID = 'website';
