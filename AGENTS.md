# Agent Instructions

<!-- Version: v1.9 - 2026-09-25 -->

## Table of Contents
- [Hard Rules](#hard-rules)
- [Project Map](#project-map)
- [Standards](#standards)
  - [Architecture & State](#1-architecture--state)
  - [Styling & Branding](#2-styling--branding)
  - [Components & Icons](#3-components--icons)
  - [Data Handling](#4-data-handling)
  - [Naming Conventions](#5-naming-conventions)
- [Example Snippets](#example-snippets)

## Hard Rules

These rules are mandatory for every agent, on every task.

<!-- CLAUDE.md repeats the Version History rule in brief. Keep the two in step. -->

### Propose a Version History Update Before Every Push

Before you commit and push, propose a draft update to the in-app Version History (`src/data/code/changelog.json`, shown at `/code/changelog`) and wait for the user's approval or edits. Then add the approved text to `changelog.json` in the same push as the changes it describes.

- **Draft:** Cover every user-facing change in the push. Say whether it is a new entry, with a title in the style of the existing ones (such as “September 2026 Update 2”), or an addition to the current entry. Show it as plain headings and bullets, not HTML.
- **Apply:** Copy the markup of the latest entry. A new entry goes at the top and takes the “Current” badge from the previous one; otherwise leave earlier entries as they are unless the user asks. Then run `npm run validate:data`.
- **Nothing user-facing:** If the push changes nothing users see or do (for example documentation, tests, tooling, or a refactor with no visible effect), say so in one line instead of drafting an entry.
- **No one to ask:** In an unattended run, commit the draft with the changes and flag it for review in the commit message and pull request description.

Write for the people who use the app, not for developers:

- Describe what users can now do, what looks or works differently, what was fixed, and any correction to the Code or Transparency text. Use plain language, the names shown on screen, and the style of the existing entries.
- Leave out how the change was built: architecture, refactors, file and component names, dependencies, tests, tooling, documentation, and hosting, infrastructure or administration details. Those belong in `CHANGELOG.md`.
- Mention an architectural or technical change only when users notice its effect, and then describe the effect, not the mechanism. Write “Direct links to chapters now open the right page on a first visit”, not “The Worker's app-shell fallback now requests `/` instead of `/index.html`”.

## Project Map

The project is structured around a centralized state architecture in `App.jsx`, which manages top-level navigation and shared utilities.

- **`src/App.jsx`**: The core orchestrator. It manages the `activeSection` (Home Hub, Code, Transparency, Decision Trees, Quiz, TPPT), the active Transparency publication, and shared reader state. Custom hooks synchronize state with the browser URL and `localStorage`. `TPPTContent` is loaded via `React.lazy()` so its heavy dependencies (pdfmake, pdfjs-dist, mammoth) are not included in the main bundle.
- **`src/components/`**: UI building blocks.
  - **Layout Components**: `Header.jsx` and `Sidebar.jsx` are persistent across sections. `Header` dynamically changes its toolbar based on the `activeSection`. `Sidebar.jsx` hosts the search box; while a search is active it shows `SearchResults.jsx` (ranked provisions, Q&As and definitions with type chips) in place of the navigation groups.
  - **Section Controllers**: `MainContent.jsx` (Code), `TransparencyContent.jsx` (Transparency publications and resource mapping), `TreeContent.jsx` (Trees with `TreeLandingPage.jsx` filter search; the page also lists the tools in `TREE_PAGE_TOOLS`), `QuizContent.jsx` (Quiz), `TPPTContent.tsx` (TPPT Checker) and `EventSupportContent.jsx` (the “Can we support this event?” checker, lazy-loaded and listed on the Decision Trees page) act as sub-routers and layout managers for their respective features.
  - **Feature Components**: `DocumentReader.jsx` provides the shared Code/Transparency reader shell: a reading area whose text is centred and capped at `--reader-measure` and, from 1280px, the side panel docked to the right edge of the window (each scrolls on its own). Specialized UI includes `DecisionTree.jsx` (interactive logic; answers column from 1280px; cited provisions preview in place; answer card `TreeResultCard.jsx`; a result can take a live CVS check, `TreeCvsCheck.jsx`, whose Event status turns the card green, red or yellow), `DefinitionPopup.jsx` (shared Code glossary definitions in Code and Transparency reader text and official Q&As, below the side-panel width), `ContextPanel.jsx` (shown in the side panel: one definition, referenced chapter, section or Q&A, or search result at a time, only on request; a chapter lists its summary and sections as expandable rows, a section offers its Q&As), `ResizeHandle.jsx` (the draggable, keyboard-operable edge of the sidebar and the side panel), `FullTextSection.jsx` (legal text, Q&A, citation, resource-link, glossary, cross-reference, and bookmark rendering), `TransparencyLandingPage.jsx` (publication and unit cards), and `TableOfContents.jsx` (navigation; shrinks to one line while the side panel is open).
- **`src/hooks/`**: Business logic and side effects.
  - `useAppRouting.js`: Drives `App.jsx` state from readable paths, section anchors, and browser Back/Forward events without a routing library. It also upgrades supported legacy hash URLs with `replaceState`.
  - `useBookmarks.js` / `useRecentHistory.js`: Persist user interactions to `localStorage`.
  - `useSearch.js`: Runs the search for the active scope and emits the `settled` event.
  - `useSidePanelFits.js`: Says whether the window is wide enough for the side panel (1280px, `xl`).
  - `usePaneWidths.js`: Saves the widths the sidebar and the side panel were dragged to (`localStorage`, in rem) and applies them as the `--sidebar-width` and `--side-pane-width` CSS variables; `utils/paneWidthUtils.js` validates saved widths.
  - `useKeepReadingPosition.js`: Keeps the reader's place in the reader text and the side panel when their width changes (a pane is dragged, or the window resized): the text at the reading point stays put as the lines rewrap.
  - `usePWAInstall.js`: Manages the PWA lifecycle and install prompts.
  - `useCvsLookup.js`: The event support checker's live CVS search and status lookup (through `utils/cvsLookupClient.js`); `useCheckerText.js` links glossary terms and Code references in the checker's wording.
- **`src/data/`**: The "Source of Truth" for content.
  - `code/*.json`: One canonical MedTech Code chapter per file (Sections -> Q&As).
  - `code-september-2024 (1).pdf`: Authoritative September 2024 published source used to build the editable Word working copy.
  - `code-september-2024.docx`: PDF-derived editable working copy for team review. It is generated by `scripts/build-code-docx-from-pdf.py`, never from the JSON, and retains source-page bookmarks plus an explicit editorial correction record so later Word changes can be reconciled into `code/*.json`.
  - `codeOrder.js`: Explicit chapter order shared by the app and validation tools.
  - `referenceIndex.js`: The cross-reference lookup tables built from the Code's own chapters and the Transparency publications (website pages are not targets).
  - `codeData.js`: Compatibility adapter that assembles `FULL_CODE_DATA` without changing component APIs. It also separates the Code's own chapters (`CODE_CHAPTERS`) from website pages such as Version History, the Legal Notice and the Privacy Notice (`WEBSITE_CHAPTERS`, `part: "website"`; the footer on Home links to those in `FOOTER_PAGE_IDS` in `HubPage.jsx`), which keep their `/code/:chapterId` route but are listed in their own sidebar group.
  - `code-manifest.json`: Frozen raw-byte evidence for the 2026 monolith-to-chapters migration; it is not an everyday content baseline.
  - `search/phrasebook.json`: General-English search phrasebook (see `search/README.md`). It never references Code content, so it needs no edits when the Code changes.
  - `transparency/`: Standalone publication metadata, ordered reader-unit JSON, and source evidence. The Disclosure Guidelines use `transparency/disclosure-guidelines/`; their authoritative PDF and Annex I CSV are `mte-code_disclosure_guidelines.pdf` and `declaration-csv-template.csv`.
  - `transparency/transparencyData.js`: Runtime publication registry and computed-section adapter.
  - `treeData.json`: Graph-based logic for compliance decision trees. A tree's optional `cvsCheck` holds the texts for the live CVS check under results that set `cvsCheck`; `npm run validate:data` checks them.
  - `eventSupportRules.json`: The event support checker's wording (questions, conditions, reasons, outcomes), the Annex I and Annex VI tables with their verbatim cell text, its sources and the CVS status labels. `npm run validate:data` checks its structure and every Code reference in its wording. See `docs/event-support.md`.
  - `quizData.json`: Question bank for the knowledge quiz.
- **`src/config/`**: Shared registries like `sections.js`, which defines the modules available in the Home Hub (the Conference Vetting System check card opens the decision tree `CVS_CHECK_TREE_ID`, which also has its own sidebar entry) and `TREE_PAGE_TOOLS`, the sections listed on the Decision Trees page; `routes.js`, which configures the route parser from live Code, Transparency, and decision-tree data; and `search.js`, which builds each scope's index on first use and prebuilds the Code index on idle.
- **`src/utils/`**: Deterministic helpers for text processing, search highlighting, and ID generation.
  - `routeUtils.js`: Pure URL builders and parsing rules for canonical paths and supported legacy hash URLs.
  - `routeEffects.js`: Cancels/version-controls delayed anchor scrolling and highlighting so stale effects cannot win after Back/Forward or another route change.
  - `searchDocuments.js`: Turns Code and Transparency content into search documents (provisions, Q&As, definitions, app summaries).
  - `searchEngine.js`: Builds the in-memory index for one scope and ranks results with BM25F, coverage and proximity; exports `SEARCH_RANKING` with tuning constants.
  - `searchEvents.js`: Emits `mte:search` browser events (`settled` and `select` types) and provides the `?searchDebug` URL switch.
  - `searchResultUtils.js`: Normalizes whitespace-only queries.
  - `crossReferences.js`: Finds "Chapter 4", "Section 3 of Chapter 4", "Chapters 1, 2 and 4", "Part 2", "Annex III" and "Q&A 3" in reader text, resolves them from the loaded titles (never from a list of Code content), links them when the text is displayed, and resolves decision-tree citations. `describeReferenceTarget()` gives the side panel a target's text, including a chapter's sections and a section's Q&As in full. A page never links to itself; a missing section falls back to its chapter.
  - `searchText.js`: Normalization, tokens with offsets (`tokenizeAllWithOffsets` keeps small words such as "in" for phrase matching), stopwords, bounded edit distance, word forms checked against the current text.
  - `textUtils.js`: Also builds the glossary from the glossary chapter's `<p><strong>Term:</strong>` headwords (a definition runs to the next headword) and links terms in reader text. Terms match as the Code capitalises them, including abbreviations such as HCP, short names introduced in brackets such as “Member Companies”, and plurals. Generic lowercase words stay plain (“In the event that”), and each term links only at its first occurrence per section. Includes `splitGlossaryDefinitions()` (splits glossary into definitions without a DOM) and `getQaAnchorId()` (Q&A anchors). `highlightSearchTerm()` and `Highlight.jsx` accept a RegExp as well as a string.
  - `eventSupportQuestions.js` / `eventSupportRules.js` / `eventSupportCvs.js`: The event support checker: which questions to ask, the evaluator (it returns message and source IDs, never text), and CVS status reading with the warning for a national Event found in CVS. `eventSupportText.js` links glossary terms and references in its wording; `linkedTextEvents.js` holds the click and key handling for glossary terms and reference links shared by `FullTextSection.jsx` and the checker. `treeCvs.js` picks what a decision-tree result says about an Event's live CVS status.
  - `tpptParser.js`: The TPPT agenda parsing engine. Contains `parseTpptSessions()` (the main parser), `classifySessionTitle()` (type classification), `calculateTpptEligibility()` (threshold checker), `normalizeCapitalization()`, `getSuggestedEventName()`, and all time/duration utilities. This is the single source of truth for parsing logic — both `TPPTContent.tsx` and `scratch/analyze_agendas.js` import from it.
  - `tpptExtraction.js`: PDF text extraction using `pdfjs-dist`. Contains `extractPdfPageText()` and `extractPdfTextFromPdf()`. Imported by both `TPPTContent.tsx` and `scratch/analyze_agendas.js`.
- **`scratch/analyze_agendas.js`**: CLI verification script that runs the TPPT parser against real PDF agendas. Imports from `src/utils/tpptParser.js` and `src/utils/tpptExtraction.js` (single source of truth). Run with `node scratch/analyze_agendas.js [pdf-paths...]` to validate session parsing. If no paths are given, reads from `TPPT agendas/` folder.
- **`scripts/build-code-docx-from-pdf.py`**: Rebuilds the editable Code DOCX directly from the hash-pinned September 2024 PDF without reading JSON. It reads each page per column, keeps printed list labels as typed text, and uses Word list formatting only for bullets.
- **`scripts/verify_code_docx_against_pdf.py`**: Strictly compares the DOCX with the PDF word for word (case, punctuation, spacing, superscripts, Q&A labels and bullets). The only accepted wording differences are the corrections recorded in the DOCX. Run it after every rebuild.
- **`scripts/verify-disclosure-guidelines.mjs`**: Pins the Disclosure PDF, CSV, document metadata, raw reader units, visible text, Q&As, and annex structures. Run with `npm run verify:disclosure-guidelines` after any Disclosure source or data edit.
- **`scripts/verify-production-disclosure-assets.mjs`**: After `npm run build`, proves that the emitted Disclosure PDF/CSV remain byte-identical to their sources and appear in the Workbox precache.
- **`cvs-api.js`, `cvs-adapter.js`, `cvs-parser.js`** (project root, beside `server.js`): The Worker's same-origin CVS lookup (`/api/cvs/*`) for the event support checker. It reads the public CVS site's HTML; all selectors are in `cvs-parser.js`. `scripts/check-cvs-live.mjs` runs a narrow live check against a running Worker.
- **`historical-declarations-api.js`** (beside `server.js`): The read-only Historical Declarations API over Cloudflare D1. `oldestPublicYear()` keeps each reporting year public until 31 August three years after its publication deadline. `scripts/archive-removal.mjs` turns a reviewed list of beneficiaries (such as individual practitioners) into removal SQL and the exclusion list that `scripts/build-final-historical-declarations.py` requires; those files go in `d1/historical-declarations/private/`, which Git ignores. See `d1/historical-declarations/README.md`.
- **`security-headers.js`** and **`public/_headers`**: The security headers. Cloudflare applies `public/_headers` only to the files it serves directly; `server.js` adds the same headers (from `security-headers.js`) to the responses it builds. `tests/securityHeaders.test.mjs` keeps the two lists in step. The app has no CMS or sign-in: Decap CMS and its GitHub OAuth were removed in October 2026, so content is edited in the JSON files.
- **`scripts/validate-data.mjs`**: Dependency-free structural validation for Code, Transparency, decision-tree and quiz data, the event support checker's rules, and the search phrasebook's structure. It also checks cross-references: a reference or decision-tree citation that matches nothing is an error, and one whose section is missing (linked to its chapter instead) is printed as a note. Run with `npm run validate:data` after content edits.
- **`scripts/search-tools.mjs`**: Search maintainer tools. `npm run search:explain -- "<query>" [--scope transparency]` shows how a query is understood and ranked; `npm run search:report` prints everyday example queries and the self-retrieval check. Both are informational. `scripts/lib/search-content.mjs` builds the same indexes in Node for these tools and the tests.
- **`tests/`**: Focused Node tests for stable project logic. Run with `npm test`. The plain-language operating guide is `PROJECT_CHECKS.md`.
- **`ROUTING.md`**: Canonical URL formats, legacy compatibility guarantees, identifier stability rules, hosting requirements, and manual release checks.
- **`ranked_changed.md`**: The maintenance backlog — verified, risk-tiered technical debt and improvement candidates, including findings from periodic repo audits. Before starting a change, check whether it touches a file with an open item here; if so, evaluate whether folding in that fix is in scope for the current update, consistent with that file's own guidance to extract/fix things only when a file is already being changed, not as unrelated batch cleanup. Update or remove an item's entry once it's resolved, and add newly discovered issues here rather than leaving them undocumented.

## Standards

### 1. Architecture & State
- **Functional Components**: Use React functional components and hooks exclusively.
- **Custom Routing**: Keep routing centralized in `routeUtils.js`, `config/routes.js`, and `useAppRouting.js`. Canonical routes use `/code/:chapterId`, `/transparency/:documentId/:unitId`, `/trees/:treeId`, `/quiz`, and `/tppt`; Code and Transparency section links retain generated anchors. Preserve legacy root-hash links and add route tests whenever routing changes.
- **State Management**: Prefer passing state/props from `App.jsx` for global concerns (active section, reader settings) and using local state for component-specific logic.

### 2. Styling & Branding
- **Tailwind CSS**: Use utility classes for all component styling. Avoid creating new `.css` files.
- **Brand Colors**: 
  - Purple (`#7654A1`): Primary actions, active states, bookmarks.
  - Teal (`#0099A7`): Code and Transparency reader accent, links, citations. For teal *text*, use `#007A86`: `#0099A7` is below the 4.5:1 AA contrast minimum on white, so keep it for fills, borders and icons.
  - Amber: Decision Tree warnings and callouts.
- **Print Optimization**: All new UI elements must be evaluated for their appearance in Print Mode (managed via `@media print` in `index.css`). Use the `.no-print` class to hide interactive elements.
- **Typography**: Inter is bundled from `@fontsource-variable/inter` (imported in `main.jsx`); do not add third-party font links. Reader text keeps its line length through `--reader-measure` (reader font size × the Line length setting's multiple, or `none` for Full; see `config/readerSettings.js`) rather than fixed widths.
- **Layout Widths**: Below 1024px (`lg`) the sidebar is a slide-in menu and header toolbar labels are hidden. From 1024px the sidebar is docked to the left edge of the window, and from 1280px (`xl`) the Code and Transparency readers dock the side panel to the right edge. Both panes are resized by dragging their inner edge; their widths come from `--sidebar-size` and `--side-pane-size` in `index.css`, which keep each pane within its limits and the text at least 30rem wide, so do not give them fixed widths. From 2400px (`3xl`, defined in `index.css`) the root font size is 112.5%; use `3xl:` rather than `min-[2400px]:`, because arbitrary breakpoints are sorted before the named ones and lose to them. Test new screens at phone, 1366px, 1920px and 2560px widths, and with the panes dragged to their narrowest and widest.

### 3. Components & Icons
- **Icon Registry**: Always use `<AppIcon name="..." />` from `src/components/AppIcons.jsx`. Never import `lucide-react` directly into feature components.
- **Reusability**: Encapsulate complex UI logic (like the glossary tooltip) into standalone components that can be driven by props.

### 4. Data Handling
- **JSON First**: All content updates must happen in the relevant JSON source, including chapter files under `src/data/code/`.
- **DOCX Round Trip**: Treat `code-september-2024.docx` as the team-facing amendment format and the PDF as its published baseline. Do not regenerate the DOCX from JSON. When a revised DOCX is returned, identify the deliberate Word changes against this PDF-derived structure and apply the approved changes narrowly to the relevant JSON files.
- **Canonical Text Preservation**: Never regenerate, summarize, or bulk reserialize normative Code or Transparency publication text. Keep content edits narrowly scoped and verify them against the authoritative source.
- **Migration Evidence**: `code-manifest.json` proves the 2026 content-neutral split. Do not regenerate it after ordinary approved content edits.
- **Sanitization**: When rendering HTML from JSON (e.g., `legalText`), always wrap it in a sanitizer if not already handled by a central component.
- **Computed IDs**: Section IDs are generated dynamically via `utils/textUtils.js`. Maintain this consistency to avoid breaking bookmarks and deep links.
- **Search Phrasebook**: Only general-English equivalences go in `src/data/search/phrasebook.json` — never chapter, section, or Q&A references. Never add search rules or tests tied to specific Code content; search must keep working unchanged when the Code changes.
- **Validation**: Run `npm run validate:data` after changing JSON under `src/data/`. After Disclosure Guidelines changes, also run `npm run verify:disclosure-guidelines`. Do not weaken a rule or alter content merely to silence a validation error; first determine whether the content or the rule is wrong.

### 5. Naming Conventions
- **Files**: `PascalCase.jsx` for components, `camelCase.js` for hooks/utilities/data.
- **Variables**: Use `camelCase` for local variables and `UPPER_SNAKE_CASE` for exported constants or data imports.

## Example Snippets
### Full Chapter Example (from a file in `src/data/code/`)
```json
{
  "id": "scope",
  "part": "intro",
  "title": "Scope",
  "icon": "Globe",
  "summary": "Outlines the applicability and geographic reach of the MedTech Europe Code.",
  "sections": [
    {
      "title": "1. Applicability of the Code",
      "legalText": "<strong>1.1.</strong> This Code only applies ...",
      "qas": [
        {
          "q": "Q&A 1: Is the Code applicable to activities of an affiliate ...?",
          "a": "With regards to activities of an affiliate ..."
        },
        {
          "q": "Q&A 2: How does the Code apply to members with company platforms ...?",
          "a": "The Code applies to all Member Companies’ interactions ..."
        }
      ]
    }
    // … other sections omitted for brevity
  ]
}
```

### Adding a New Section in `src/config/sections.js`
```javascript
// src/config/sections.js
export const SECTIONS = [
  // existing entries …
  {
    id: "materials",
    title: "Materials",
    subtitle: "Supplementary compliance resources",
    description: "Download templates, checklists, and reference guides.",
    icon: "Package",
    color: "#8b5cf6",
    available: true,
  },
];
```

Registering Home Hub metadata does not create a route by itself. Follow the routing steps in `README.md` and `ROUTING.md` when making the section navigable.
