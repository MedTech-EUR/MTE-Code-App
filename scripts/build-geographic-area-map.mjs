#!/usr/bin/env node
/**
 * Draws the interactive map of Annex III (src/components/GeographicAreaMap.jsx).
 *
 *   npm run build:geographic-area-map              build from the cached boundary file (downloaded the first time)
 *   npm run build:geographic-area-map -- --refresh download the boundary file again
 *
 * Run it after changing src/data/geographicArea/areas.json or the lists below.
 * `npm run validate:data` checks that the drawing has one shape for every area
 * in areas.json, and that areas.json matches the country lists of Annex III.
 *
 * Input
 *   src/data/geographicArea/areas.json   the areas of Annex III: one per entry of its two lists
 *   Boundaries, downloaded to .cache/geographic-area/ (not in Git): Eurostat GISCO,
 *   countries 2024, latitude/longitude, at 1:20 million (the map) and
 *   1:3 million (each country's own drawing, shown when it is opened).
 *   © EuroGeographics for the administrative boundaries.
 *
 * Output (committed to Git)
 *   src/data/geographicArea/map.json
 *
 * The map is a redrawing of the figure published in Annex III
 * (public/code-assets/annex-iii-map-september-2024.png). It uses the figure's
 * own frame: the same projection (Mercator), scale and position, so that one
 * unit of the drawing is one pixel of the figure and the two can be laid over
 * each other to compare them. See docs/geographic-area-map.md.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { topology } from 'topojson-server';
import { feature, merge, mesh } from 'topojson-client';
import { presimplify, simplify } from 'topojson-simplify';
import { bounds, pathData, polygonsOf, ringArea } from './lib/map-geometry.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = path.join(ROOT, '.cache/geographic-area');
const AREAS_FILE = path.join(ROOT, 'src/data/geographicArea/areas.json');
const MAP_FILE = path.join(ROOT, 'src/data/geographicArea/map.json');
const GISCO = 'https://gisco-services.ec.europa.eu/distribution/v2/countries/geojson';
const SOURCES = {
  overview: `${GISCO}/CNTR_RG_20M_2024_4326.geojson`,
  detail: `${GISCO}/CNTR_RG_03M_2024_4326.geojson`,
};

/** The area drawn as one shape for the entry "Countries covered by Mecomed*". */
const MECOMED_AREA = 'MECOMED';

/**
 * The countries the published figure shades for "Countries covered by Mecomed*"
 * (Eurostat country codes). The Code does not list them: this is what the
 * figure shows, read by laying the boundaries over it. The codes starting with
 * X are small disputed areas inside Africa, which the figure shades with their
 * surroundings.
 */
const MECOMED = [
  'AE', 'AO', 'BF', 'BH', 'BI', 'BJ', 'BW', 'CD', 'CF', 'CG', 'CI', 'CM', 'DJ', 'DZ', 'EG', 'EH', 'ER', 'ET',
  'GA', 'GH', 'GM', 'GN', 'GQ', 'GW', 'IQ', 'IR', 'JO', 'KE', 'KW', 'LB', 'LR', 'LY', 'MA', 'MG', 'ML', 'MR',
  'MW', 'MZ', 'NA', 'NE', 'NG', 'OM', 'PK', 'PS', 'QA', 'RW', 'SA', 'SD', 'SL', 'SN', 'SO', 'SS', 'SY', 'TD',
  'TG', 'TN', 'TZ', 'UG', 'YE', 'ZM', 'ZW',
  'XF', 'XG', 'XJL', 'XU', 'XV', 'XXR',
];

/**
 * Land the published figure draws in its lighter colour: enclosed by the
 * Geographic Area without being part of it. The figure's coarse base map has
 * no microstates; Andorra, Monaco, San Marino and the Vatican City are added
 * here so they are not coloured as part of France, Spain or Italy.
 */
const OUTSIDE = ['AL', 'BA', 'ME', 'MK', 'RS', 'ZA', 'LS', 'SZ', 'AD', 'MC', 'SM', 'VA'];

