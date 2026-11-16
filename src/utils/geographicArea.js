// Checks that the interactive map of Annex III (GeographicAreaMap.jsx) agrees with the Code's
// text. The map's areas (data/geographicArea/areas.json) repeat the country lists of Annex III,
// because each needs a shape on the map; this keeps the two in step when the Code changes.
// Used by `npm run validate:data`.

import { htmlToPlainText } from './htmlTextUtils.js';
import { findAreaAssociations, readAssociationsList } from './nationalAssociations.js';

export const GEOGRAPHIC_AREA_EMBED = 'geographic-area-map';

const plain = (html) => htmlToPlainText(html).replace(/\s+/g, ' ').trim();

// The lists in a section's text: each heading that is followed by a list, with the list's
// entries. Bullet characters and the heading's closing colon are not part of the names.
export function readHeadedLists(html) {
  const lists = [];
  const pattern = /<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>\s*<ul\b[^>]*>([\s\S]*?)<\/ul>/gi;
  for (const [, heading, body] of String(html || '').matchAll(pattern)) {
    lists.push({
      heading: plain(heading).replace(/:$/, ''),
      entries: [...body.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)].map(([, item]) => plain(item).replace(/^[^\p{L}\p{N}]+/u, '')),
    });
  }
  return lists;
}

// Problems (errors) and remarks (notes) about the map's data, as sentences.
//   legalText     the text of the section that shows the map, or null if no section does
//   areas         data/geographicArea/areas.json
//   map           data/geographicArea/map.json
//   associations  data/geographicArea/nationalAssociations.json
export function checkGeographicArea({ legalText, areas, map, associations }) {
  const errors = [];
  const notes = [];
  const where = 'Annex III map';
  const lists = Array.isArray(areas?.lists) ? areas.lists : [];
  const allAreas = lists.flatMap((list) => (Array.isArray(list?.areas) ? list.areas : []));

  if (legalText === null || legalText === undefined) {
    errors.push(`${where}: no section's text has <figure data-reader-embed="${GEOGRAPHIC_AREA_EMBED}">, so the map is not shown.`);
  } else {
    const inText = readHeadedLists(legalText);
    for (const list of lists) {
      const match = inText.find((candidate) => candidate.heading === list.heading);
      if (!match) {
        errors.push(`${where}: areas.json has the list "${list.heading}", which the Code's text does not have.`);
        continue;
      }
      const names = list.areas.map((area) => area.name);
      for (const name of match.entries.filter((entry) => !names.includes(entry))) {
        errors.push(`${where}: "${name}" is in the Code's list "${list.heading}" but not in areas.json. Add it there, then run \`npm run build:geographic-area-map\`.`);
      }
      for (const name of names.filter((entry) => !match.entries.includes(entry))) {
        errors.push(`${where}: "${name}" is in areas.json but not in the Code's list "${list.heading}".`);
      }
    }
    for (const candidate of inText.filter((entry) => !lists.some((list) => list.heading === entry.heading))) {
      errors.push(`${where}: the Code's list "${candidate.heading}" is not in areas.json.`);
    }
    const text = plain(legalText);
    for (const area of allAreas.filter((entry) => entry.note)) {
      if (!text.includes(area.note)) errors.push(`${where}: the note of "${area.name}" in areas.json is not in the Code's text word for word.`);
    }
  }

  const ids = allAreas.map((area) => area.id);
  for (const id of new Set(ids.filter((entry, index) => ids.indexOf(entry) !== index))) {
    errors.push(`${where}: area "${id}" is listed twice in areas.json.`);
  }
  const shapes = Array.isArray(map?.areas) ? map.areas.map((shape) => shape.id) : [];
  const undrawn = ids.filter((id) => !shapes.includes(id));
  const unlisted = shapes.filter((id) => !ids.includes(id));
  if (undrawn.length || unlisted.length) {
    errors.push(
      `${where}: the drawing is out of date (${[
        undrawn.length ? `not drawn: ${undrawn.join(', ')}` : '',
        unlisted.length ? `drawn but not in areas.json: ${unlisted.join(', ')}` : '',
      ].filter(Boolean).join('; ')}). Run \`npm run build:geographic-area-map\`.`,
    );
  }

  const countries = readAssociationsList(associations);
  if (!countries) {
    errors.push(`${where}: nationalAssociations.json is not a list of countries and their associations. Run \`npm run sync:national-associations\`.`);
  } else {
    const used = new Set();
    for (const area of allAreas) {
      const entry = findAreaAssociations(area, countries);
      if (entry) used.add(entry);
      else if (area.association) errors.push(`${where}: no entry of nationalAssociations.json lists the association "${area.association}".`);
    }
    // Only the first list is of countries with National Associations.
    const without = (lists[0]?.areas || []).filter((area) => !findAreaAssociations(area, countries)).map((area) => area.name);
    if (without.length) notes.push(`${where}: ethicalmedtech.eu lists no National Association Code for ${without.join(', ')}.`);
    const unused = countries.filter((entry) => !used.has(entry)).map((entry) => entry.country);
    if (unused.length) notes.push(`${where}: ethicalmedtech.eu lists ${unused.join(', ')}, which Annex III does not; not shown on the map.`);
  }

  return { errors, notes };
}
