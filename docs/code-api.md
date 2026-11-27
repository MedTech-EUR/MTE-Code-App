# The Code API and live embeds

## Embed a provision in a website or intranet

In the Code reader, open **Cite/Link** beside a section or individual Q&A. Choose whether to show the Code-wide edition and version. A section can also include all its related Q&As, including ones published later. Choose **Copy live embed** and paste the result into an HTML or iframe block. The host must permit frames from medtecheurope-code.org. The frame includes a link to the passage in the official reader. Its default height is 420 pixels and the host can adjust it.

For example, the original permanent ID for Collaborative Research is `ch6-4-collaborative-research`. This ID stays with the provision if its number or chapter changes.

```html
<iframe src="https://medtecheurope-code.org/api/code/v1/embed/ch6-4-collaborative-research?qas=1" title="Collaborative Research — MedTech Europe Code" width="100%" height="420" loading="lazy" style="border:0"></iframe>
```

## API addresses

All paths below start with `https://medtecheurope-code.org/api/code/v1`. The feed is public, read-only and requires no key.

| Path | Response |
| --- | --- |
| Base address | JSON index, field descriptions, reuse terms and publication details |
| `/code` | Full Code with glossary, annexes and Q&As |
| `/chapters/{chapterId}` | One chapter with sections and their Q&As |
| `/items/{id}` | One section with its related Q&As, or one Q&A with its section and chapter context |
| `/embed/{id}` | An embeddable HTML document. Use `qas=1` to include related questions and `version=0` to hide the release label. |

Read `id` from the returned section or Q&A. Its `url` and `anchorId` identify its current reader location. The printed Q&A number is in `label`. Each item carries structural `html` and plain `text`; tables in plain text repeat merged cell values on each affected row and column. A section with a published figure includes its URL and description. App summaries and website pages are excluded.

`about.version` is the publisher-assigned Code-wide substantive version. `about.edition` holds the formal edition designation when supplied. `about.contentHash` is a technical change detector. Edits to spacing, links and punctuation can refresh the material without changing the release label. Each response carries reuse terms and a link to the official publication.

GET and HEAD responses can be cached for an hour. Optional conditional requests with the ETag return 304 when unchanged. Sites may read JSON across origins. Unknown items return 404. A withdrawn item returns 410, with a notice in the frame. Hosts that store their own copy should refresh it and act on the status. The embed updates when loaded or reloaded after cache expiry. Printed documents and static quotations retain the wording they copied.

## Maintaining the feed

- Edit and publish existing wording through the usual workflow. The build regenerates the reader, API and embed files. The editor preserves each hidden permanent ID. No release-label or ID entry is needed for routine edits.
- At a substantive release, update `CODE_VERSION` once in `src/data/codeEdition.js`, even if only one Q&A changed. Set `CODE_EDITION` for a formally designated edition and update `CODE_PDF` when the publication URL changes. Publish when the new text takes effect.
- When moving or renumbering records, carry their `liveId` fields with them, including the Q&As. For new records, leave the field absent and run `npm run assign:code-ids`; commit the changed chapter files and ID registry together. Running the command again preserves the assigned IDs.
- After a wholesale import, `npm run assign:code-ids -- --suggest-from <previous-git-ref>` lists unique wording matches across chapters and ignores printed Q&A numbering. Review the suggestions and carry the confirmed IDs into the imported records before assigning IDs to genuinely new material. Resolve splits, mergers and ambiguous matches explicitly. Never reuse an old ID for unrelated wording.
- For withdrawal, remove the record and move its ID from `active` to `withdrawn` in `src/data/code-live-ids.json`. Preserve IDs of any surviving or moved Q&As. The registry retains identifiers only. Validation and the build catch missing, duplicate, unregistered and retired IDs.
- Run `npm run check`. The static output deploys with the existing Worker. The regression tests exercise renumbering, release labels, withdrawal and annex formatting.