/** The published figure's frame: 874 x 886 pixels, Mercator. */
const VIEW = [0, 0, 874, 886];
const SCALE = 357.5;
const ORIGIN = [159.15, 647.36];
const RAD = Math.PI / 180;
const project = ([lon, lat]) => [ORIGIN[0] + SCALE * lon * RAD, ORIGIN[1] - SCALE * Math.log(Math.tan(Math.PI / 4 + (lat * RAD) / 2))];

/**
 * Parts of a European country that the published figure does not show are left
 * out: those south of this latitude (the French overseas regions, the Canary
 * Islands) and those west of this longitude for the countries named (Madeira,
 * the Azores). Opening a country then shows its mainland at a readable size.
 */
const EUROPE_SOUTH = 30;
const WEST_LIMIT = { PT: -11 };
/** The map: smallest detail kept (Visvalingam triangle area, in square units), smallest island, decimals. */
const DETAIL = 0.04;
const MIN_ISLAND = 0.15;
const DECIMALS = 2;
/**
 * A country's own drawing, shown when it is opened and fills the frame: its
 * level of detail follows its size, as if it were this many units wide.
 */
const OPENED_SIZE = 320;
/** An area smaller than this (units, both ways) also gets a marker, so it can be seen and clicked. */
const MARKER_BELOW = 5;

