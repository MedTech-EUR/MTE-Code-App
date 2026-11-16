#!/usr/bin/env node
/**
 * Refreshes this app's copy of the National Associations and their Codes
 * (src/data/geographicArea/nationalAssociations.json), shown in the map of
 * Annex III. The list itself is edited on ethicalmedtech.eu (the country cards
 * of its "National Associations' Codes" page), which publishes it as data.
 *
 *   npm run sync:national-associations                 read the published list
 *   npm run sync:national-associations -- <file|url>   read another copy (e.g. a local build of that site)
 *
 * The map also reads the published list when a visitor opens it, so the copy
 * only matters offline and until that request answers. Refresh it now and then.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NATIONAL_ASSOCIATIONS_URL, readAssociationsList } from '../src/utils/nationalAssociations.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'src/data/geographicArea/nationalAssociations.json');
const from = process.argv[2] || NATIONAL_ASSOCIATIONS_URL;

let data;
if (/^https?:\/\//.test(from)) {
  const res = await fetch(from);
  if (!res.ok) throw new Error(`Could not read ${from} (${res.status}).`);
  data = await res.json();
} else {
  data = JSON.parse(fs.readFileSync(from, 'utf8'));
}
const countries = readAssociationsList(data);
if (!countries) throw new Error(`${from} is not a list of countries and their associations.`);

const copy = {
  note: `Copy of ${NATIONAL_ASSOCIATIONS_URL}, refreshed with "npm run sync:national-associations". Do not edit: the list is edited on ethicalmedtech.eu.`,
  countries,
};
fs.writeFileSync(FILE, `${JSON.stringify(copy, null, 2)}\n`);
console.log(`Wrote ${path.relative(ROOT, FILE)}: ${countries.length} countries, ${countries.reduce((n, c) => n + c.associations.length, 0)} associations.`);
