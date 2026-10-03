import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { tsImport } from 'tsx/esm/api';

const { ArchiveNotice, ARCHIVE_CONTACT, getRecordReportHref } = await tsImport(
  '../src/components/HistoricalDeclarationsContent.jsx',
  import.meta.url,
);

test('the archive notice says how long records stay public and how to object', () => {
  const markup = renderToStaticMarkup(React.createElement(ArchiveNotice, { oldestYear: 2023 }));

  assert.match(markup, /About this data/);
  assert.match(markup, /legitimate interest/);
  assert.match(markup, /2023 until 31 August 2027\./);
  assert.match(markup, new RegExp(`href="mailto:${ARCHIVE_CONTACT}"`));
  assert.match(markup, /href="https:\/\/www\.dataprotectionauthority\.be\/citizen" target="_blank" rel="noopener noreferrer"/);
  // The Disclosure Guidelines let companies modify or delete their disclosures at any time.
  assert.match(markup, /Member Companies can ask to correct or remove their own declarations the same way\./);

  // Before the years have loaded, the example is left out rather than guessed.
  const loading = renderToStaticMarkup(React.createElement(ArchiveNotice, { oldestYear: null }));
  assert.match(loading, /publication deadline\./);
});

test('a problem report names the record it is about', () => {
  const href = getRecordReportHref({
    id: '0006e591-2ebe-4cf7-b666-f8d2edd16088',
    beneficiary_name: 'Riverside General Hospital',
    company_name: 'Northwind MedTech',
    year: 2024,
  });
  const url = new URL(href);

  assert.equal(url.protocol, 'mailto:');
  assert.equal(url.pathname, ARCHIVE_CONTACT);
  assert.equal(url.searchParams.get('subject'), 'Historical Declarations: record 0006e591-2ebe-4cf7-b666-f8d2edd16088');
  const body = url.searchParams.get('body');
  assert.match(body, /^Record: 0006e591-2ebe-4cf7-b666-f8d2edd16088\r\nBeneficiary: Riverside General Hospital\r\nCompany: Northwind MedTech\r\nYear: 2024\r\n/);
});
