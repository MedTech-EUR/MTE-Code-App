# Content Editor Guide

The content editor at **https://medtecheurope-code.org/admin/** changes the same files the app
reads: the Code's chapters, the decision trees and the Version History. There is no second copy
of the content.

## Signing in

1. Open **https://medtecheurope-code.org/admin/** in Chrome, Edge, Firefox or Safari.
2. Click **Sign In with GitHub** and sign in (the first time, click **Authorize**).
3. No access? Ask the maintainer to give your GitHub account access to the
   `MedTech-EUR/MTE-Code-App` repository.

## How publishing works

- **Save = publish.** Each save is a change on GitHub. The app is rebuilt and shows it a few
  minutes later.
- Before publishing, the build checks the content (`npm run validate:data`). If a save would break
  the app, for example a decision-tree answer that leads to a step that does not exist, or an
  unclosed HTML tag, the app keeps the previous version and the maintainer sees why.
- Every save is kept. **Content history** (the purple bar at the top) shows what changed and can
  undo it. See "Undoing a change" below.

## Finding a chapter

The left column lists the Code as the app does: **Introductory Chapters**, **Part 1: The Code**,
**Part 2: Complaint Handling**, **Part 3: Annexes & Glossary**, then **Decision Trees** and
**Version History**. Open a part, then the chapter.

A chapter has its **title**, its **summary** and its **sections**. Click a section to open it;
**Expand All** opens them all. Each section has its **title**, its **text** and its **Q&As**.

Sections and Q&As cannot be added, removed or moved here: their positions make up the links
people bookmark and share.

**Section titles:** changing a title changes the section's link, and its Q&As' links, so existing
bookmarks and links to it stop working. Change a title only as part of an approved heading change.

## Editing text

The texts of the Code (summaries, section texts, Q&A answers) are stored as HTML, exactly as
typed. Each has three views:

- **Edit** shows the HTML. Change the words between the tags; keep the tags as they are.
  - `<strong>bold</strong>`, `<em>italics</em>`, `<p>a paragraph</p>`, `<br/>` a line break,
    `<ul><li>a bullet</li></ul>` a list, `<a href="…">a link</a>`.
- **Preview** shows the text as the app does, with the app's own fonts and styles.
- **Changes** shows what you changed since you opened the text: removed words struck through,
  added words underlined. **Show the HTML changes** shows the tags too, and **Undo my changes to
  this text** puts the saved text back.

While a tag is left open (a `<strong>` without its `</strong>`, say), a yellow note under the text
says which one. Fix it before saving: a save with such a problem is not published.

The **preview pane** on the right (on a wide screen) shows the whole chapter as the app lays it
out, and follows your edits as you type.

Then click **Save** at the top right.

## Decision trees

**Decision Trees › All decision trees** holds every tree. Each tree has its title, description,
category, the chapters it is listed with, and its **questions and results** ("steps"):

- The tree starts at the step whose ID is **start**.
- A **question** has answers; each answer **leads to** the ID of another step.
- A **result** has an answer text, an **outcome** (the coloured label), an optional Code reference
  (e.g. "Chapter 1, Section 2"), and optionally a **live CVS check**.

The preview pane walks each tree from its start and shows, in red, any answer that leads to a step
that does not exist, and any step that cannot be reached.

