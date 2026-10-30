# URL Routing Guide

This guide explains the app's URLs, the compatibility rules for links that have already been shared, and the checks to run after changing navigation or content identifiers.

The routing system is intentionally small and does not use a third-party routing library.

## URL Formats

| Destination | URL format | Example |
|---|---|---|
| Home Hub | `/` | `https://medtecheurope-code.org/` |
| Code index | `/code` | `https://medtecheurope-code.org/code` |
| Code chapter | `/code/:chapterId` | `https://medtecheurope-code.org/code/ch1` |
| Exact Code section | `/code/:chapterId#section-id` | `https://medtecheurope-code.org/code/ch1#ch1-2-event-location-and-venue` |
| Exact Code Q&A | `/code/:chapterId#section-id-qa-k` | `https://medtecheurope-code.org/code/ch4#ch4-3-educational-grants-qa-3` |
| Exact Glossary definition | `/code/glossary#glossary-term-id` | `https://medtecheurope-code.org/code/glossary#glossary-healthcare-professional-hcp` |
| Transparency index | `/transparency` | `https://medtecheurope-code.org/transparency` |
| Transparency document | `/transparency/:documentId` | `https://medtecheurope-code.org/transparency/disclosure-guidelines` |
| Transparency reader unit | `/transparency/:documentId/:unitId` | `https://medtecheurope-code.org/transparency/disclosure-guidelines/dg-chapter-1` |
| Exact Transparency section | `/transparency/:documentId/:unitId#section-id` | `https://medtecheurope-code.org/transparency/disclosure-guidelines/dg-chapter-1#dg-chapter-1-2-applicability-of-these-disclosure-guidelines` |
| Exact Transparency Q&A | `/transparency/:documentId/:unitId#section-id-qa-k` | `https://medtecheurope-code.org/transparency/disclosure-guidelines/dg-chapter-3#dg-chapter-3-3-template-and-language-of-disclosure-qa-1` |
| Decision-tree index | `/trees` | `https://medtecheurope-code.org/trees` |
| Decision tree | `/trees/:treeId` | `https://medtecheurope-code.org/trees/dt-ch1-event-location` |
| Knowledge Quiz | `/quiz` | `https://medtecheurope-code.org/quiz` |
| Shared Quiz | `/quiz#quiz?q=questionIds` | `https://medtecheurope-code.org/quiz#quiz?q=q1,q2` |
| TPPT Checker | `/tppt` | `https://medtecheurope-code.org/tppt` |
| Event support checker | `/event-support` | `https://medtecheurope-code.org/event-support` |

Browser Back and Forward restore these app-level destinations. Individual steps inside a decision tree, an active Quiz or the event support checker are not separate history entries. The checker keeps its answers only while it is open, so its links to the Code open in a new tab.

