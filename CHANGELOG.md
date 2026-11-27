# Technical Changelog

All notable technical changes, architectural refactors, and feature additions to The Code App codebase are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versions are internal application-release labels; they are independent of the private npm package version and are not currently represented by Git tags.

---

## [Unreleased]

### Guided tours — 2026-11-27

- Added six task-based tours to the shared top bar. Each highlights the active control and follows the visitor through the actual reader or tool. The launcher supports reduced motion.
- Isolated the TPPT sample from agenda autosave and kept existing tool sessions open when launching a tour. See the [feature map and implementation plan](docs/guided-tour.md).

### Code API — 2026-11-26
- Added permanent section and Q&A IDs, single-item JSON and script-free live embeds under Cite/Link. Publication version and optional edition are Code-wide. Plain-text annex tables expand merged cells and Annex III exposes its published map.
- New read-only, public Code API (`docs/code-api.md`): `/api/code/v1` (about the text and the list of chapters), `/api/code/v1/code` (every chapter with its sections and Q&As) and `/api/code/v1/chapters/:chapterId`. JSON, `Access-Control-Allow-Origin: *`, `Cache-Control: public, max-age=3600`, the assets' `ETag` (and 304 on `If-None-Match`), `nosniff`; `OPTIONS` answers a preflight; other methods 405; unknown addresses `NOT_FOUND`, unknown chapters `CHAPTER_NOT_FOUND`, a build without the files 503. Only `If-None-Match`/`If-Modified-Since` are passed to the assets binding.
- `scripts/lib/code-api.mjs` (new) builds the answers from the chapter files: website pages and the app's chapter summaries left out; section and Q&A IDs stored in the source, with current reader anchors from `generateSectionId`/`getQaAnchorId`; `html` through `sanitizeContentHtml` with links kept as absolute http(s) addresses; `text` with paragraphs and list items on their own lines and table cells separated by tabs; Q&A `label` ("Q&A 29") split from `question`; `about` with the edition, a 16-hex `contentHash` of the chapters and the terms of reuse (`CODE_API_TERMS`, linking the published September 2024 PDF on medtecheurope.org). `scripts/build-code-api.mjs` (new) writes them to `dist/api/code/v1/` as the build's last step (after the service worker, so not precached). `code-api.js` (new, beside `server.js`) serves them; `server.js` routes `/api/code` and `/api/code/*` to it.
- `sanitizeContentHtml()` takes an optional `{ linkHref }` that keeps a link with its address only; the page files are unchanged without it (checked: all 46 identical apart from asset hashes).
- `CODE_PARTS` and `WEBSITE_PART_ID` move from `codeData.js` (which re-exports them) to `codeOrder.js`, so Node scripts can read them. `src/data/codeEdition.js` (new) holds the Code-wide version, optional edition and official publication URL used by the reader and the API.
- Version History: November 2026 Update 7 (the Code as data).
- `tests/codeApi.test.mjs` (new); `tests/cvs.test.mjs` loads `code-api.js` into its Workers runtime with the other Worker modules.

### Historical declarations: fewer D1 rows read — 2026-11-19
- `historical-declarations-api.js`: `metadata`, `search` and detail answers go through `withEdgeCache()`, which stores them in `caches.default` for the response's `s-maxage` (the header alone never cached a Worker-built response, so every visit ran the four metadata queries, two of them full scans of the 31k-row table). The stored copy carries `max-age`; the browser copy keeps `max-age=0, must-revalidate`. Keys sort the query parameters and include `CACHE_VERSION`. Only 200s are stored. `X-Declarations-Cache: HIT|MISS`. `server.js` passes `ctx` through for `waitUntil`.
- Name search of three or more characters uses the new FTS5 trigram table `declarations_fts` (`d1/historical-declarations/search-index.sql`, run after loading data) as one quoted phrase, instead of `LIKE '%…%'` on both names; shorter text, and any search before the table exists, still uses `LIKE`. Same results, checked against the sample fixture.
- The count query stops at `MAX_ACCESSIBLE_RECORDS + 1` rows. Results order by `id` after year and company name, so pages of tied rows no longer overlap or skip.
- `HistoricalDeclarationsContent.jsx`: the search box waits 500ms (was 300ms) after typing stops (`SEARCH_DEBOUNCE_MS`).

### Footer on the Home page only, and compact — 2026-11-17
- `App.jsx` passes the footer to the Home Hub only; the `footer` prop and `WithFooter` wrapper are gone from `DocumentReader`, `MainContent`, `TransparencyContent`, `TransparencyLandingPage`, `HistoricalDeclarationsContent`, `TreeContent`, `QuizContent`, `EventSupportContent` and `TPPTContent` (whose `pb-24` moves back to its scrolling area).
- `SiteFooter.jsx`: same content in a band less than half as tall (157px → 67px at 1366px, 261px → 113px on a 390px phone), in small print: links 10px, the publisher's details and "Last updated" 9px, logo `h-3.5`, `py-4`. On a wide footer (`@3xl` container) the links and "Last updated" share the first line and the publisher's details take the second; the details paragraph becomes grid cells with `@3xl:contents`, so the date is not duplicated. Narrower, the date follows the details in the same paragraph.

