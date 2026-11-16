# Utils

This directory contains deterministic helper functions and utility modules for non-UI logic, including text processing, search highlighting, unique ID generation, local resource-link resolution, bookmark namespacing, and URL parsing. `routeUtils.js` builds canonical Code and Transparency URLs and resolves both current paths and supported legacy hashes without depending on browser APIs. `resourceUtils.js` replaces approved `resource:` targets with bundled download URLs while preserving the visible publication text.

`csvUtils.js` parses the bundled Annex I semicolon-delimited template without
coercing or reformatting cell values. `htmlTextUtils.js` produces visible-text
search input so HTML tags and resource attributes do not create false matches.
`routeEffects.js` owns cancellable delayed anchor scrolling and highlighting;
`searchResultUtils.js` normalizes whitespace-only queries.

`searchText.js`, `searchDocuments.js`, `searchEngine.js` and `searchEvents.js` make up the in-browser search engine; its ranking constants live in `SEARCH_RANKING` in `searchEngine.js`. Everything is derived from the current content every time the app loads, so Code updates need no search changes.

`eventSupportQuestions.js`, `eventSupportRules.js` and `eventSupportCvs.js` make up the event support checker's logic; they return message IDs whose wording lives in `src/data/eventSupportRules.json`. `linkedTextEvents.js` is the click and key handling for glossary terms and reference links shared by the readers and the checker.

Routing behavior and identifier stability requirements are documented in the [URL Routing Guide](../../ROUTING.md).

For more details on these utilities, see the [Project Map](../../AGENTS.md#project-map).
