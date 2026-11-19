-- Name search index for the historical declarations archive.
--
-- Run AFTER the data is loaded (schema.sql, then seed.sql or
-- seed.sample.sql), and again whenever the declarations table is reloaded:
-- the index refers to declarations by rowid, which a reload changes.
--
--   npx wrangler d1 execute historical-declarations-final --remote --file=d1/historical-declarations/search-index.sql
--
-- The trigram tokenizer matches any run of three or more characters anywhere
-- in a name, ignoring case, so it gives the same answers as
-- LIKE '%text%' while reading only the matching rows instead of the whole
-- table. Shorter search text is still matched with LIKE by the Worker.
-- columnsize=0: ranking is not used, so no per-row size table is kept.
--
-- Note: `wrangler d1 export` does not export virtual tables. Drop this table
-- before an export and run this script again afterwards.

DROP TABLE IF EXISTS declarations_fts;

CREATE VIRTUAL TABLE declarations_fts USING fts5(
    company_name,
    beneficiary_name,
    content='declarations',
    content_rowid='rowid',
    tokenize='trigram',
    columnsize=0
);

INSERT INTO declarations_fts(declarations_fts) VALUES('rebuild');