The Worker answers `/api/cvs/*` (the checker's live CVS lookup) itself, before the app-shell fallback, like the other `/api/*` endpoints.

Scrolling through a Code chapter or Transparency reader unit does not continuously
change the address bar. Section anchors are used for direct links without
creating a new browser-history entry for every section that passes through the
viewport.

## Existing Links Remain Supported

Links created before path routing continue to work. When one is opened, the app resolves it and replaces it with the canonical URL without adding an unnecessary browser-history entry.

| Existing link | Canonical result |
|---|---|
| `/#ch1` | `/code/ch1` |
| `/#ch1-2-event-location-and-venue` | `/code/ch1#ch1-2-event-location-and-venue` |
| `/#dt-ch1-event-location` | `/trees/dt-ch1-event-location` |
| `/#quiz?q=q1,q2` | `/quiz#quiz?q=q1,q2` |
| `/#tppt` | `/tppt` |

Do not remove this compatibility behavior unless every published link has a deliberate migration path.

## Identifiers That Protect Links

Chapter routes use each chapter's `id` in `src/data/code/*.json`. Transparency
routes use the document and unit IDs registered in
`src/data/transparency/transparencyData.js`. Decision-tree routes use each tree's
`id` in `src/data/treeData.json`. Renaming any of these values changes its public
URL.

Code and Transparency section anchors combine the chapter or reader-unit ID with
a slug of the section title. An untitled section instead uses its zero-based
position (`section-0`, `section-1`, and so on), so changing a title or reordering
untitled sections can change public URLs and existing bookmarks.

Each Glossary definition is its own section of `glossary.json`, titled with its
term exactly as its bold headword gives it (`npm run validate:data` checks this),
so its anchor is `glossary-` plus a slug of the term. Adding or reordering
definitions does not change other definitions' links; renaming a term changes
its own.

A Q&A anchor is its section anchor plus `-qa-` plus that Q&A's position within
that section (first, second, third, and so on) — for example
`ch4-3-educational-grants-qa-3` is the third Q&A in Code chapter ch4's
"3. Educational Grants" section. It does not use the printed "Q&A N" number,
because a new Code edition can renumber Q&As across the whole publication while
each Q&A's position within its own section stays the same. A Q&A anchor
therefore changes if its section title changes (which changes the section
anchor it is built on) or if that section's own Q&As are reordered, inserted,
or removed before it. Opening a Q&A link switches the Q&A view on so the linked
answer is visible.

Before renaming a Code chapter ID, Transparency document ID, Transparency unit
ID, decision-tree ID, or section title:

1. Confirm that the content change is necessary and correct.
2. Treat the old URL as a compatibility requirement.
3. Have a developer add and test an explicit compatibility rule if the old URL must continue working.
4. Run the checks below before release.

The bookmark and Recently Viewed storage formats are independent from the browser-history implementation and must not be migrated merely because URL routing changes.

## Implementation Map

- `src/utils/routeUtils.js` contains pure URL builders and parsing rules.
- `src/config/routes.js` creates the parser from the current Code, Transparency, and decision-tree data.
- `src/hooks/useAppRouting.js` synchronizes React state with the address bar and handles Back, Forward, current navigation, and legacy URL replacement.
- `src/App.jsx` passes route-aware navigation callbacks to the existing components.
- `src/components/FullTextSection.jsx` builds canonical links and citation URLs for Code and Transparency sections, and gives each Q&A block its own anchor id (`getQaAnchorId`) so it can be linked directly. Each Q&A's Cite/Link copies that link and its Bookmark stores that anchor; opening the bookmark goes through the same route, so it also switches the Q&A view on.
- `src/components/quiz/QuizContent.jsx` loads shared Quiz URLs and responds when Back or Forward changes the shared challenge.
- `src/components/quiz/QuizResults.jsx` builds canonical shared Quiz URLs.
- `tests/routeUtils.test.mjs` exercises every current Code chapter/section, Transparency document/unit/section, decision tree, and supported legacy format.

Keeping URL construction in these files prevents individual components from inventing different link formats.

## Hosting Requirement

A fresh request for a nested URL such as `/code/ch1` or
`/transparency/disclosure-guidelines/dg-chapter-1` must return the React app;
otherwise direct links and browser refreshes will produce a server 404 or a
redirect to the home page.

Each page is served its own copy of the app's `index.html`, so search engines and link previews see the page's own title, description, canonical address and text before any script runs:

- `src/utils/pageMeta.js` lists every page a visitor can open directly (`createPageList()`): its canonical path, heading, title and description, taken from the Code, decision-tree and Transparency data and `config/sections.js`. `src/config/pages.js` builds the list in the app, and `useAppRouting.js` shows the current page's title, description and canonical link as the reader moves around. A new kind of page needs an entry here as well as a route; `tests/pageMeta.test.mjs` checks that every listed path is a canonical route and every chapter, tree and reader unit is listed.
- `npm run build` ends with `scripts/prerender-pages.mjs`, which writes one HTML file per page to `dist/prerendered/` (the built `index.html` with that page's title, description, canonical link and text in `<div id="root">`, which the app replaces when it starts; `scripts/lib/prerender.mjs`) and `dist/sitemap.xml` from the same list. It runs after the service worker is generated, so the installed app keeps opening the plain `index.html` for every page. Cloudflare's build command must stay `npm run build`.
- The Cloudflare Worker in `server.js` runs before the static files for every request outside `/assets/` (`run_worker_first` in `wrangler.toml`). It redirects `www.` and trailing-slash addresses of pages to the canonical address (301), then handles its reserved server routes, which include the content editor (`/admin/`) and Content history (`/admin/history/`), each its own page rather than the app. Any other extensionless path is served its file from `dist/prerendered/` (`prerendered-pages.js` maps the two); a path that is not a page gets the app shell with a 404, and the app then opens its home page. If the build wrote no page files, every path gets the app shell as before. The files are never served at their own `/prerendered/` addresses. `tests/serverSpaFallback.test.mjs` guards this.

If the app is moved to another host, configure that host to serve each page's file from `dist/prerendered/` at the page's address and the app shell for any other extensionless path, before deployment.

## Verification

From the app root folder, run:

```powershell
npm test
npm run check
```

`npm test` exercises the route parser against current project data and confirms that current section URLs are unique. `npm run check` also validates duplicate content IDs, verifies the pinned Disclosure sources, runs type checks, and creates a production build. See `PROJECT_CHECKS.md` for plain-language instructions and troubleshooting.

Before a release that changes navigation or identifiers, also check manually:

1. Open `/code`, select two chapters, and confirm the URL changes each time.
2. Use browser Back and Forward and confirm both the URL and visible chapter are restored.
3. Copy a Code section link and open it in a fresh tab. Confirm the correct chapter and section appear.
4. Open the Transparency index, Disclosure Guidelines overview, one reader unit,
   and an exact section link. Use Back/Forward and refresh the nested unit URL.
5. Open one legacy chapter or section hash and confirm it changes to the canonical URL.
6. Open and refresh a decision-tree URL, a shared Quiz URL, and `/tppt`.
7. In a new private window, open a nested chapter URL without a `#` anchor (for example `/code/ch1`) as the first page, in the production preview or deployed app. Confirm the chapter appears. A browser that has opened the app before is served by the offline service worker, which hides a broken server fallback.

Do not release a route change if an existing link resolves to the wrong content, even when the automated checks pass.
