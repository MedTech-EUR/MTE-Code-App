# Data

This directory serves as the source of truth for application content.

- `code/` contains one JSON file per MedTech Code chapter.
- `codeOrder.js` defines the chapter order.
- `codeData.js` assembles the chapter files behind the existing `FULL_CODE_DATA` export, and splits them into the Code's own chapters (`CODE_CHAPTERS`) and website pages such as Version History (`WEBSITE_CHAPTERS`).
- `code-manifest.json` is the immutable evidence for the 2026 content-neutral split. Do not regenerate it after ordinary content edits.
- `code-september-2024 (1).pdf` is the supplied authoritative reference PDF.
- `transparency/` contains standalone Transparency publications. The Disclosure
  Guidelines are split into ordered reader units while preserving the supplied
  PDF text verbatim.
- `mte-code_disclosure_guidelines.pdf` is the authoritative October 2025
  Disclosure Guidelines source; its source hash and unit evidence are pinned by
  `transparency/disclosure-guidelines/source-manifest.json`.
- `declaration-csv-template.csv` is the local Annex I download and the sole
  source for its non-normative in-app preview.
- `treeData.json` and `quizData.json` contain decision-tree and quiz content. A tree may add `cvsCheck` texts, keyed by CVS's own status labels, for results that set `cvsCheck` to `required` (the support needs a positive CVS decision) or `national` (a national Event found in CVS is flagged).
- `eventSupportRules.json` holds the event support checker's wording, the Annex I and Annex VI tables, its sources and the CVS status labels. See `docs/event-support.md`.
- `search/phrasebook.json` is the general-English search phrasebook (everyday words mapped to formal ones; never Code content references). It needs no edits when the Code changes. See `search/README.md`.

After editing these JSON files, run `npm run validate:data` from the project
root. After any Disclosure Guidelines change, also run
`npm run verify:disclosure-guidelines`. Do not alter the published wording,
punctuation, capitalization, Q&A labels, notes, or tables to make a check pass.
See [Project Checks](../../PROJECT_CHECKS.md) for plain-language instructions and
help interpreting the output.

For the split-file editing guide, preservation evidence, and known PDF differences, see [Code Content Split](../../docs/content-migration/README.md). For the wider data structure, see the [Project Map](../../AGENTS.md#project-map).
