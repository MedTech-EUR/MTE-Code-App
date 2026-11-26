# The Code API

The Code API publishes the text of the MedTech Europe Code of Ethical Business Practice
(its chapters, sections, Q&As, Glossary and Annexes) as JSON, for Member Companies' own tools,
ethicalmedtech.eu and anyone else. It is public, read-only and free of charge. MedTech Europe,
which owns the Code, approved its publication in November 2026.

## Addresses

| Address | Answers |
| --- | --- |
| `https://medtecheurope-code.org/api/code/v1` | About the text (edition, terms) and the list of chapters, with the address of each |
| `https://medtecheurope-code.org/api/code/v1/code` | The whole Code: every chapter with its sections and Q&As (about 390 KB, 60 KB compressed) |
| `https://medtecheurope-code.org/api/code/v1/chapters/{chapterId}` | One chapter, for example `/chapters/ch4` or `/chapters/glossary` |

Every answer is JSON, and any site may read it from the browser (`Access-Control-Allow-Origin: *`).
No key, sign-in or cookie is involved. Only `GET` (and `HEAD`) is accepted. An address that is
not one of these, or a chapter ID that does not exist, is answered with a JSON error:
`{ "error": { "code": "NOT_FOUND" | "CHAPTER_NOT_FOUND", "message": "…" } }`.

Answers may be kept for an hour (`Cache-Control: public, max-age=3600`). Each carries an `ETag`:
send it back as `If-None-Match` and an unchanged answer comes back as `304 Not Modified`, so a
tool can check for a newer text as often as it likes at almost no cost.

## What an answer contains

Every answer starts with `about`:

```json
{
  "title": "MedTech Europe Code of Ethical Business Practice",
  "edition": "September 2024",
  "contentHash": "fcc2952cc844a889",
  "website": "https://medtecheurope-code.org/code",
  "terms": { "owner": "…", "reuse": "…", "authority": "…", "publishedEdition": "…" }
}
```

`contentHash` changes whenever any of the text changes. `terms` says how the text may be reused
and that the edition published by MedTech Europe prevails.

A chapter:

```json
{
  "id": "ch4",
  "heading": "Chapter 4: Grants and Charitable Donations",
  "title": "Grants and Charitable Donations",
  "part": { "id": "part1", "label": "Part 1: The Code" },
  "url": "https://medtecheurope-code.org/code/ch4",
  "api": "https://medtecheurope-code.org/api/code/v1/chapters/ch4",
  "sectionCount": 3,
  "qaCount": 12,
  "sections": [
    {
      "id": "ch4-3-educational-grants",
      "title": "3. Educational Grants",
      "url": "https://medtecheurope-code.org/code/ch4#ch4-3-educational-grants",
      "html": "<strong>a.</strong> …",
      "text": "a. …",
      "qas": [
        {
          "id": "ch4-3-educational-grants-qa-1",
          "label": "Q&A 29",
          "question": "What are the differences between an Educational Grant and a commercial sponsorship?",
          "url": "https://medtecheurope-code.org/code/ch4#ch4-3-educational-grants-qa-1",
          "html": "…",
          "text": "…"
        }
      ]
    }
  ]
}
```

The index lists the chapters without their `sections`. In the Glossary each section is one
definition, titled with its term.

- **`html`** is the text with its structure and nothing else: paragraphs, line breaks, lists,
  tables (with their cell spans), bold, italics, superscripts and links (as absolute
  addresses). No tag has any other attribute, and there are no scripts, styles, icons or
  images, so it can be shown as it is.
- **`text`** is the same text as plain text: paragraphs and list items on their own lines,
  table cells separated by tabs.
- **`url`** is the page in the app that shows the text, for a "Read in the Code" link.
- **`label`** is the Q&A number printed in the Code. A new edition may renumber Q&As, so use
  `id` to refer to one.

The wording is the app's own text of the Code, the same as on medtecheurope-code.org, with
only the screen styling removed. The app's own chapter summaries are not part of the Code and
are left out.

## Identifiers

`chapters[].id`, `sections[].id` and `qas[].id` are the same as the app's own link addresses
(`/code/{chapterId}#{id}`), so a link built from the API always opens that text. They follow the
rules in ROUTING.md, "Identifiers That Protect Links": a section's ID comes from its title and a
Q&A's from its place in its section. They change only when a section is renamed or a section's
Q&As are reordered, which the Version History announces. A change that would break existing
readers in any other way (a field removed or renamed, a different structure) gets a new
version, `/api/code/v2`, while `v1` keeps answering.

## How it works

- `scripts/lib/code-api.mjs` makes the answers from the Code's chapter files: the same IDs as the
  app (`generateSectionId`, `getQaAnchorId`), the HTML through the build's sanitizer
  (`sanitizeContentHtml` in `scripts/lib/prerender.mjs`, keeping web links), and the edition from
  `src/data/codeEdition.js`. The terms are `CODE_API_TERMS` in the same file.
- `npm run build` ends with `scripts/build-code-api.mjs`, which writes the answers to
  `dist/api/code/v1/` (`index.json`, `code.json`, `chapters/{id}.json`). They are made on every
  build, so the API always has the text the app shows, including changes saved in the content
  editor. They are not part of the app's offline copy.
- `code-api.js` (beside `server.js`) answers the addresses: it maps each to its file, serves it
  through the static-assets binding with the headers above, and passes on only the reader's
  cache validators. `server.js` sends every `/api/code` request to it.
- `tests/codeApi.test.mjs` checks the answers against the chapter files (every section and Q&A,
  under the app's IDs, with no styling left) and the Worker's addresses, headers and errors.

When a new edition's text is loaded, change `CODE_EDITION` in `src/data/codeEdition.js` (the
Code's own page shows it too) and point `publishedEdition` in `CODE_API_TERMS` at that edition's
published PDF.
