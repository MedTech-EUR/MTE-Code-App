# Project Checks

This guide explains how to check The Code App after changing content or code. The checks do not publish the app. The production build step regenerates the ignored `dist/` output.

## Before You Start

Open a terminal in the app's root folder:

```text
C:\Users\dicmi\Documents\GitHub\MTE-Code-App
```

In Windows File Explorer, open that folder, click the address bar, type `powershell`, and press Enter. To confirm the location, run:

```powershell
Get-Location
```

The displayed path should end with `MTE-Code-App`.

If this is the first time the app is being used on the computer, run `npm install` once before running the checks.

## Check Content Data

Run this after changing the Code, Transparency publications, decision trees, or quiz questions:

```powershell
npm run validate:data
```

A successful result looks like this:

```text
Data validation passed.
23 chapters, 75 sections, 43 Q&As
9 decision trees, 133 nodes
60 quiz questions
199 phrasebook groups
1 Transparency document, 7 reader units, 19 sections, 11 Q&As
66 cross-references linked
Event support checker: 15 activities, 32 conditions
2 notes (not errors):
- Code chapter "ch1" sections[4]: "section 3 of Chapter 2": Chapter 2 has no section 3; linked to the chapter.
- Code chapter "ch1" sections[5]: "section 3 of Chapter 2": Chapter 2 has no section 3; linked to the chapter.
```

The totals may increase when content is intentionally added. The important line is `Data validation passed.`

Notes do not fail the check. A note means the text refers to a section that does not exist, so the app links the reference to its chapter instead. Compare the wording with the published source before changing any Code text.

The Code is stored as one chapter per file in `src/data/code/`, while standalone
Transparency publications live under `src/data/transparency/`. This command
checks that every file listed in `src/data/codeOrder.js` exists, that its chapter
ID matches its filename, and that publication, section, resource, tree, and quiz
references remain valid. It also checks that the search phrasebook (`src/data/search/phrasebook.json`) is well formed, that source phrases are unique after punctuation is normalized, and that no phrase consists only of stopwords. These phrasebook checks do not depend on the current Code wording.

It also checks cross-references. References such as "Chapter 4" or "Section 3 of Chapter 4" become links when the text is displayed, and every decision-tree result's Reference opens the provision it cites. A reference or citation that matches no chapter, annex, section or Q&A is an error.

If validation fails, the output identifies the file and item involved. For example:

```text
Data validation failed with 1 error:
- treeData.json trees[0] nodes[0] options[0]: target node "missing-node" does not exist in tree "dt-example".
```

Do not make unrelated changes just to remove the message. Keep the output and ask the project developer or Codex to inspect the reported item.

## Run Focused Tests

Run this after changing app logic, especially URL navigation, the TPPT parser, eligibility rules, section IDs, or the validation script:

```powershell
npm test
```

A successful result ends with output similar to:

```text
tests 60
pass 60
fail 0
```

The number of tests may grow. The important value is `fail 0`.

The event support checker's tests (`tests/eventSupport.test.mjs`) cover every cell of Annex I and Annex VI and walk every path through the checker's questions, checking that each answer is consistent and fully worded. The CVS tests (`tests/cvs.test.mjs`) use saved examples of the CVS pages and never contact CVS. If a checker test fails after a wording edit in `src/data/eventSupportRules.json`, check the message named in the output. See [`docs/event-support.md`](docs/event-support.md) for the manual checks before a release.

The URL tests use the current project data. They confirm that every current Code chapter/section, Transparency document/unit/section, and decision tree has a working unique route, that representative section-ID generation rules remain stable, and that supported legacy link formats still resolve. If one fails after a content edit, do not rename IDs simply to make the test pass; keep the output and have the reported route reviewed.

Automated checks cannot decide whether changing a public identifier was intentional. Read [`ROUTING.md`](ROUTING.md) before changing Code chapter IDs, Transparency document or unit IDs, tree IDs, section titles, navigation behavior, or hosting rules.

## Check Search

Search needs no updates when the Code changes. Everything search knows about the Code is recomputed from the current content every time the app loads. The only hand-written search file is `src/data/search/phrasebook.json`; see `src/data/search/README.md`.

To see how a search is understood and ranked, run:

```powershell
npm run search:explain -- "wife travel"
```

Add `--scope transparency` to search the Disclosure Guidelines instead. The output shows which extra words were searched and why (with their weight), any spelling corrections, and how each result was scored.

To see the top results for a list of everyday example searches, plus a check that each provision, Q&A and definition can be found by its own wording, run:

```powershell
npm run search:report
```

This is informational and does not fail because a search has no results. It is useful after a Code update, to see that everyday searches still find sensible results.

To run your own queries, create a JSON file such as `search-queries.json` with this structure:

```json
[
  { "scope": "code", "query": "doctor travel" },
  { "scope": "transparency", "query": "currency" }
]
```

Then run:

```powershell
npm run search:report -- --queries .\search-queries.json --json
```

`--queries` replaces the built-in example list. `--json` prints concepts and weights, the top results, unmatched terms, phrasebook stem collisions for each scope, and timings. You can use `--json` alone with the built-in queries, or omit it for the usual text report. The query file must contain an array of objects with only `scope` (`code` or `transparency`) and a non-empty `query`; malformed input produces an error.

