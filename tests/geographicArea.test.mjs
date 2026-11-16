import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { checkGeographicArea, readHeadedLists } from '../src/utils/geographicArea.js';
import { findAreaAssociations, readAssociationsList } from '../src/utils/nationalAssociations.js';
import { findReaderEmbed } from '../src/config/readerEmbeds.js';

const readJson = (path) => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'));

// A small Annex in the shape of the Code's: two headed lists, a figure and a note.
const TEXT = [
  '<figure data-reader-embed="geographic-area-map"><img src="/map.png" alt="Map" /></figure>',
  '<h4>Countries with associations:</h4>',
  '<ul><li><span aria-hidden="true">■</span><span>Austria</span></li><li><span>The Netherlands</span></li><li><span>Countries covered by Regional*</span></li></ul>',
  '<h4>Countries without:</h4><ul><li>Malta</li></ul>',
  '<p>*Countries covered by Regional are a group.</p>',
].join('');
const AREAS = {
  lists: [
    {
      heading: 'Countries with associations',
      areas: [
        { id: 'AT', name: 'Austria' },
        { id: 'NL', name: 'The Netherlands' },
        { id: 'REGION', name: 'Countries covered by Regional*', association: 'Regional', note: '*Countries covered by Regional are a group.' },
      ],
    },
    { heading: 'Countries without', areas: [{ id: 'MT', name: 'Malta' }] },
  ],
};
const MAP = { areas: ['AT', 'NL', 'REGION', 'MT'].map((id) => ({ id })) };
const ASSOCIATIONS = {
  countries: [
    { country: 'Austria', url: 'https://example.org/codes/#austria', associations: [{ name: 'One', website: 'https://one.example', codes: [{ label: 'Code', url: 'https://example.org/one.pdf' }] }] },
    { country: 'Netherlands', url: 'https://example.org/codes/#netherlands', associations: [{ name: 'Two', codes: [] }] },
    { country: 'A region', url: 'https://example.org/codes/#a-region', associations: [{ name: 'Regional', codes: [] }] },
  ],
};
const check = (changes = {}) => checkGeographicArea({ legalText: TEXT, areas: AREAS, map: MAP, associations: ASSOCIATIONS, ...changes });

test('reads the headed lists of a text without bullets or closing colons', () => {
  assert.deepEqual(readHeadedLists(TEXT), [
    { heading: 'Countries with associations', entries: ['Austria', 'The Netherlands', 'Countries covered by Regional*'] },
    { heading: 'Countries without', entries: ['Malta'] },
  ]);
});

test('a map that matches the text has no errors', () => {
  assert.deepEqual(check(), { errors: [], notes: [] });
});

test('a country added to the text must be added to the map', () => {
  const { errors } = check({ legalText: TEXT.replace('<li>Malta</li>', '<li>Malta</li><li>Iceland</li>') });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /"Iceland" is in the Code's list "Countries without" but not in areas\.json/);
});

test('a country removed from the text, a changed note, a stale drawing and a missing figure are errors', () => {
  assert.match(check({ legalText: TEXT.replace('<li>Malta</li>', '<li>Gozo</li>') }).errors.join('\n'), /"Malta" is in areas\.json but not in the Code's list/);
  assert.match(check({ legalText: TEXT.replace('are a group', 'were a group') }).errors[0], /note of "Countries covered by Regional\*"/);
  assert.match(check({ map: { areas: [{ id: 'AT' }, { id: 'NL' }, { id: 'REGION' }, { id: 'XX' }] } }).errors[0], /not drawn: MT; drawn but not in areas\.json: XX/);
  assert.match(check({ legalText: null }).errors[0], /the map is not shown/);
});

test('countries without a published Code, and published countries outside the area, are notes', () => {
  const associations = { countries: [...ASSOCIATIONS.countries.slice(1), { country: 'Elsewhere', associations: [{ name: 'Three', codes: [] }] }] };
  const { errors, notes } = check({ associations });
  assert.deepEqual(errors, []);
  assert.equal(notes.length, 2);
  assert.match(notes[0], /no National Association Code for Austria\./);
  assert.match(notes[1], /lists Elsewhere, which Annex III does not/);
});

test('an area finds its entry by country name, or by the association it names', () => {
  const countries = readAssociationsList(ASSOCIATIONS);
  const [austria, netherlands, region] = AREAS.lists[0].areas;
  assert.equal(findAreaAssociations(austria, countries).country, 'Austria');
  assert.equal(findAreaAssociations(netherlands, countries).country, 'Netherlands');
  assert.equal(findAreaAssociations(region, countries).country, 'A region');
  assert.equal(findAreaAssociations(AREAS.lists[1].areas[0], countries), null);
});

test('only web addresses from the published list become links', () => {
  const countries = readAssociationsList({
    countries: [
      {
        country: ' Austria ',
        url: 'javascript:alert(1)',
        associations: [
          { name: 'One', website: 'ftp://one.example', codes: [{ label: 'Code', url: 'javascript:alert(1)' }, { label: 'Code', url: 'https://example.org/one.pdf' }, { label: '', url: 'https://example.org/two.pdf' }] },
          { name: '' },
        ],
      },
      { country: 'Nowhere', associations: [] },
      'not an entry',
    ],
  });
  assert.deepEqual(countries, [
    { country: 'Austria', url: null, associations: [{ name: 'One', website: null, codes: [{ label: 'Code', url: 'https://example.org/one.pdf' }] }] },
  ]);
  assert.equal(readAssociationsList({ countries: [] }), null);
  assert.equal(readAssociationsList('<html>'), null);
});

test('a figure names its interactive version; unknown names are ignored', () => {
  assert.equal(findReaderEmbed(TEXT), 'geographic-area-map');
  assert.equal(findReaderEmbed('<figure data-reader-embed="something-else"></figure>'), null);
  assert.equal(findReaderEmbed('<figure><img src="/map.png" alt="" /></figure>'), null);
});

test('the project\'s map has a drawing for every area, inside the published figure\'s frame', () => {
  const map = readJson('src/data/geographicArea/map.json');
  const areas = readJson('src/data/geographicArea/areas.json').lists.flatMap((list) => list.areas);
  assert.deepEqual(map.viewBox, [0, 0, 874, 886]);
  assert.equal(map.areas.length, areas.length);
  for (const shape of map.areas) {
    const [x, y, width, height] = shape.box;
    assert.ok(shape.d.startsWith('M'), `${shape.id} has a drawing`);
    assert.ok(x >= 0 && y >= 0 && x + width <= 874 && y + height <= 886, `${shape.id} lies inside the frame`);
  }
});