async function source(name) {
  const file = path.join(CACHE, `countries-${name}.geojson`);
  if (process.argv.includes('--refresh') || !fs.existsSync(file)) {
    console.log(`Downloading ${SOURCES[name]}`);
    const res = await fetch(SOURCES[name]);
    if (!res.ok) throw new Error(`Download failed (${res.status}): ${SOURCES[name]}`);
    fs.mkdirSync(CACHE, { recursive: true });
    fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  }
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

const round = (v) => Math.round(v * 10 ** DECIMALS) / 10 ** DECIMALS;

/** The parts of a country that lie in the figure's frame, in map units. */
function partsInFrame(f, european) {
  const westLimit = WEST_LIMIT[f.properties.CNTR_ID] ?? -Infinity;
  return polygonsOf(f.geometry)
    .filter((polygon) => {
      const [x0, y0, x1, y1] = bounds(polygon[0]);
      if (european && ((y0 + y1) / 2 < EUROPE_SOUTH || (x0 + x1) / 2 < westLimit)) return false;
      const [cx, cy] = project([(x0 + x1) / 2, (y0 + y1) / 2]);
      return cx >= VIEW[0] && cx <= VIEW[2] && cy >= VIEW[1] && cy <= VIEW[3];
    })
    .map((polygon) => polygon.map((ring) => ring.map(project)));
}

/**
 * Simplifies shapes together, so neighbours keep sharing their border;
 * `threshold` is the smallest triangle area kept (Visvalingam). An island is
 * one closed line, which simplification would shrink to a point: its three
 * most important points are always kept.
 */
function simplified(objects, threshold) {
  const topo = presimplify(topology(objects, 1e6));
  for (const arc of topo.arcs) {
    const n = arc.length;
    if (n > 4 && arc[0][0] === arc[n - 1][0] && arc[0][1] === arc[n - 1][1]) {
      const keep = arc.slice(1, -1).map((p, i) => [p[2], i + 1]).sort((a, b) => b[0] - a[0]).slice(0, 3);
      for (const [, i] of keep) arc[i][2] = Infinity;
    }
  }
  return simplify(topo, threshold);
}

/** Outer rings and holes of a shape, without specks; the largest part always stays. */
function ringsOf(geometry, minIsland) {
  const polygons = polygonsOf(geometry).filter((polygon) => polygon[0].length > 3);
  const largest = Math.max(...polygons.map((polygon) => ringArea(polygon[0])));
  return polygons
    .filter((polygon) => ringArea(polygon[0]) >= Math.min(minIsland, largest))
    .flatMap((polygon) => polygon.filter((ring, i) => i === 0 || ringArea(ring) >= minIsland));
}

const areas = JSON.parse(fs.readFileSync(AREAS_FILE, 'utf8')).lists.flatMap((list) => list.areas);
const countryAreas = areas.map((a) => a.id).filter((id) => id !== MECOMED_AREA);
const wanted = new Set([...countryAreas, ...MECOMED, ...OUTSIDE]);
if (wanted.size !== countryAreas.length + MECOMED.length + OUTSIDE.length) throw new Error('A country is in more than one of: areas.json, MECOMED, OUTSIDE.');

const features = [];
for (const f of (await source('overview')).features) {
  const id = f.properties.CNTR_ID;
  if (!wanted.has(id)) continue;
  const polygons = partsInFrame(f, countryAreas.includes(id));
  if (!polygons.length) throw new Error(`${id} has no part inside the map's frame.`);
  features.push({ type: 'Feature', properties: { id }, geometry: { type: 'MultiPolygon', coordinates: polygons } });
}
const missing = [...wanted].filter((id) => !features.some((f) => f.properties.id === id));
if (missing.length) throw new Error(`No boundary found for: ${missing.join(', ')}`);

const simple = simplified({ land: { type: 'FeatureCollection', features } }, DETAIL);
const geometries = simple.objects.land.geometries;
const idOf = (g) => g.properties.id;

/**
 * A country's own drawing, from the finer boundaries. It replaces the country's
 * shape on the map while the country is open; the two differ by less than a
 * pixel at the map's size.
 */
const detailFeatures = new Map((await source('detail')).features.map((f) => [f.properties.CNTR_ID, f]));
function openedPath(id, [, , w, h]) {
  const f = detailFeatures.get(id);
  if (!f) throw new Error(`No detailed boundary found for ${id}.`);
  const unit = Math.max(w, h) / OPENED_SIZE; // one unit of the opened drawing, in map units
  const geometry = { type: 'MultiPolygon', coordinates: partsInFrame(f, true) };
  const topo = simplified({ c: geometry }, (0.8 * unit) ** 2);
  const decimals = Math.max(1, Math.ceil(-Math.log10(unit / 3)));
  return pathData(ringsOf(feature(topo, topo.objects.c).geometry, (2.5 * unit) ** 2), decimals);
}

function shape(id, geometry) {
  const rings = ringsOf(geometry, MIN_ISLAND);
  const [x0, y0, x1, y1] = bounds(rings.flat());
  const out = { id, box: [x0, y0, x1 - x0, y1 - y0].map(round), d: pathData(rings, DECIMALS) };
  if (x1 - x0 < MARKER_BELOW && y1 - y0 < MARKER_BELOW) out.marker = [round((x0 + x1) / 2), round((y0 + y1) / 2)];
  if (id !== MECOMED_AREA) out.opened = openedPath(id, out.box);
  return out;
}

const shapes = areas.map((area) =>
  area.id === MECOMED_AREA
    ? shape(area.id, merge(simple, geometries.filter((g) => MECOMED.includes(idOf(g)))))
    : shape(area.id, feature(simple, geometries.find((g) => idOf(g) === area.id)).geometry),
);
// Borders between the countries of the Mecomed area, drawn as faint lines as in the figure.
const inner = mesh(simple, simple.objects.land, (a, b) => a !== b && MECOMED.includes(idOf(a)) && MECOMED.includes(idOf(b)));
const lines = inner.type === 'LineString' ? [inner.coordinates] : inner.coordinates;
const outside = ringsOf(merge(simple, geometries.filter((g) => OUTSIDE.includes(idOf(g)))), MIN_ISLAND);

const map = {
  note: 'Generated by scripts/build-geographic-area-map.mjs from src/data/geographicArea/areas.json. Do not edit by hand.',
  viewBox: VIEW,
  areas: shapes,
  lines: [{ area: MECOMED_AREA, d: pathData(lines, DECIMALS, false) }],
  outside: pathData(outside, DECIMALS),
};
fs.writeFileSync(MAP_FILE, `${JSON.stringify(map)}\n`);
const kb = (fs.statSync(MAP_FILE).size / 1024).toFixed(0);
console.log(`Wrote ${path.relative(ROOT, MAP_FILE)}: ${shapes.length} areas, ${kb} KB.`);
console.log(`Markers for small areas: ${shapes.filter((s) => s.marker).map((s) => s.id).join(', ') || 'none'}`);