**Live CVS check texts** (only on trees that check an Event's status in CVS) hold the text shown
for each CVS status. "{status}" is replaced by the status found in CVS.

## Version History

**Version History** lists the app's updates, newest first. To add one, click **Add update**: it is
added at the top. Write for the people who use the app (what they can now do, what looks or works
differently), in the style of the existing entries. Move the **Current** badge to the new update:
copy the badge's HTML from the previous update's text and remove it there.

## Undoing a change

Click **Content history: see and undo changes** in the purple bar (it opens a new tab), or go to
**https://medtecheurope-code.org/admin/history/**, and sign in with the same GitHub account.

- **Recent changes** lists every save, newest first: when, who, and what changed, named as in the
  editor ("3. Educational Grants › Text", "Q&A 31 · Answer"). **What changed** shows the words.
- **Undo this save** puts back what that save changed, and only that: later changes to other parts
  of the same chapter are kept. **Undo just this change** does it for one text.
- If a text was changed again by a later save, it cannot be undone from the older save without
  losing that later work. The page says which text, and what to do instead (undo the later save
  first, or restore a version).
- A save that added or removed a part (a Version History update, a decision-tree step) is undone
  whole: the item is put back as it was before that save. That is only possible while nobody has
  saved the item since; otherwise the page says so, and you can restore a version instead.
- **History** (or the search box) lists every version of a chapter or of the decision trees.
  **Restore this version** puts that whole version back.
- Before anything happens, you see exactly what will change, and nothing changes until you confirm.
  An undo or a restore is saved as a new change, so it can itself be undone. If someone else saved
  the same item while you were looking, nothing is changed and the page asks you to look again.

## Need help?

Contact the maintainer. Mention the chapter and, if possible, the time of your last save.

---

## For the maintainer

### How it fits together

| File | What it is |
|---|---|
| `public/admin/index.html` | The editor page: the bar, then Sveltia CMS (pinned version and integrity hash), then `cms-fields.js` |
| `public/admin/config.yml` | The editor's configuration: collections, fields, sign-in |
| `public/admin/cms-fields.js` | The HTML field (Edit · Preview · Changes), the chapter and decision-tree previews, start-up |
| `public/admin/admin.css`, `preview.css` | The bar and HTML field; the preview pane |
| `public/admin/lib/` | Shared by the editor, Content history and the scripts: `cms-format.js` (the JSON layout the editor writes), `html-tools.js` (HTML checks, HTML to text), `trees.js` (decision-tree checks) |
| `public/admin/history/` | Content history: `history.js` (page), `github.js` (GitHub), `content-model.js` and `history-core.js` (logic) |
| `scripts/lib/admin-files.mjs` | Writes `/admin/history/items.json` (the item names) and `/admin/app-style.css` (the app's stylesheet, for previews) in the build, and serves them in `npm run dev` |
| `scripts/format-cms-data.mjs` | `npm run format:data`: puts the editor's files in its layout |
| `oauth-proxy.js` | The sign-in Worker named by `backend.base_url` (deployed separately) |

### The editor's layout

Sveltia CMS rewrites the whole file on each save: 2-space JSON, fields in the order `config.yml`
lists them, every field it shows (empty ones as `""`, `[]` or `null`), and every text trimmed.
The files are kept in exactly that layout (`npm run format:data`), so a save changes only the lines
that were edited, and `npm run validate:data` fails if a file drifts from it. After editing the
JSON by hand, run `npm run format:data`.

`tests/cmsConfig.test.mjs` keeps `config.yml` in step: every chapter file listed once in the Code's
order, fields in the layout's order, and choices (outcomes, categories, chapters, CVS modes and
colours) matching what the app accepts. When adding a chapter, add it to `config.yml`,
`src/data/codeOrder.js` and `CHAPTER_FILES` in `public/admin/lib/cms-format.js`. When adding a field,
add it to `config.yml` and the key order in `cms-format.js`, then run `npm run format:data`.

### Working on a local copy

`npm run dev`, then open `http://localhost:3000/admin/` in Chrome or Edge and choose **Work with
Local Repository**: the editor reads and writes the files in your working copy (nothing is
committed). Content history always works on GitHub.

### Updating Sveltia CMS

1. Pick the version, then compute its hash:
   `curl -sL https://unpkg.com/@sveltia/cms@<version>/dist/sveltia-cms.js | openssl dgst -sha384 -binary | openssl base64 -A`
2. Change both the version and `integrity="sha384-…"` in `public/admin/index.html`.
3. Check locally (`npm run dev`, Work with Local Repository): open a chapter, edit and save a
   text, and confirm `git diff` shows only that line; open the decision trees and the Version
   History the same way. Then run `npm test`.

### Checks

Run `npm run check` before a release; see `PROJECT_CHECKS.md`.