The self-check in `npm test` confirms that at least 95% of provisions, Q&As and definitions come back in the top 3 when searched by their own heading, question or term. If it fails after a content edit, keep the output and ask for technical help. Do not rename content just to make it pass.

To update the search phrasebook, edit `src/data/search/phrasebook.json`, following the rules in `src/data/search/README.md` (general English only, never chapter, section or Q&A references), and run `npm run validate:data`. Then try the changed words with `npm run search:explain`, in both the Code and the Disclosure Guidelines, as described in the phrasebook guide.

## Revised Word-to-App Code Check

To compare the source-backed Code text in the app with the revised Word working
copy, run:

```powershell
npm run verify:code-docx
```

The command prints numbered candidates with an `app:` line and a `word:` line.
For a shareable Markdown checklist, run:

```powershell
npm run verify:code-docx -- --report code-docx-review.md
```

The command exits with status 1 while candidates remain; that means the audit
found items to review, not that the script crashed. For each number, decide
**keep app**, **keep Word**, or **structural difference**. The JSON path printed
beside the number identifies the exact chapter field, so a decision can be sent
as briefly as `#1 keep Word; #6 keep app`.

The check reads all 22 publication JSON files, deliberately excludes app-only
summaries and Version History, and reports every text fragment that is not an
exact lexical match in the pinned DOCX. HTML layout, image elements, bullet
glyphs, and the app's `Q&A n:` versus Word's separate `Qn`/`An` labels are not
normative wording and are normalized. Do not silence a result by changing text:
first reconcile it against the Word file and record any approved exception.

## Historical Split Proof

The 2026 migration from one large Code JSON file to chapter files has a separate
preservation proof:

```powershell
npm run verify:code-migration
```

This reconstructs the deleted monolith from the chapter files and checks its
original SHA-256 hash, every raw chapter slice, every string value, chapter
order, counts, and generated section routes. It is evidence for that migration,
not the normal check after editing content.

An approved content correction will make this historical command fail because
the content is no longer identical to the 2026 baseline. That is expected. Do
not regenerate `src/data/code-manifest.json` just to make it pass. Continue to
use `npm run validate:data` for everyday edits.

## Disclosure Guidelines Source Proof

Run this after changing the Disclosure Guidelines JSON, its supplied PDF, or the
Annex I CSV template:

```powershell
npm run verify:disclosure-guidelines
```

This check pins the supplied PDF, CSV, document metadata, and every raw reader
unit. It compares the ordered visible body against PDF pages 2–15, preserves
lexical word boundaries and punctuation, and separately checks the Annex I link
boundary plus Annex II/III structure. A failure means the app can no longer prove
that its standalone publication matches the approved source. Do not rewrite,
summarize, or silently correct the source text to clear the error. If a formally
revised publication is approved, independently reconcile its PDF/CSV and reader
data, then update `source-manifest.json` and the `EXPECTED` baselines in
`scripts/verify-disclosure-guidelines.mjs` together as one reviewed change.
Never change expected values merely to make a failure pass.

If a test fails, keep the complete output from the first failing test through the final summary. Do not change the expected result unless the intended business rule has been confirmed.

## Run Every Project Check

Before a release or deployment, run:

```powershell
npm run check
```

This runs data validation, the Disclosure Guidelines source proof, focused
tests, TypeScript checks, the production build, and a final proof that the
emitted Disclosure PDF/CSV are byte-exact and listed in the service-worker
precache. It may take longer than the individual commands. A successful run
finishes with `Production Disclosure assets are byte-exact and precached.`

For an offline release check, preview the production build and load the
Disclosure Guidelines overview, original PDF, and Annex I download once. Then
enable the browser's Offline mode, refresh a nested Disclosure route, and confirm
that the reader, PDF, and CSV still load. When adding a new resource format,
also confirm its emitted asset appears in `dist/sw.js`.

## When To Run The Checks

- After editing files in `src/data`, run `npm run validate:data`.
- After editing `src/data/search/phrasebook.json`, run `npm run validate:data`.
- After editing Disclosure Guidelines data or sources, also run `npm run verify:disclosure-guidelines`.
- After changing TPPT, the event support checker or other tested logic, run `npm test`. The checker's wording is in `src/data/eventSupportRules.json`, so `npm run validate:data` also checks it, including every “Chapter N, Section N”, “Annex N” and “Q&A N” it cites.
- Before a release or deployment, run `npm run check`.
- Documentation-only edits normally do not require every check, but running them is safe.

## Common Problems

### `npm` is not recognized

Node.js is not installed or is not available to the terminal. Ask the person responsible for the development environment to install the project's supported Node.js version.

### `Missing script`

The terminal is probably in the wrong folder or the local project is out of date. Run `Get-Location` and confirm that the path ends with `MTE-Code-App`.

### A package cannot be found

Run `npm install`, then repeat the original command. If the problem remains, keep the error output and ask for technical help.

### A check reports an error you do not understand

Do not delete files or rewrite content based only on the error. Share:

1. The command that was run.
2. The complete error output.
3. The file that was being edited.
4. A short description of the intended change.
