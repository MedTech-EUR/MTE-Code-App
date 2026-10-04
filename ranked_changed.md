# Current Maintenance Backlog

Last reviewed: 2026-07-22

This file records the current maintenance position of The Code App. It replaces the earlier speculative backlog, which mixed verified issues with optional product ideas and led to incorrect assumptions about working features.

## Current Baseline

- React 19 and Vite 6 application with four active sections: The Code, Decision Trees, Knowledge Quiz, and TPPT Checker.
- Content source of truth: `src/data/code/*.json`, `src/data/treeData.json`, and `src/data/quizData.json`.
- Current content: 23 chapters, 67 sections, 43 Q&As, 8 decision trees with 116 nodes, and 60 quiz questions.
- Recent History intentionally stores the last five visited Code chapters in browser `localStorage`.
- Bookmarks currently apply to Code sections and are stored in browser `localStorage`.
- Readable browser-history routes cover chapters and decision trees, while generated section IDs remain as exact anchors for section links. Existing root-hash links remain supported, and there is no known duplicate-ID or route-collision problem.

## Implemented Maintenance Guardrails

- `npm run validate:data` checks structural integrity of Code, tree, and quiz data, and the structure of the search phrasebook, without changing files.
- `npm test` runs focused tests for route compatibility, TPPT rules, parser behavior, stable section IDs, validator behavior, and search (synthetic engine fixtures plus a content-independent self-retrieval check).
- `npm run search:explain` and `npm run search:report` show how search interprets and ranks queries; relevance scores are informational, while malformed command arguments or query files return errors.
- `npm run check` runs validation, tests, TypeScript checks, and a production build.
- `PROJECT_CHECKS.md` explains these commands and their output for non-technical maintainers.

## Active Priorities

### 1. Keep Documentation And Public Version History Current

Update documentation only after checking claims against source code, project configuration, package metadata, Git history, and actual behavior where necessary. Do not expose administration or infrastructure details in the public in-app Version History.

### 2. Maintain Content Accuracy

Continue source-by-source comparison when the underlying MedTech Europe Code changes. The audit in `src/data/verified_issue_list.md` documents the latest completed content comparison. Structural validation complements editorial review but does not replace it.

### 3. Add Tests Only Where They Protect Stable Business Rules

Extend tests when changing TPPT thresholds, parser behavior, data relationships, or section-ID generation. Avoid broad snapshots and test infrastructure that costs more to maintain than the behavior it protects.

### 4. Make Local Accessibility Improvements

Prefer explicit labels, semantic controls, and keyboard access in existing workflows. Keep changes local and verify that mouse, keyboard, mobile, and print behavior remain intact.

## Changes Requiring Evidence Before Implementation

