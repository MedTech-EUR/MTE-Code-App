# Technical Changelog

All notable technical changes, architectural refactors, and feature additions to The Code App codebase are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versions are internal application-release labels; they are independent of the private npm package version and are not currently represented by Git tags.

---

## [Unreleased]

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
- Historical Declarations: an “About this data” notice says what the archive is, why MedTech Europe publishes it, how long each year stays public, how to object or ask for a correction or removal (ethics@medtecheurope.org, or the Belgian Data Protection Authority), and that Member Companies can ask to correct or remove their own declarations the same way. Each record has a “Report a problem with this record” link, an e-mail naming the record. `scripts/archive-removal.mjs` turns a reviewed list of beneficiaries, such as individual practitioners, into removal SQL for D1 and the exclusion list for rebuilds; its files go in `d1/historical-declarations/private/`, which Git ignores. `tests/historicalDeclarationsNotice.test.mjs` and `tests/archiveRemoval.test.mjs` cover them.
- Added a Privacy Notice (`src/data/code/privacy.json`, a website page beside Version History, route `/code/privacy`): who is responsible (data.protection@medtecheurope.org), what Cloudflare processes on each visit (including its `cf_clearance` security cookie), the Historical Declarations, CVS checks, suggestions, what the app keeps in the browser, and the reader's rights. It is drafted for counsel's review. Home has a footer linking to it (`HubFooter`, `FOOTER_PAGE_IDS` in `HubPage.jsx`), and `tests/websitePages.test.mjs` checks both.
- Added a Legal Notice (`src/data/code/legal-notice.json`, route `/code/legal-notice`) with the identification Belgian law requires on a legal person's website (CSA art. 2:20, CEL art. XII.6): MedTech Europe AISBL, its registered office, enterprise number 0508.570.208 with RPM Bruxelles, VAT number, e-mail and website, checked against the Crossroads Bank for Enterprises. The footer on Home links to it beside the Privacy Notice.
- The app now says which text of the Code is official: the PDF MedTech Europe publishes, which the app reproduces with a few editorial corrections (the app's source PDF is byte-identical to the September 2024 PDF on medtecheurope.org). The Code landing page (`OFFICIAL_CODE_URL` in `LandingPage.jsx`) and the Legal Notice say so; the Legal Notice also says the app's tools are guidance, with a short liability clause drafted for counsel's review. Every decision-tree answer ends with `TREE_ANSWER_NOTE` (`TreeResultCard.jsx`): a guide to the Code, not legal advice or a CVS decision. `tests/officialTextNotes.test.mjs` covers both.

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
- The Historical Declarations API shows each reporting year until 31 August three years after its publication deadline (`oldestPublicYear()`; 2023 until 31 August 2027), in the year filter, the search and record links. `scripts/build-final-historical-declarations.py` now requires `--exclude-beneficiaries`, so a rebuild cannot republish removed beneficiaries.

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
- The Historical Declarations record dialog showed a stray comma after the beneficiary's city: it read a postal code the API never returns.

### Security
Found by the legal and regulatory compliance audit of 2026-10-03; the open items are listed in `ranked_changed.md`.
- The CMS sign-in popup sent the GitHub token to whichever window answered its handshake, so any website that opened the popup for an editor already signed in to GitHub received a token with access to all of the editor's repositories. A local browser check reproduced this with `oauth-proxy.js`. The CMS and both sign-in services were then removed (see Removed). The `mte-oauth-proxy` Worker already deployed keeps running the old code until it is deleted in Cloudflare; deleting the GitHub OAuth app revokes every token it issued.
- Added security headers: HSTS, `X-Content-Type-Options: nosniff`, `Referrer-Policy` and `Permissions-Policy` on every response. Static files get them from `public/_headers`, Worker responses from `security-headers.js`; `tests/securityHeaders.test.mjs` keeps the two lists in step, and `tests/cvs.test.mjs` now loads `security-headers.js` into the Workers runtime.

### Removed
- Decap CMS (`/admin/`, `public/admin/`) and its GitHub sign-in: `oauth-proxy.js`, the `/api/auth` endpoints in `server.js`, the `cms` and `cms:proxy` scripts with the `decap-server` and `concurrently` packages, `docs/cms-guide.md` and `tests/oauthCallback.test.mjs`. Content is edited in the JSON files directly. `tests/securityHeaders.test.mjs` checks that `/api/auth` and `/admin` now get the app shell.

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
