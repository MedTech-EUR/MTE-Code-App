# Historical Declarations D1 data

- `schema.sql` — D1 schema.
- `seed.sql` — the final archive: 31,095 declarations (2023 and 2024
  published, 2025 draft), 154 companies, 20,315 beneficiaries, 261
  countries, 23 currencies. Generated locally by
  `scripts/build-final-historical-declarations.py` from the legacy
  PostgreSQL dump. Not tracked in Git (see `.gitignore`); counts and the
  source-dump hash are recorded in `seed.sql.validation.json`.
  On Transparent MedTech, the 2025 “draft” status meant final figures
  awaiting the platform's publication date (confirmed by MedTech Europe in
  October 2026). The platform has shut down, so the dump of 19 August 2026
  is the only source; it cannot hold declarations filed after that date.
- `seed.sample.sql` — 100-declaration sample with company and
  beneficiary/HCO names replaced by clearly-fake placeholders
  (`... (test data)`), for local testing without real names. Regenerate
  with `python3 scripts/build-sanitized-d1-sample.py`. See that script's
  docstring for what it does and doesn't sanitize (addresses and one
  legacy data-quality outlier still carry real identifying text in a
  few rows).

## Which database am I looking at?

This is the single most common source of confusion, so check it first.

| | local fixture | final archive |
|---|---|---|
| Source | `seed.sample.sql` | `seed.sql` |
| Declarations | 100 | 31,095 |
| Years | **2022**, 2023, 2024 | 2023, 2024, 2025 |
| Lives in | `.wrangler/state/v3/d1/` | Cloudflare D1 `historical-declarations-final` |

**Any 2022 in the year filter means you are on the local fixture.** The
final archive excludes 2022 and earlier by design.

`wrangler dev` uses the local fixture **by default**. The
`database_name` and `database_id` in `wrangler.toml` identify the remote
database only and are ignored in local mode — editing them does not
change what a plain `wrangler dev` serves. Pick the dataset with the
script you run:

```bash
npm install            # once, to install the pinned wrangler
npm run dev:worker         # local fixture, offline, no Cloudflare account
npm run dev:worker:remote  # the real archive on Cloudflare D1
```

Both scripts run `npm run build` first, because the Worker serves the
React app from `dist/` via the `ASSETS` binding — without a fresh build
you get a stale frontend.

## Testing locally against the fixture

`wrangler dev`'s local D1 mode runs entirely offline against a local
SQLite file — no `wrangler login` or real `database_id` required.

```bash
npx wrangler d1 execute historical-declarations-final --local --file=d1/historical-declarations/schema.sql
npx wrangler d1 execute historical-declarations-final --local --file=d1/historical-declarations/seed.sample.sql
npm run dev:worker
```

Then open http://localhost:8787/transparency/historical-declarations.

To reset local state: `rm -rf .wrangler/state/v3/d1` and re-run the two
`wrangler d1 execute` commands above. Note that the local file is keyed
to the `database_id` in `wrangler.toml`, so changing that ID gives you a
fresh empty local database rather than an error.

## Verifying which dataset the app is serving

Use `curl`, not the browser — the browser will happily serve a cached
response and hide the answer.

```bash
curl "http://localhost:8787/api/historical-declarations/metadata"
curl "http://localhost:8787/api/historical-declarations/search?year=2022&limit=1"
curl "http://localhost:8787/api/historical-declarations/search?currency=RSD&limit=1"
```

Against the final archive: `metadata` returns years `[2025, 2024, 2023]`,
`year=2022` returns `total: 0`, and `currency=RSD` returns `total: 2`.

`search` caps `total` at `MAX_ACCESSIBLE_RECORDS` (1000) as an
anti-scraping measure, so `year=2024` reports `total: 1000` rather than
10,981. That is expected. Use a narrow filter when you want to check an
exact count against `seed.sql.validation.json` — for example `RSD` (2),
`NOK` (52), `HRK` (68).

## Loading the archive into a remote D1 database

Already done for `historical-declarations-final`
(`cd4e5d0a-0fa1-4aae-94b4-be4aa540adb0`). To rebuild from scratch:

1. `npx wrangler d1 create <name>` and put the returned `database_id`
   into `wrangler.toml`.
2. `npx wrangler d1 execute <name> --remote --file=d1/historical-declarations/schema.sql`
3. `npx wrangler d1 execute <name> --remote --file=d1/historical-declarations/seed.sql`
4. Confirm with
   `npx wrangler d1 execute <name> --remote --command "SELECT year, COUNT(*) FROM declarations GROUP BY year ORDER BY year;"`

## What stays public

The Worker shows each reporting year until 31 August three years after its
publication deadline (`oldestPublicYear()` in
`historical-declarations-api.js`): 2023 until 31 August 2027, 2024 until
31 August 2028. Older years drop out of the year filter, the search and the
record links automatically. Delete them from D1 once a year as well, with
the beneficiaries left without declarations, so the data is not kept longer
than it is shown:

`npx wrangler d1 execute historical-declarations-final --remote --command "DELETE FROM declarations WHERE year < <oldest public year>; DELETE FROM beneficiaries WHERE id NOT IN (SELECT beneficiary_id FROM declarations);"`

## Removing beneficiaries

Records of individual practitioners, and of anyone whose objection is
upheld, are removed from the archive rather than hidden:

1. Review the candidates. Every row marked `yes` in the `Individual?`
   column is removed; save the sheet as CSV (commas or semicolons both work).
2. `node scripts/archive-removal.mjs <reviewed.csv>` writes
   `private/remove-beneficiaries.sql` and `private/excluded-beneficiaries.txt`.
   A text file with one beneficiary ID per line also works as input.
3. `npx wrangler d1 execute historical-declarations-final --remote --file=d1/historical-declarations/private/remove-beneficiaries.sql`
4. Keep `excluded-beneficiaries.txt` with the legacy dump. The build script
   requires it (`--exclude-beneficiaries`), so a rebuild cannot bring the
   removed beneficiaries back; add new IDs to it when more are removed.

The `private/` folder is ignored by Git: its files identify people. Never
commit them.