- Search analytics: the app emits `mte:search` browser events, but nothing collects them. Adding a collector needs a concrete reporting need and a privacy notice first.
- New profile filters, checklists or exports require a concrete user need and maintained content model. (Cross-reference links were added on 2026-09-25 at the product owner's request, with a maintained model: references are detected from the loaded titles in `src/utils/crossReferences.js` and checked by `npm run validate:data`.)
- Component splitting should happen only when a file is being changed and extraction clearly reduces risk or duplication.

## Deliberately Deferred Structural Changes

The current project scale does not justify adding a routing library, global state management, accounts or cloud synchronization, a full TypeScript migration, a backend content API, or an AI assistant. Reconsider only if a future requirement offers a major gain that cannot be achieved within the existing architecture.

## Audit Findings — 2026-08-08

Found by an automated repo audit (read-only pass: `npm install`, `npm run lint`, `npm test`, `npm run validate:data`, `npm run build`, `npm run verify:disclosure-guidelines`, `npm run verify:production-disclosure-assets`, `npm audit`, plus manual inspection). All checks above passed cleanly at the time of the audit; nothing here indicates a currently-broken build. Items are grouped by how safe they are to act on, not by importance. None of these were implemented — evaluate and fold in the ones that make sense the next time related files are touched, per the "component splitting... only when a file is being changed" principle above.

### Low engineering risk (small, localized, no logic change) — still verify before shipping to production
- Delete `temp_ch10.json`, `temp_ch4.json`, `temp_ch8.json`, `temp_scope.json` (repo root). Leftover working files from a past content-migration session; confirmed unreferenced by any `.js`/`.mjs`/`.py` file.
- Delete `public/manifest.json`. Dead legacy PWA manifest, superseded by the `vite-plugin-pwa`-generated `manifest.webmanifest` actually linked from `index.html`. Its icon paths (`/icons/icon-192x192.svg` etc.) don't even exist, and its theme color doesn't match current branding. Confirmed unreferenced, including from `public/admin/index.html`.
- Delete `public/service-worker.js`. Pre-`vite-plugin-pwa` leftover; nothing in current app code registers it (the app registers the Workbox worker via `virtual:pwa-register` in `src/main.jsx`), yet Vite still copies it into every build as `/service-worker.js`. Confirmed no in-app references.
- Remove the `public/icons/` subfolder's three PNGs (byte-identical duplicates of `public/icon-192.png`, `public/icon-512.png`, `public/maskable-icon-512x512.png` — verified via checksum). The root-level copies are the ones wired into `vite.config.ts` and `index.html`; the subfolder copies and `public/icons.svg` (an unrelated, unreferenced social-icon sprite) appear to be dead weight.
- Remove the `"TPPT checker"` entry from `tsconfig.json`'s `exclude` array — that folder no longer exists in the repo.
- Rename `package.json`'s `"name"` from the Vite scaffold default `"react-example"` to something reflecting the project. Not coupled to `wrangler.toml`'s own `name` field.

### Needs real evaluation before touching (not drop-in fixes)
- `pdfjs-dist` has a published high-severity advisory (arbitrary JS execution on a malicious PDF). Relevant here because the TPPT Checker parses user-uploaded PDFs client-side with this library. `npm audit fix --force` upgrades to a breaking major version (6.2.108) — needs a real test pass against `src/utils/tpptExtraction.js` and the TPPT upload flow before shipping. Checked on 2026-10-03: the advisory (GHSA-hq66-cqwq-w95j) needs PDF.js scripting (`enableScripting`, part of its viewer), and the app only calls `getDocument()` and `getTextContent()`, so it is not exposed as used. The `isEvalSupported: false` passed in `EventSupportAgenda.jsx` no longer exists in pdfjs-dist 5 and does nothing.
- Resolved on 2026-10-03: `oauth-proxy.js` reflected any HTTPS `Origin` in CORS, and its postMessage token delivery was in fact exploitable: the popup sent the GitHub token to whichever window answered its handshake. The CMS and both sign-in services have been removed; see the Security and Removed sections of `CHANGELOG.md`.
- `tsconfig.json` has no `strict`/`noImplicitAny`. Turning on strict mode will likely surface new type errors in `TPPTContent.tsx` that need fixing — plan it as its own pass, not a quick toggle.
- Lower-priority `npm audit` findings (dompurify, vite, postcss, esbuild, nanoid, picomatch) are mostly dev-tooling-only exposure, not shipped to end users; revisit opportunistically via `npm audit fix` (non-breaking) rather than urgently.

## Verification Commands

Run from the project root:

```powershell
npm run validate:data
npm test
npm run lint
npm run build
```

See `PROJECT_CHECKS.md` for detailed instructions and troubleshooting.

## Found While Expanding the Phrasebook — 2026-09-25

- Glossary association inference remains lexical: punctuation can split an exclusion into a new clause (for example the Virtual Event definition's hybrid exclusion), and ordinary words such as procurement can link to a broad defined term. This can add noisy results even after a misleading phrasebook rule is removed. Verify any future negation/scoping fix with synthetic fixtures; do not add Code-specific exceptions or alter scoring constants to hide it.
- Greedy multiword recognition and concept-union document frequency can displace useful literal results: a recognised phrasebook phrase is searched as one unit, not word by word. Since 2026-09-25 a multiword phrase is only recognised in a scope where the phrase or one of its targets occurs, so a target missing from one publication no longer empties that publication's results. A typed word that is in neither the text nor the phrasebook can still be spelling-corrected to an unrelated indexed word (for example "bonus" became "bones" while it was missing from the phrasebook).
- The Disclosure CSV template's field names are not indexed: Annex I reader text contains only its download link. Phrasebook expansion cannot make those missing fields searchable. Any later indexing change should retain the CSV as the authoritative source and keep download-only fields distinct from reader passages.

## Found While Rebalancing the Layout — 2026-09-25

- `index.html` does not link `public/favicon.svg`, so browsers request `/favicon.ico`, get a 404 and show a default tab icon. Fix: add `<link rel="icon" href="/favicon.svg" type="image/svg+xml">` once the SVG is confirmed as the intended icon.
- Chapter 1 cites "section 3 of Chapter 2" twice (Guests and Reasonable Hospitality), but Chapter 2 has two numbered sections. The links fall back to Chapter 2, and `npm run validate:data` prints them as notes. Check the wording against the published PDF before changing any Code text.
- The Disclosure Guidelines' Chapter 3 numbers its sections 1, 2, 3, 4, 6, 5, 6 and cites "Section 3.3 Time of Publication", which matches no section title (the time-of-disclosure section is numbered 2). The linker leaves it unlinked. The data is pinned to the source by `npm run verify:disclosure-guidelines`, so confirm against the PDF before treating it as an error.
- Layout widths were measured with a throwaway Playwright script (15 screens at 10 window sizes from 390px to 3440px: characters per line, empty space on each side, cut-off sidebar labels, clipped toolbar buttons). Repeat that kind of check when changing layout widths or breakpoints, including with both panes dragged to their narrowest and widest; the reading area must keep at least 30rem and no size may scroll sideways.

## Found While Making the Panes Resizable — 2026-09-26

- The Knowledge Quiz and TPPT Checker render their scrolling area as a `<div>`, so those pages have no `main` landmark (the other sections use `<main>`). Screen-reader users cannot jump straight to their content. Fix: make the root element of `QuizContent.jsx` and `TPPTContent.tsx` a `<main>`, and check that no other `main` is nested inside.

## Found While Porting the Event Support Checker — 2026-09-26

- The checker's live CVS lookup reads the HTML of the public CVS site (run by IQVIA for Ethical MedTech); it is not a published API. `cvs-parser.js` fails visibly when the pages change. Supplier permission and production traffic limits should be settled before relying on the lookup in production; without it the checker still answers, and marks a needed CVS decision as unconfirmed.
- `docs/event-support.md` lists six interpretations the checker applies (for example Events in Mecomed countries). A review of the Word copy in September 2026 agreed with them, and the two it disagreed with were changed on 2026-09-27; they still need a content owner's confirmation. Childcare, the Regional Capitals approach (for Events from 1 November 2026) and purely policy-focused conferences are left out until published guidance exists.
- The live CVS status list has “Not assessed - Out Of Scope” but no “Not assessed - National event”. The checker keeps both labels as the requested exemptions from its national-audience warning; drop the second only if the product owner agrees.
- The `dt-annex1-cvs-scope` decision tree (the Conference Vetting System check, which has taken the checker's place on the Home Hub and in the sidebar) and the checker cover the same Annex I cells. Keep them consistent when either changes.
- The Conference Vetting System check treats an Event in a Mecomed country like any Event in the Area: a national one gets "CVS approval not required", and a CVS record gets the national-Event warning. Since 2026-09-27 the checker follows Mecomed's own CVS scope, which covers national Events (https://www.mecomed.com/ethical-practices/cvs). Fix: give the tree's first question a Mecomed option, or at least say in its help that national Events in Mecomed countries are vetted too.
- A CVS search downloads two pages of about 2.3 MB each (most of it the list of every EMT ID in the search form) and takes about 100–170 ms of Worker CPU time in local tests. Searches succeed on the branch preview, so the account's limit allows it, but the Workers Free plan allows 10 ms per request. Reading the first page only as far as its search token (in the first 4 KB) would make each search about 1–1.5 seconds faster and save about a third of the CPU time.
- Resolved on 2026-09-26: the TPPT calculator accepted negative or blank durations, and the Annex I tree answered direct sponsorship as “CVS decision required”.

## Found While Making References Expandable — 2026-09-26

- References and defined terms in the text shown in the side panel are plain text, so a reader cannot follow a reference from inside an expanded chapter. Linking them needs a way back first: the panel shows one item at a time, and opening another would lose the rows the reader had expanded.

## Found While Combining the Checker and Expandable References — 2026-09-29

- Existing installed-app caches on local preview ports 8787 and 8788 served obsolete app shells referencing removed bundles, leaving the page blank. The server returned the current build, and an unused preview origin loaded it correctly. Include an upgrade check from older installed versions in future PWA work; do not clear readers' stored bookmarks or settings to work around it.

## Legal Compliance Audit — 2026-10-03

Audit against Belgian and EU law, with MedTech Europe AISBL as the operator. The code-level fixes are in the Security section of `CHANGELOG.md`. These items need MedTech Europe decisions or Cloudflare/GitHub settings, not code alone:

- **Historical Declarations hold personal data.** Some beneficiaries are individual practitioners (names such as “Dr. med.” or “Praxis Dr.” followed by a person's name), and the Code's HCO definition includes bodies through which HCPs provide services (GDPR art. 4(1); CJEU C-92/09 and C-93/09 *Schecke*). Done on 2026-10-03: each year stays public for three years after its publication deadline, the archive page has an “About this data” notice, and each record a “Report a problem with this record” link (ethics@medtecheurope.org). Decided: records of individual practitioners are removed. Open: MedTech Europe reviews the candidate list (285 beneficiaries whose names carry a doctor title or a practice word, built from the live search on 2026-10-03 and kept out of Git), then runs the removal SQL from `scripts/archive-removal.mjs` against D1 (see `d1/historical-declarations/README.md`). Individuals whose names carry no such word are not on that list; a full pass over `seed.sql` would find more. Still needed: a documented legitimate-interests assessment (art. 6(1)(f)) and the full privacy notice (see below).
- **2025 records were drafts.** Resolved on 2026-10-03: MedTech Europe confirmed that on Transparent MedTech “draft” meant final figures awaiting the platform's publication date, so 2025 stays public as it is. The archive notice now tells Member Companies they can ask to correct or remove their declarations (report link or ethics@medtecheurope.org), as the Guidelines allow. Still to check: the platform has shut down and the dump is from 19 August 2026, before the 31 August deadline, so a company that filed its 2025 declarations after that date is missing from the archive and may need to publish them elsewhere.
- **Privacy notice and legal notice.** Privacy: done on 2026-10-03 as a short Privacy Notice page (`/code/privacy`) that points to MedTech Europe's general notice for everything else; its text is a draft for counsel's review before release. Legal notice: done on 2026-10-03 (`/code/legal-notice`, CSA art. 2:20 and CEL art. XII.6). Official text and disclaimers: done on 2026-10-03; the Code landing page and the Legal Notice name the published PDF as the official text, and every decision-tree answer carries a guidance note. The Legal Notice's liability clause awaits counsel's review.
- **Browser storage.** Resolved on 2026-10-04: the Privacy Notice lists what the app keeps in the browser and how to remove it; Recently Viewed has a Clear button and the TPPT Checker a Start over button that removes its saved agenda (Belgian Data Protection Act art. 10/2).
- **Cloudflare.** Resolved on 2026-10-04: Cloudflare's Data Processing Addendum (v6.4) forms part of every Cloudflare customer agreement, and transfers to the US rely on the EU–US Data Privacy Framework and standard contractual clauses. MedTech Europe decided not to move the D1 database into the EU jurisdiction (once individual practitioners are removed it holds organisations' data). MedTech Europe's DPO keeps the records of processing for the app (GDPR art. 30).
- **Retire the old CMS sign-in.** The CMS and its sign-in were removed from the code on 2026-10-03, but the `mte-oauth-proxy` Worker already deployed keeps running the leaky code. Delete it (`npx wrangler delete --name mte-oauth-proxy`), delete the GitHub OAuth app it used (this revokes every token it issued), and delete any `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` secrets on the `mtecodeapp` Worker.
- **Repository.** Decided on 2026-10-04: MedTech Europe creates its own GitHub organisation, the repository is transferred there and made private; branch protection is not wanted. Nothing in the code names the repository's location. After the transfer, reconnect Cloudflare's Git deployment and install the Claude GitHub app on the new organisation if these sessions should keep working. Until then, the public `d1/historical-declarations/seed.sample.sql` keeps real addresses and descriptions, including 2022 records that the live archive leaves out (finding 11).
- **Licence notices.** Resolved on 2026-10-04: each build writes `third-party-licenses.txt`, linked from the Legal Notice. `dingbat-to-unicode` (BSD-2-Clause, via mammoth) ships no licence file, so only its licence name is given; pdfmake's prebuilt bundle carries the notices of the libraries inside it.
- **Accessibility.** No statutory duty was found: the European Accessibility Act covers specific consumer services, and the Web Accessibility Directive covers public bodies. Keep WCAG 2.1 AA as practice (see Active Priorities).