### Home and footer, after the UX polish — 2026-11-17
- `HubPage.jsx`: the welcome card's search bar is a real `<input type="search">` in a `role="search"` form, bound to App's `searchTerm` (the sidebar's box shows the same text and results appear as one types). Submitting calls `openSearchBox()` (cursor now goes to the end of the text) and bumps `searchHandoff`; `Sidebar.jsx` remembers the search and plays `animate-glow` (new keyframe `glow` in `index.css`, a teal ring) around its box, keyed by the count.
- `ReturnVisit` shows both groups once either has an entry; `EmptyListHint` (dashed, faint, text at 4.5:1) stands in for the empty one.
- `Sidebar.jsx`: Bookmarks and Recently Viewed are never expanded by default and carry their counts (`badge`). `getDefaultExpandedGroups` no longer takes the two counts, and the memo no longer depends on them, so saving a bookmark no longer resets the open groups.
- `SiteFooter.jsx` (new): logo, links (Version History in the app, ethicalmedtech.eu, medtecheurope.org), the publisher's details (`PUBLISHER_LINE`, as on ethicalmedtech.eu) and "Last updated" from `import.meta.env.VITE_LAST_UPDATED`, which `vite.config.ts` sets to `git log -1 --format=%cs` (empty without Git history; the line is then left out). `WithFooter` wraps each section's scrolling content (`DocumentReader`, `EventSupportContent`, `TransparencyLandingPage`, `HistoricalDeclarationsContent`, `TreeContent`, `QuizContent`, `TPPTContent`, the Home Hub) in a `min-h-full` column so the footer sits at the foot of short pages. Not printed.

### Polish from the November UX audit — 2026-11-17
- Tab icon and share image: `public/favicon.svg` was Vite's default logo and `index.html` linked no icon. It is now the MedTech Europe figure (from `home-backdrop.svg`, upright, full colour, square `viewBox`), linked with a 32×32 PNG fallback. `og:image` and `twitter:image` use `public/share-image.png` (1200×630, with `og:image:width`/`height`/`alt`) instead of the 2305×239 `logo.png`. Both PNGs come from `scripts/make-brand-images.mjs` (Playwright, not a dependency).
- `HubPage.jsx`: the heading is "The Digital Home of the MedTech Europe Code of Ethical Business Practice" and the subtitle is gone. `ReturnVisit` lists the last three recent pages and the first three bookmarks as `MenuGroup`/`MenuRow`s, only when something is saved; `App.jsx` passes `history`, `bookmarks` and the navigation callbacks. Labels come from `utils/returnVisit.js` (pure; `tests/returnVisit.test.mjs`).
- Heading scale: `PageHeader` `size="md"` titles 30px (were 24px), `DocumentReader`'s chapter title 30px bold (was 24px extrabold, smaller than the 30px Summary heading), the Summary heading 20px, the full tree view's title 30px.
- `Sidebar.jsx`: `CollapsibleGroup` takes `level` (`GROUP_LEVELS`): a section label is 16px semibold `#3b3450`, a group inside it 15px `#6e6a85` (the two nested groups pass `level={2}` and `not-first:mt-3`); both were 10px uppercase grey. Every button in the menu gets the purple focus outline (`[&_button:focus-visible]`). The install button is `#7654A1` at 10% with purple text and reads "Install The Code App".
- `intro.json`: icon `BookOpen` instead of the custom `IntroI` (a bold "I"), which is removed from `AppIcons.jsx`. `MinusCircle`, `ClipboardList` and `Target` join the registry for `TreeResultCard`, whose outcomes use icons instead of emoji (`OUTCOME_STYLES` is exported).
- `Header.jsx`, phones (below `md`) in reader mode: `CompactLogo` (new, `Logo.jsx`) instead of no logo; the Summary, Full text, Q&A and Print buttons are hidden and the "Aa" button reads "Aa Menu". Its panel gains a "Show" group of `role="switch"` toggles and a Print button there. From `md` the header is unchanged.
- `CopySummaryButton.jsx` (new) and `utils/resultSummary.js` (new, `tests/resultSummary.test.mjs`): "Copy summary" on decision-tree results and the event support answer copies the answers, outcome, text, references, link and date as plain text, ending with `GUIDANCE_NOTE` (the first sentence of the TPPT disclaimer). `EventSupportResult.jsx` moves what decides which parts show into `resultParts()`, shared with `eventSupportSummarySections()`; `EventSupportContent.jsx` gets `describeAnswer()` for both the answer list and the summary.
- Glossary: `GlossaryIndex.jsx` (new) and `utils/glossaryIndex.js` (new, `tests/glossaryIndex.test.mjs`) above the definitions: a filter box (every typed word, any order, ignoring case and accents) and an A–Z bar. `DocumentReader` takes `filterSection`; `MainContent` holds the query and clears it on a chapter change.
- `DocumentReader`'s breadcrumb and `PageBackLink` are no longer uppercase; the breadcrumb's title truncates on one line. TPPT's back link reads "Home".
- Home Hub: `WelcomeCard` in `HubPage.jsx` replaces the plain heading: a card with a radial lavender-to-mint wash, the figure (`favicon.svg`) as a 9% watermark, the eyebrow "Welcome to The Code App", the title at `max-w-[36ch]` (was 24ch) with "Ethical Business Practice" in a purple-to-teal `bg-clip-text` gradient (plain ink in print and forced colours), and a search bar that calls `openSearchBox()` (new export of `useKeyboardShortcuts.js`, shared with the "/" key). The page is `max-w-6xl` (was `5xl`), `3xl:max-w-7xl`. `public/home-backdrop.svg` and the Home Hub's background image are removed.
- Version History: "November 2026 Update 4".

### Motion and micro-interactions — 2026-11-17
- `index.css` ("Motion"): easing tokens in `@theme` (`ease-out-soft`, `ease-emphasized`, `ease-spring`) and new defaults for every `transition-*` utility (200ms, emphasized curve). One keyframe vocabulary: `animate-page-in` (pages; holds 90ms, then fades in and rises 8px), `animate-rise-in`, `animate-fade-in`, `animate-pop-in`, `animate-scale-in`/`-up`, `animate-slide-up` (sheet on phones, dialog from 40rem), `animate-toast-in`, `animate-badge-in`, `animate-slide-in-right`, `stagger` (children rise in 40ms apart) and `skeleton`. The classes use animation longhands and fill backwards only, so `[animation-delay:…]` utilities apply and nothing keeps hold of opacity or transform. `animate-scale-in`, `animate-scale-up` and `animate-slide-up` were used but never defined; they now are. "Reduce motion" makes all of it instant; spinners still turn.
- `utils/viewTransition.js` (new): `runViewTransition()` wraps a page change in `document.startViewTransition` with `flushSync`. `useAppRouting` uses it for every change to another page (section, chapter, unit or tree), not for the first page or a link within the same page. The header, the sidebar (from `lg`) and the reader's side panel carry a `view-transition-name`, so they change in place; the old page fades out above the new one (`::view-transition-old(root)`, z-index 1, 100ms) while the new one rises in. Without the API, or with reduced motion, the change is applied at once.
- Page roots use `animate-page-in`; `DocumentReader` keys its content by item so each chapter or unit rises in. `MenuTiles` and `MenuList` stagger their items; tiles lift on hover and settle on press, rows take a tint of their accent, arrows nudge. Decision-tree questions, quiz questions and the event support checker's steps are keyed so each rises in; options, results and search results cascade.
- `PageLoading.jsx` (new): the Suspense fallback of the TPPT Checker and the event support checker, a page outline with a sheen that appears after 150ms.
- Popovers open from their button (`animate-pop-in origin-top-right`), dialogs rise in over their backdrop, the copy confirmation springs in, chevrons rotate instead of swapping icons, the sidebar slides with a softer curve, and buttons answer a press (`active:scale-*`, `enabled:` where they can be disabled).

### The new menu style on the Code, Transparency and Decision Trees pages — 2026-11-16
- `MenuList.jsx` (new): the tiles and rows of the Home Hub, extracted as `MenuTile`, `MenuTiles`, `MenuList`, `MenuRow` and `MenuGroup`, with the accents in `MENU_ACCENTS`. A list runs in one, two (down the first column, then the second) or three columns by its own width (`@container`); an odd two-column list gets an empty closing cell. `HubPage.jsx` now uses it.
- `LandingPage.jsx`: the chapter cards become rows under the Code's four parts. `CODE_PARTS` moves from `Sidebar.jsx` to `data/codeData.js` so both use one list. A row shows the first paragraph or list item of the chapter's summary (`summarizeHtml`), and a chapter's number as a figure.
- `TransparencyLandingPage.jsx`: a tile per publication and tool, then each publication's units as rows with their section and Q&A counts, its PDF and its files (`sourcePdfUrl`, `downloads`, set in `TransparencyContent.jsx`). A tile with `search` carries a search form; `useAppRouting` gains `navigateHistoricalDeclarations(query)`, which opens `/transparency/historical-declarations#search?q=…`. The document overview lists its units the same way.
- `TreeLandingPage.jsx`: one list, category by category, each row naming its category; the category headings and the card grid are gone.
- `index.css`: dead `.chapter-card` rule removed.
- `scope.json`: the first mention of the MedTech Europe Geographic Area in section 1 is a reference link to Annex III, written into the text with the markup `linkCrossReferences()` produces (`class="cross-reference"`, `data-reference="code:annex3"`), so it opens in the side panel like the others. `validate-data.mjs` now fails on a written `data-reference` that names no target.

### Home Hub redesign — 2026-11-16
- `HubPage.jsx`: the six equal, centred cards are replaced by a left-aligned heading, a tile for each `featured` section (the first filled with its `textColor`, the others white) and one list with a row for each other section. The page fits one screen at 1366×768.
- `config/sections.js`: `featured: true` on The Code and Transparency. `subtitle` is no longer shown on the Home Hub; a row that opens another site shows that site's name, read from `href`.
- Each tile and row is an `<li>` whose heading holds the `<button>` or `<a>`; the control's `::after` covers the whole item, so headings are no longer inside buttons. The focus ring is drawn on the item (`has-[:focus-visible]`).
- `public/home-backdrop.svg`: the MedTech Europe figure, traced from `logo.png`, turned 14° and drawn at 6% opacity. `App.jsx` sets it as the background image of the Home Hub's `<main>`, cropped by its top-right corner; it stays in place while the page scrolls and is not printed (`print:bg-none`).
- Layout follows the page's own width with container queries (`@container`, `@xl`, `@2xl`) instead of the window's, since the sidebar beside it can be dragged. Print variants keep the filled tile readable without background colours.

### Conference Vetting System check moved to ethicalmedtech.eu — 2026-11-16
- The decision tree `dt-annex1-cvs-scope` is removed from `treeData.json`. Its questions, results and status texts moved, unchanged, to the ethicalmedtech repository, where the check gained an e4ethics branch (https://www.ethicalmedtech.eu/cvs-e4ethics-check/). The Home Hub card (`sections.js`: a card with `href` renders as a link in `HubPage.jsx`) and the sidebar entry open it in a new tab.
- `moved-pages.js` (project root) maps the tree's old addresses (`/trees/dt-annex1-cvs-scope`, with or without `www.` or a trailing slash, and the legacy `/#dt-annex1-cvs-scope`) to the new page: `server.js` answers them with one 301, and `src/main.jsx` redirects before rendering when the app is opened from its service-worker copy.
- `/api/cvs/*` (`cvs-api.js`) now also answers `https://www.ethicalmedtech.eu`, `https://ethicalmedtech.eu` and `https://*.ethicalmedtech.pages.dev` (`isAllowedOrigin()`): the response carries `Access-Control-Allow-Origin` for that origin and `Vary: Origin`, and an `OPTIONS` preflight from it gets a 204 allowing the method and `Content-Type`. Other origins are refused as before, without CORS headers; no credentials are allowed.
- Removed the trees' live CVS check altogether, since no tree uses it: `TreeCvsCheck.jsx`, `utils/treeCvs.js`, the `cvsCheck` texts and the results' `cvsCheck` field (data, `validate-data.mjs`, the editor's form in `public/admin/config.yml`, its layout in `cms-format.js`, the tree preview and Content history's field list), and `tests/annex1Tree.test.mjs` and `tests/treeCvs.test.mjs` (their cases are covered by `tests/event-check.test.mjs` in the ethicalmedtech repository). `treeData.json` was rewritten without the two empty fields on every tree and result. `CvsEventLookup.jsx` lost the options only the tree used; the event support checker is unchanged.
- Tests: the lookup's allowed and refused origins (`tests/cvs.test.mjs`), the Worker redirect (`tests/serverSpaFallback.test.mjs`), the card and the old addresses (`tests/sections.test.mjs`).

### Shared page heading and page accents — 2026-11-16
- `PageHeader.jsx`: one heading for every page outside the reader (optional back link, the section's icon tile beside the `h1`, optional eyebrow, one line of description, optional actions, a compact size), with the page accents in `PAGE_ACCENTS`: teal for the reading sections, amber for the decision trees, purple for the tools. It is a `<div>`, as the print styles hide every `<header>`. Used by `HubPage.jsx`, `LandingPage.jsx`, `TreeLandingPage.jsx`, `DecisionTree.jsx`, `quiz/*`, `TransparencyLandingPage.jsx`, `HistoricalDeclarationsContent.jsx`, `TPPTContent.tsx` and `EventSupportContent.jsx`.
- `config/sections.js`: hub accents moved into the brand palette (Quiz `#ec4899` → `#7654A1`, Transparency `#000000` → `#00727D`, Decision Trees `#e67e22` and the CVS check `#7654A1` → amber `#D97706`, with `textColor` `#B45309` for small text). Tree categories lose their own colours; blue help and hint boxes become a teal tint.
- Home Hub: the repeated logo lockup is print-only; cards take the accent on the icon tile, hover border and "Open" instead of a top bar; three columns from 1280px. Dead `.hub-card` CSS removed from `index.css`.
- Quiz: chapter checkboxes are visually hidden native inputs with a custom box and a focus ring on the card; results actions are `.no-print`.
- `Header.jsx`: outside the reader the logo shrinks so "Send a Suggestion" stays in view at 390px, and shows on phones. `Sidebar.jsx`: the active decision-tree item uses amber-700 so its white text meets AA. `InstallPrompt.jsx`: "Got it" purple instead of pink.
- No change to the reader, routing, search or data.

### Interactive map of Annex III — 2026-11-16
- `GeographicAreaMap.jsx`: an SVG map of the MedTech Europe Geographic Area in the published figure's frame (Mercator, 874 × 886). Selecting an area (on the map or in a `<select>` grouped by Annex III's two lists) animates a second SVG's `viewBox` so the area lifts off the dimmed map and fills the frame, and opens a card (`aria-live`) with the Annex III list it belongs to, its National Associations and links to their Codes on ethicalmedtech.eu. "Countries covered by Mecomed" is one area. Escape, "Whole map", the card's close button or a click beside the area go back; `prefers-reduced-motion` skips the animation. Loaded as its own chunk (about 280 kB, 85 kB gzipped), only on Annex III.
- Reader embeds: a `<figure data-reader-embed="name">` in a section's text names an interactive version (`config/readerEmbeds.js`, `hooks/useReaderEmbed.js`). `FullTextSection.jsx` renders it above the text and hides the figure on screen only (`READER_EMBED_SHOWN`), so the figure still prints and shows if the chunk cannot load. Rendering it outside `.reader-content` keeps the reader's `!important` type rules off it.
- `annex3.json`: the figure moved to the start of the section and gained `data-reader-embed="geographic-area-map"`; no wording changed (`verify:code-docx` findings unchanged).
- Data in `src/data/geographicArea/`: `areas.json` (Annex III's lists with Eurostat country codes), `map.json` (generated by `scripts/build-geographic-area-map.mjs` from GISCO countries 2024: 1:20 million simplified together with topojson, plus a 1:3 million outline per country for its opened view) and `nationalAssociations.json` (copy of `https://www.ethicalmedtech.eu/data/national-associations.json`, written by `scripts/sync-national-associations.mjs`). `useNationalAssociations.js` fetches the published list once per visit and falls back to the copy; `readAssociationsList()` keeps only `http(s)` addresses.
- `validate:data` (`utils/geographicArea.js`): the areas must equal the Code's two lists, the Mecomed note must be in the text word for word, and every area needs a shape. Notes list countries without a published Code and published countries outside Annex III. Tests: `tests/geographicArea.test.mjs`.
- New dev dependencies: `topojson-server`, `topojson-client`, `topojson-simplify` (build script only). `.cache/` is ignored by Git.
- Depends on ethicalmedtech.eu publishing `/data/national-associations.json` with `Access-Control-Allow-Origin: *` and an `id` per country card; until then the map uses its copy and the country links open the page without scrolling to the card.

### Pages for search engines — 2026-10-30
- Every page has its own title, description and canonical link. `src/utils/pageMeta.js` (`createPageList()`) lists each page a visitor can open directly (47: the home page, the Code's landing page and chapters, Version History, the decision trees and the event support checker, Transparency and its units, Historical Declarations, the Quiz and the TPPT Checker) from the live data; `useAppRouting.js` shows the current page's in the document head (`config/pages.js`).
- `npm run build` ends with `scripts/prerender-pages.mjs`: one HTML file per page in `dist/prerendered/`, the built `index.html` with that page's title, description, canonical link, `og:url` and its text in `#root` (chapter and unit sections with their Q&As, a tree's first question, the landing pages' lists, and links to every page), which the app replaces when it starts. The content's HTML passes through an allowlist (`sanitizeContentHtml()` in `scripts/lib/prerender.mjs`: structure tags only, no attributes but table spans, tags balanced, stray `<` escaped). The files are written after the service worker, so they are not precached. `dist/sitemap.xml` is generated from the same list and `public/sitemap.xml` removed; the sitemap gains `/event-support`.
- `server.js`: `run_worker_first = ["/*", "!/assets/*"]`, so the Worker sees every page request. GET/HEAD requests for `www.` or trailing-slash addresses redirect (301) to the canonical address (`canonicalRedirectUrl()`; `/api/` and `/admin` excluded). An extensionless path is served its file from `dist/prerendered/` (`prerendered-pages.js`), any other gets the app shell with a 404 (without the request's cache validators), unless the build wrote no page files, when it gets the shell with a 200 as before. `/prerendered/*` is never served directly. The content editor's paths now go to the assets binding unchanged: with the Worker first, requesting `/admin/index.html` would have redirected `/admin/` to itself.
- Tests: `tests/pageMeta.test.mjs` (every listed path is a canonical route, every chapter, tree and unit has a page, unique titles, descriptions within 160 characters, the sanitizer, each page file's head and full text, the sitemap); `tests/serverSpaFallback.test.mjs` rewritten for pages, 404s, redirects and the missing-files fallback.

### Content editor — 2026-10-21
- Replaced Decap CMS with Sveltia CMS 0.230.0 at `/admin/` (pinned with its SRI hash, loaded after `CMS_MANUAL_INIT` so `public/admin/cms-fields.js` registers its parts first), under a bar linking to Content history and the app. Same OAuth proxy (`auth_endpoint: auth`, as Sveltia joins it with "/"); `backend.repo` corrected to `MedTech-EUR/MTE-Code-App`. Chapters are file collections grouped by part in the Code's order, so the sidebar matches the app; sections and Q&As stay locked. Uploads go to `public/code-assets/`.
- Decision trees: nodes are a variable-type list (`question`/`result`, Sveltia's `type` key), `relatedChapter` a multiple select of chapter IDs, the live CVS check texts an optional object, and the outcome select now lists all ten outcomes (`prior-review` and `more-info` were missing, so a save could have blanked them).
- `exact-html` is now a Sveltia custom field (React via Sveltia's `createClass`/`h`): Edit (raw HTML), Preview (sandboxed frame with the app's built stylesheet, `/admin/app-style.css`), and Changes (word diff against the saved value, read from the entry's `raw` at the field's `data-key-path`), with a `checkHtml` warning for unclosed or misnested tags. Preview templates render each chapter like the reader and walk each tree from `start` (`public/admin/lib/trees.js`).
- The data is kept in the layout Sveltia writes (`public/admin/lib/cms-format.js`, `npm run format:data`, checked by `validate:data`): `JSON.stringify(_, null, 2)` + newline, keys in config order, every shown field present, and every text trimmed (Sveltia trims all string values on save, with no option to stop it). Three one-time commits applied it: indentation only for the chapters; lists and explicit empty fields for the trees; and removal of the single leading space of 58 section texts (rendering unchanged; `verify:code-docx` findings unchanged). Verified with Sveltia's test-repo backend: an edit saved in any chapter file or the trees changes exactly one line.
- `validate:data` also reports malformed HTML in Code texts, requires the tree list fields, reads empty tree fields as not set, and notes tree steps unreachable from `start`. `npm run build` runs it first. `tests/cmsConfig.test.mjs` checks `config.yml` against the data, the layout and the app's accepted values.
- Added Content history (`/admin/history/`, routed by `server.js`): saves listed with the fields they changed; undo of a save or of one change by a three-way, field-level merge (`content-model.js`: chapters keyed by position, trees by tree and step ID), refused with an explanation when a field changed again later; whole-version restore; blob/tree/commit/ref writes with an expected-blob check and one retry on a non-fast-forward. Tested end to end against a simulated GitHub over a real clone.
- Removed `decap-server`, `concurrently` and the `npm run cms` scripts; added `yaml` (dev) for the config test. The PWA no longer precaches `admin/**`.

### Q&A actions — 2026-10-21
- Every official Q&A (Code and Transparency) has its own Bookmark, Cite/Link and Copy Text buttons. The section's buttons and the Cite/Link menu moved into `ReaderActions.jsx`, used for both; the copied text comes from `utils/citationText.js` (citation formats, the Q&A's printed "Q&A N" from its `label` or the start of its question, a Q&A as plain text). A Q&A is cited, linked and bookmarked by its existing anchor (`getQaAnchorId`), so no route or data changes; its title is the section's plus the number, e.g. "Ch 4 - 3. Educational Grants, Q&A 31".
- In the Code reader the Q&A buttons fade in on hover of the Q&A (`group/qa`) or keyboard focus in it, like the section's; the Transparency reader always shows them. They float beside the first line of the question from `sm`, and take their own row above it on phones. Each button's accessible name includes the Q&A number ("Cite/Link Q&A 31").
- Copy Text no longer adds "Q: " before a Code question that opens with its "Q&A N" number (section and Q&A copies alike).

### Glossary definitions — 2026-10-20
- Split the Glossary's single "Definitions" section into one section per definition (38), each titled with its term exactly as its bold headword gives it, so every definition has its own route (`/code/glossary#glossary-<term>`), bookmark, Cite/Link menu and table-of-contents entry. The text is unchanged: the definitions joined back together reproduce the former section's text byte for byte, and `npm run verify:code-docx` reports the same findings before and after. `npm run validate:data` now requires one definition per Glossary section, titled with its term. As documented in `PROJECT_CHECKS.md`, the historical `verify:code-migration` check differs from its 2026 baseline after approved edits; this adds to that.
- `FullTextSection.jsx` keeps a Glossary section's title for screen readers and the table of contents but does not show it, since the definition opens with its term in bold.
- In the Code reader, a section's Bookmark, Cite/Link and Copy Text buttons are hidden at rest on devices that can hover (`[@media(hover:hover)]`) and fade in on hover of the section (`group/section`) or keyboard focus within it (`:focus-visible`, so a mouse click does not hold them in view): 350 ms in, 500 ms out after a 150 ms pause. They are opacity-only, so they stay focusable and in the accessibility tree. A bookmarked section's star stays visible, the buttons stay while the Cite/Link menu is open, and the Transparency reader is unchanged.
- The definition side panel's "Open the Glossary" opens the definition's own section (`App.jsx`).
- The event support checker's sources can name a section by title (`"sectionTitle"`), resolved by `findSourceSectionIndex()` in `eventSupportRules.js` for both the result's Sources list and `validate-data.mjs`. Its three reasons that cited the whole Glossary now cite the definitions they rely on: Delegate and Faculty (poster presenters), Virtual Event (hybrid Events), Proctorship and Preceptorship. The wording and logic are unchanged, so the rules version stays 2026-09-27.2; the Word review copy still lists "Glossary › Definitions" for the Proctorship activity.

### Integration — 2026-09-29
- Combined the latest event-support and Annex I CVS work with the expandable-reference branch on main. Preserved the current decision-tree components and moved the chapter preview fallback into `getReferencePreviewHtml()`, shared by tree results and the checker's small-screen dialog.
- Extended the restored side-panel behavior to the event-support checker: reset disclosure rows and scroll position when changing references, keep the reader's position while resizing, and retain its answers when opening a referenced section in another tab.

### Added
- Added the “Can we support this event?” checker (`/event-support`, listed on the Decision Trees page). It was built on the `codex/event-support` branch, which was cut from a `main` 22 commits old; it is ported onto current `main` and rebuilt against the Code:
  - All wording (questions, conditions, reasons, outcomes), the Annex I and Annex VI tables with their verbatim cell text, the sources and the CVS status labels are in `src/data/eventSupportRules.json`. The evaluator (`src/utils/eventSupportRules.js`) returns message and source IDs; `src/utils/eventSupportQuestions.js` asks only questions that can change the result; `src/utils/eventSupportCvs.js` reads CVS statuses. Validation moved from the client bundle to `scripts/validate-data.mjs`, which also checks every “Chapter N, Section N”, “Annex N” and “Q&A N” in the wording.
  - Glossary terms and Code references in the checker are linked like the reader's, and preview in the side panel from 1280px or in the definition dialog below; the Code opens in a new tab so the answers are kept (`linkedTextEvents.js` now holds the handlers shared with `FullTextSection.jsx`; `DefinitionPopup` takes an optional `action` link).
  - The Worker answers `/api/cvs/search` and `/api/cvs/events/:emtId` (`cvs-api.js`, `cvs-adapter.js`, `cvs-parser.js`) by reading the public CVS site; `scripts/check-cvs-live.mjs` checks it against a running Worker. The `/prototypes/cvs` demo page and the `wrangler.toml` `run_worker_first` entry from the branch were not ported.
  - Logic aligned with the Code: Mecomed countries are in the MedTech Europe Geographic Area (only the CVS vetting differs); hybrid Events follow the in-person rules; Virtual Events need no CVS decision and allow no direct support of attendance; binding negative and missing CVS decisions stop the support; grants may not go to travel agencies or individuals, but a travel agency may be paid on the recipient's behalf; identifiable grant beneficiaries rule a grant out; a procedure training that does not qualify is assessed as a conference; answering “No” to a Code requirement changes the outcome. See `docs/event-support.md`, which also lists the interpretations for a content owner to confirm.
  - `tests/eventSupport.test.mjs` covers all 32 Annex I and 16 Annex VI cells and walks every path through the questions checking each answer's consistency; `tests/cvs.test.mjs` runs the CVS modules in the Workers runtime against fixtures.
- Added a deterministic, in-browser search engine with no new dependencies. It indexes every Code provision, official Q&A and Glossary definition (and each Transparency provision and Q&A) and ranks them with BM25F, coverage and proximity.
- Everyday wording now finds the Code's formal wording:
  - word forms (plurals, -ing, -ed), checked against the current text;
  - spelling correction for unknown words;
  - abbreviations in both directions (HCP ↔ Healthcare Professional);
  - Glossary links for rare words (spouse → Guests);
  - a general-English phrasebook (`src/data/search/phrasebook.json`, e.g. doctor → physician, wife → spouse), whose structure `npm run validate:data` now checks.
- Added explained results: type badges, snippets, "Matched:" lines, and notes on expansions, spelling corrections, words that match nothing, and results without every word.
- Added search shortcuts: quoted text matches as an exact phrase (every word in order, small words included, word forms still counting), "Q&A 31" shows that Q&A, a Glossary term shows its definition first, and the last word is completed while typing.
- When a typed word is not in the Code (or the Guidelines), the results say so and list the similar terms searched instead: "“wife” is not in the Code. Showing similar terms that may help: spouse, partner, Guests."
- Added a one-click exact-phrase hint when an unquoted phrase with small words, such as in kind, appears in the text as typed.
- Gave every Code and Transparency Q&A its own deep link (e.g. `/code/ch4#ch4-3-educational-grants-qa-3`); opening one switches Q&As on and scrolls to it.
- Added analytics-ready `mte:search` browser events (`settled`, `select`); nothing is sent or stored.
- Added `?searchDebug=1` to show each result's score, coverage and proximity.
- Added the maintainer tools `npm run search:explain -- "<query>"` and `npm run search:report`; `search:report` also takes `--queries <file.json>` and `--json`.
- Added Historical Declarations (`/transparency/historical-declarations`): search past transparency declarations by company or beneficiary name, filter by year, beneficiary country, company country, type and currency, and open a detail dialog. It is reachable from the Transparency landing page and sidebar, and served read-only by the Worker from a Cloudflare D1 database through `/api/historical-declarations/*`, with a capped result window.
- Added a page description, Open Graph and Twitter sharing tags, `robots.txt` and `sitemap.xml`.
- Added Version History entries for July 2026 Update 3, August 2026 Update and September 2026 Updates 1 and 2, reconstructed from the Git history, and listed the recent-search, Copy Text and Send a Suggestion features missing from July 2026 Update 2.
- Added a side panel docked to the right edge of the window beside the Code and Transparency reader text from 1280px (`#side-pane` in `DocumentReader.jsx`; `useSidePanelFits.js`). It holds "On This Page" and shows one item at a time, only on request (`ContextPanel.jsx`): a Glossary definition instead of the modal, a cross-referenced chapter, section or Q&A, or a search result (new eye button on each result). Esc and × close it and return focus to the opener; "On This Page" shrinks to one line while it is open, and with nothing open the panel says how to use it. The text and the panel scroll separately.
- Added cross-reference links (`utils/crossReferences.js`, `data/referenceIndex.js`). "Chapter 4", "Section 3 of Chapter 4", "Chapter 4, Section 3", "Chapters 1, 2 and 4", "Part 2", "Annex III", "Q&A 3" and, in Transparency publications, "Section 2.2" are linked at render time with real `href`s; numbers are read from the loaded titles. In a Transparency publication, "of the Code" or a number the publication lacks means the Code's chapter. A page never links to itself, and a missing section falls back to its chapter. Nothing in the stored text changes.
- `npm run validate:data` checks every cross-reference and decision-tree citation: unresolved ones are errors, chapter fallbacks are printed as notes (currently two: "section 3 of Chapter 2" in Chapter 1, where Chapter 2 has two numbered sections).
- Decision-tree results preview their cited provision in place ("Reference" expands, with "Open in the Code"), so the tree keeps its answers.
- Added resizable panes (`ResizeHandle.jsx`, `usePaneWidths.js`, `utils/paneWidthUtils.js`). From 1024px the sidebar is docked to the left edge of the window; it and the side panel are resized by dragging their inner edge (col-resize cursor), or by focusing the edge and using the arrow keys (Shift for 64px steps, Home and End for the narrowest and widest). Double-click restores the default width and Esc cancels a drag. Widths are saved in rem in `localStorage` (`mte_pane_widths`) and applied before the first paint. `--sidebar-size` and `--side-pane-size` in `index.css` keep each pane within its limits and the text at least 30rem wide, whatever the window. The handles are `role="separator"` elements with `aria-valuenow` as a share of the window width.
- Added "Line length" (Narrow, 40 × text size; Standard, 52 × text size, the default; Full, filling the space between the panes) and "Side panel" (On / Off) to the `Aa` reading settings; saved settings from before are upgraded with defaults.
- Added a `3xl` breakpoint (150rem, 2400px at the default text size) in `index.css`. Arbitrary `min-[2400px]:` variants are sorted before the named breakpoints and lose to them.
- Added a "Your answers" column to decision trees from 1280px; any earlier answer can be changed from it.
- Added the self-hosted Inter typeface (`@fontsource-variable/inter`, normal and italic); its Latin subset is precached for offline use.
- Added tests for cross-references, saved pane widths and the new reader settings.
- Cross-references in the side panel expand to the full text. A chapter lists its summary and each section as a disclosure row (`aria-expanded`); a row opens to the section's text, its Q&As and "Go to this section", and "Expand all" / "Collapse all" toggles every row. The summary starts open, or the first section when there is no summary; a chapter that is one section without a summary shows its text directly. A section's Q&As open from a row below its text. An open row's heading sticks to the top of the panel while its text scrolls, and closing it from there brings the heading back into view. `describeReferenceTarget()` now returns `sections` for a chapter and `qas` for a section (unit targets carry their section targets; section targets their `ownTitle` and Q&As; `firstSectionHtml` is gone), and a chapter's label is "Chapter" rather than "Chapter summary". `tests/contextPanel.test.mjs` renders the starting states.
- Added `useKeepReadingPosition.js`: when the reader text or the side panel changes width (a pane dragged or keyed to a new width, the window resized), the character at the reading point, a quarter of the way down, stays where it was. Browser scroll anchoring pins the top of the first visible block instead, which drifts inside long paragraphs, lost the place entirely on Home/End resizes, and does not exist in Safari. The browser's own adjustment during a resize is not mistaken for the reader scrolling, and a series of resize steps keeps the first reading so the place does not creep along a line.

### Changed
- Rebuilt the decision tree “When are CVS assessments required?” (`dt-annex1-cvs-scope`, now “Conference Vetting System check”) as the quick Annex I check; the event support checker stays as the exhaustive tool. The tree asks about the Event first (where it takes place, then the checker's national/international question), so every answer shares one audience question; then the eight types of support in Annex I. Results start with the Annex I cell; online-only Events are outside CVS; Annex I footnote 3 applies to attendance grants and footnote 5 to grants only. Results that depend on CVS set `cvsCheck` (`required` or `national`) and show `TreeCvsCheck.jsx`, which reuses the checker's CVS lookup; `utils/treeCvs.js` picks the text for the live status from the tree's `cvsCheck`, keyed by the 12 CVS 2.0 status labels. New `more-info` outcome; `scripts/validate-data.mjs` checks `cvsCheck`; `tests/annex1Tree.test.mjs` checks all 32 Annex I cells through the tree and `tests/treeCvs.test.mjs` the status texts.
- The Home Hub card and the sidebar entry that opened the event support checker now open the decision tree “Conference Vetting System check” (`CVS_CHECK_TREE_ID` in `src/config/sections.js`, new `CVSBadge` icon). The checker is listed on the Decision Trees page as a card among the trees (`TREE_PAGE_TOOLS`), and its back link returns there.
- The tree's answer card shows the CVS result. `TreeResultCard.jsx` (extracted from `DecisionTree.jsx`) takes the outcome from `getTreeCvsOutcome()` in `utils/treeCvs.js`: Compliant or Non-Compliant with a final decision, Conditional while one is pending or no Event matches, and Conditional for a national Event found in CVS. `TreeCvsCheck.jsx` puts the status text and the selected Event (`CvsSelectedEvent`, now exported by `CvsEventLookup.jsx`) under the card's text and scrolls back to the card when a status arrives. `tests/sections.test.mjs` checks the card's tree and the listed tools; the icon-registry test now also scans `src/config`.
- Brought the event support checker in line with the review of its Word copy (rules version 2026-09-27.2):
  - A CVS decision binds only the support that Annex I makes subject to one (Q&A 16): a Not Compliant or Not Pre-cleared Event no longer rules out, for example, a booth at an Event outside the Area, and the answer says what to check (`cvsNegativeNotNeeded`, `cvsNotPreClearedNotNeeded`). Not Pre-cleared has its own status group (`cvsStatuses.notPreCleared`) and texts.
  - A national Event with a CVS record gets one contradiction warning (`nationalRecord`) for any status but the two exempt ones; a national Event with no record no longer gets the "CVS scope not confirmed" warning (`getScopeUnconfirmedWarning` removed). The national/international question uses the Conference Vetting System check's wording and help.
  - Events in Mecomed countries follow Mecomed's CVS scope, national Events included (`setMecomedCvs`; new `mecomedCvs` source on mecomed.com, which `scripts/validate-data.mjs` now accepts beside ethicalmedtech.eu), and get no national-Event warning.
  - A Virtual Event is no longer assessed through Annex I's outside-the-Area columns: a booth there without HCPs from the Area comes within the Code through an organiser in the Area, and an attendance grant cites the Code's scope, not footnote 3.
  - Company attendance asks no location or audience and quotes the column-independent Annex I rule (`annex1AllColumns`); direct support at a procedure training stops once the programme fails the Annex VII thresholds (`tpptAgendaFails`).
  - Answers open with a text for their outcome (`outcomeTexts`, which the validator requires for every outcome), followed by a reminder to check the Code's text when in doubt (`codeDisclaimer`); answers about a third-party Event add a collapsed "Additional considerations" note. A missing CVS record points to submitting the Event (Q&A 32); labels, the introduction and the loading message were reworded.
  - Left out until guidance is published: childcare, the Regional Capitals approach (from 1 November 2026) and purely policy-focused conferences.
  - `inKindTpptAttendance` quotes the Delegate-costs activity by its current name. The Word review copy (`docs/event-support-wording-and-logic.docx`) is regenerated for this rules version, with the Conference Vetting System check's wording added as Part 9.
- Search results are now a ranked list of individual provisions, Q&As and definitions in the sidebar. This replaces the chapter tree with per-chapter match counts and Title / Q&A / Text pills. App-written summaries are listed separately as "not Code text".
- Replaced the Titles / Full Text / Q&As filters with Provisions / Q&As / Definitions type chips.
- The reader now highlights the words that actually matched, including expansions, instead of the literal query.
- Search is rebuilt from the current content on every app load, so Code updates need no search changes.
- Version History has its own top-level "Website" sidebar group, shown in every section, instead of a "Website" part inside The Code. Website pages are left out of the Code landing page and the Code's Previous/Next navigation (`CODE_CHAPTERS` and `WEBSITE_CHAPTERS` in `codeData.js`); the chapter file and its `/code/changelog` route are unchanged.
- Glossary links cover every defined term, including abbreviations, plurals and short names introduced in brackets. Each term links once per section, at its first occurrence, and opens in an accessible dialog.
- Reading settings are remembered between visits, pinch-to-zoom is re-enabled, and teal text uses `#007A86` for AA contrast.
- The Code's Word working copy is rebuilt verbatim from the PDF and checked by a strict verifier; five Code text corrections bring the JSON in line with the published Code.
- Expanded the search phrasebook with Code and Disclosure Guidelines vocabulary. Overlapping rules keep their strongest weight, and validation rejects duplicate sources after normalization and stopword-only phrases.
- A multiword phrasebook source is recognised only in a scope where the phrase or one of its targets occurs; elsewhere its words are searched one by one. Everyday words the expansion had dropped were restored, rules whose targets never occur were repointed, and sentence-specific entries were removed.
- Reader layout: the reading area fills the space between the sidebar and the side panel. Its text is centred and capped at `--reader-measure` (52 × reader font size by default, about 105 characters per line). The side panel's default width follows the window (18–40rem), so the text keeps its place from page to page. Section actions wrap under long titles instead of squeezing them.
- Sidebar: full-width search box, tighter padding, chapter names on up to three lines (full name on hover) instead of an ellipsis, and a default width that follows the window (20–30rem). Below 1024px it is the slide-in menu (was below 768px), header toolbar labels show from 1024px, and `/` opens the menu before focusing search.
- Home shows three section cards per row from 1280px and all five from 2400px, with a smaller heading (`Logo` accepts `size={null}` for class-based sizing). The Code landing page uses four columns from 1536px and five from 2400px; the decision-tree landing page three from 1280px and four from 2400px.
- Quiz setup lists chapters in a grid with the question count and Start button in a sticky column from 1024px, without the inner scrolling box.
- TPPT Checker: from 1440px the agenda and sessions are on the left and the result, questionnaire, outcome and PDF export in a sticky right column.
- From 2400px the root font size is 112.5%, and the landing pages, Quiz setup, TPPT Checker, decision trees and Historical Declarations use more of the width.
- Cross-reference links keep the text's weight with a light underline, and print as plain text.
- The side panel's padding is on an inner box (so sticky headings reach the panel's top edge), the panel is a size container, and panels narrower than 24rem use 0.75rem side padding (`px-3 @sm:px-6`). Text in the panel breaks long words, and tables scroll sideways inside the panel.

### Fixed
- On Cloudflare, every CVS search in the event support checker failed with “CVS could not serve the requested page”. The Worker's requests to CVS set `cf.cacheTtl`, which makes Cloudflare cache the page and drop its `Set-Cookie`, so the search POST had no session and CVS redirected it to its login page. Local runtimes ignore `cf`, so the tests and `wrangler dev` passed. The requests now carry no `cf` cache options, and `tests/cvs.test.mjs` checks that.
- The TPPT calculator accepted negative or blank durations and unknown session types, which skewed the percentages; it now refuses them (`valid: false`) and the TPPT Checker asks for a correction instead of showing a result.
- The Annex I decision tree answered direct sponsorship of HCPs as “CVS decision required, direct support generally not permitted”. Annex I says “Not allowed”, whatever CVS decides; the answers now lead to that result, and the tree's result texts were corrected.
- The service worker no longer answers browser navigations to `/api/*` with the app shell.
- Multi-word everyday queries such as "wife travel" or "hospital donation" used to return nothing unless the exact phrase appeared in the text.
- The chapter summary is no longer re-sanitized on every re-render, which cleared any text selected in it.
- Quoted searches ignored small words: "in kind" searched only "kind" and also matched "different kinds of". Phrases now keep their small words.
- Phrasebook phrases with small words collapsed to a single everyday word, so plain queries picked up wrong expansions: "travel cost" also searched "free of charge" and "in kind", because "at no cost" had become "cost". A phrasebook phrase now applies only when typed as a phrase, and a typed phrase counts as present in the text when it appears anywhere.
- Deep links to chapters, Transparency pages, decision trees and the TPPT Checker opened the home page on a first visit. The Worker's app-shell fallback now requests `/` instead of `/index.html`, which the assets binding redirected.
- The TPPT PDF report printed the larger-event answer under the opposite question ("Stand-alone event?"); the screen and the PDF now share one set of question texts. A TPPT chunk that fails to load shows a reload message instead of a blank app.
- Quiz answer icons were white on white, the results badge had no background, and the question-count slider had no label.
- The Historical Declarations API clamps the page size, matches search text literally, ignores whitespace-only text, and returns 404 for malformed ids.
- Every page load downloaded the 1.8 MB `tppt-pdfmake` chunk, and an installed app reloaded offline showed a blank page, because Rollup's shared CommonJS helper landed in that lazy chunk. It now has its own `commonjs-helpers` chunk (`vite.config.ts`); the entry bundle no longer imports any `tppt-*` chunk.
- The app named Inter but never loaded it, so readers saw Helvetica or Arial depending on their system.
- The header toolbar ran off-screen between 768px and 959px, hiding Q&A, Aa and Print.
- Four sidebar buttons combined full width with a left margin and overflowed the sidebar by 8px.
- A new item in the side panel opened at the previous item's scroll position, so after scrolling down one reference the next could open scrolled past its title. Each item now opens at the top (`ContextPanel` is keyed by item, and the panel scrolls to the top when the item changes).
- Resource links in the side panel, such as the Disclosure Guidelines' Annex I CSV template link, were stripped by the sanitizer; they now resolve as in the reader text.

---

## [1.6.0] - 2026-07-28

### Added
- Added the Transparency hub and a registry for standalone publications.
- Integrated the October 2025 Disclosure Guidelines as seven verbatim reader units: Preamble, Chapters 1–3, and Annexes I–III.
- Bundled the Annex I declaration CSV, retained the publication's exact linked words, and added a clearly labelled non-normative in-app preview.
- Added source-fidelity verification for the PDF, CSV, reader JSON, visible text, lexical boundaries, Q&As, annex structures, runtime publication registry, and emitted offline assets.

### Changed
- Extracted the shared `DocumentReader` used by the Code and Transparency.
- Extended routing, direct links, search, bookmarks, recent history, citations, print behavior, responsive navigation, and offline precaching to Transparency publications.
- Shared the Code glossary with Transparency publications and all official reader Q&As so defined terms open the same pop-up definitions while preserving their visible text verbatim.
- Documented the publication registry, source-replacement controls, offline resource limits, routing stability rules, and release checks.
- Consolidated the redundant section-level `Cite` and `Link` actions into one `Cite/Link` menu across Code and Transparency readers.

### Fixed
- Scoped standalone-publication table defaults so they cannot override existing Tailwind-authored Code annex tables.
- Added an accessible name to the mobile navigation control.
- Cancelled stale delayed anchor scrolling/highlighting after rapid route or Back/Forward changes.
- Made whitespace-only searches empty, restored expansion state per legal collection, and revealed Q&As when selecting a Q&A-only result.
- Moved Chapter 1 Scope footnote 1 to the end of the continuous-reader section while preserving its source marker, wording, and fidelity proof.

---

## [1.5.1] - 2026-07-24

### Changed
- Expanded `README.md` with the step-by-step chapter and section maintenance guide.
- Recorded recent searches only after explicit confirmation or result selection, rather than after every pause while typing.
- Updated the reading-progress indicator through `requestAnimationFrame` and a DOM transform to avoid rerendering the full chapter on every scroll event.

### Fixed
- Prevented Code section action controls from overflowing the mobile reader.
- Hid Q&A jump controls whenever Q&A content is disabled.
- Registered all component icon names and added a regression check for silent fallback icons.
- Added clipboard failure feedback, citation-popover keyboard handling, and accessible live announcements.
- Added suggestion-dialog semantics, associated labels, focus trapping and restoration, Escape handling, and background scroll locking.
- Added an informative empty state when decision-tree filters return no matches.

---

## [1.5.0] - 2026-07-23

### Added
- **Multi-Format Citation Menu**: Popover menu in `FullTextSection.jsx` offering Formal Citation (with access date `(Accessed DD Month YYYY)` and section title), Markdown Link, and Direct URL Link.
- **Copy Plain-Text Section**: Added `[Copy Text]` button in `FullTextSection.jsx` that strips HTML markup and formats legal body text and Q&As for email/memo drafting.
- **Search Category Breakdown Pills**: Sidebar search results now display match counts broken down by `Title`, `Q&A`, and `Text` categories with tooltip counters.
- **Decision Tree Filter Search**: Added real-time keyword search bar in `TreeLandingPage.jsx` for filtering decision tree guides.
- **"Send a Suggestion" Feature**: Header toolbar button and responsive `SuggestionModal.jsx` popover providing direct `mailto:ethics@medtecheurope.org` pre-filled draft generation and clipboard copy fallback.
- **Q&A Fast-Jump Badges**: Added Q&A-count buttons next to section titles that smooth-scroll directly to guidance notes.
- **Sticky Reading Progress Line**: Added scroll percentage line across top of `MainContent.jsx`.
- **Recent Search Chips**: Added `localStorage`-backed recent search chips under the sidebar search bar.

### Changed
- Reorganized public `src/data/code/changelog.json` into `July 2026 Update 2` and `July 2026 Update 1`.
- Updated `AGENTS.md` to version v1.6 with documentation for the new utilities.

---

## [1.4.0] - 2026-07-23

### Added
- **Knowledge Quiz Module**: Configurable quiz setup (`QuizConfig.jsx`), interactive gameplay (`QuizSession.jsx`), score evaluation (`QuizResults.jsx`), and question bank (`src/data/quizData.json`).
- **TPPT Checker Tool**: Agenda ingestion engine for PDF/Word/text (`tpptParser.js`, `tpptExtraction.js`), practical & hands-on duration eligibility calculator, interactive session editor (`TPPTContent.tsx`), and assessment PDF exporter (`pdfmake`).
- **Content Verification Tooling**: Added the PDF audit, migration verification, raw JSON extraction helpers, and supporting maintainer documentation.

### Changed
- **Modular Code Content**: Split monolithic `codeData.json` into canonical single-chapter files in `src/data/code/*.json`, with explicit ordering in `codeOrder.js` and the compatibility adapter in `codeData.js`.
- **CMS and Print Workflow**: Updated the local Decap CMS editing workflow and refined print presentation while preserving existing routes and section links.

### Fixed
- **Canonical Content Reconciliation**: Reconciled PDF-backed chapters against the September 2024 source, restored identified omissions and the Annex III geographic map, and retained documented corrections to obvious source typographical errors.

---

## [1.3.0] - 2026-07-22

### Added
- **Centralized Routing Engine**: Pure URL route parser `src/utils/routeUtils.js`, content registry `src/config/routes.js`, and browser synchronization hook `src/hooks/useAppRouting.js`.
- **Data Validation & Verification Suite**: Dependency-free validator `scripts/validate-data.mjs` and Node test suite `tests/` covering route round-trips, section anchor stability, and data schema rules.
- **Developer Documentation**: Maintainer guides `ROUTING.md`, `PROJECT_CHECKS.md`, and content migration proof docs.

---

## [1.2.0] - 2026-05-24

### Added
- **Decap CMS Integration**: Administrative CMS at `/admin/` backed by Cloudflare Worker OAuth proxy (`server.js`) with HMAC CSRF state tokens.
- **Glossary System**: Automated glossary term detection (`processTextWithTerms`), interactive tooltip popovers (`DefinitionPopup.jsx`), and DOMPurify HTML sanitization.

---

## [1.1.0] - 2026-04-28

### Added
- **Multi-Section Architecture**: Home Hub landing page (`HubPage.jsx`), section registry `src/config/sections.js`, and section-aware header toolbar (`Header.jsx`).
- **Interactive Decision Trees**: Compliance step-by-step engine (`DecisionTree.jsx`), flowchart visualization (`TreeVisualization.jsx`), and cross-linking callouts.
- **User State Persistence**: `useBookmarks.js` and `useRecentHistory.js` for `localStorage` section bookmarking and last 5 visited chapter history.
- **Reader Controls & Print Engine**: Customizable reader settings panel (font size, line height, paragraph spacing) and clean `@media print` layout.

---

## [1.0.0] - 2026-04-15

### Added
- **Initial Digital Release**: Canonical digital MedTech Europe Code of Ethical Business Practice application.
- **Core Reader & Search**: Full legal text renderer (`FullTextSection.jsx`), sidebar search with mark highlighting, table of contents minimap, PWA offline caching (`vite-plugin-pwa`), and brand styling.
