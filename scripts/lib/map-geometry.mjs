/**
 * Small geometry helpers for the Annex III map (scripts/build-geographic-area-map.mjs).
 * Coordinates are map units with y pointing down (SVG).
 */

/** Area of a ring (absolute value), in the square of its units. */
export function ringArea(ring) {
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) a += (ring[j][0] + ring[i][0]) * (ring[j][1] - ring[i][1]);
  return Math.abs(a / 2);
}

/** The polygons of a GeoJSON Polygon or MultiPolygon, as arrays of rings. */
export function polygonsOf(geometry) {
  if (!geometry) return [];
  if (geometry.type === 'Polygon') return [geometry.coordinates];
  if (geometry.type === 'MultiPolygon') return geometry.coordinates;
  throw new Error(`Unexpected geometry type ${geometry.type}`);
}

/** Bounding box [minX, minY, maxX, maxY] of a list of points. */
export function bounds(points) {
  let b = [Infinity, Infinity, -Infinity, -Infinity];
  for (const [x, y] of points) b = [Math.min(b[0], x), Math.min(b[1], y), Math.max(b[2], x), Math.max(b[3], y)];
  return b;
}

/**
 * Encodes rings (arrays of [x, y] map units) as compact SVG path data: an
 * absolute move to the first point, then relative line segments rounded to
 * `decimals`. Differences are taken between rounded absolute positions, so
 * rounding errors do not add up along the ring.
 *
 * @param {number[][][]} rings
 * @param {number} decimals
 * @param {boolean} closed  close each ring with "z" (areas) or not (lines)
 */
export function pathData(rings, decimals, closed = true) {
  const f = 10 ** decimals;
  const num = (v) => {
    let s = (Math.round(v * f) / f).toFixed(decimals);
    if (s.includes('.')) s = s.replace(/0+$/, '').replace(/\.$/, '');
    return s === '-0' ? '0' : s;
  };
  let out = '';
  for (const ring of rings) {
    let prev = null;
    let body = '';
    let count = 0;
    // A closed GeoJSON ring repeats its first point at the end; "z" does that.
    const last = ring.length - 1;
    const points = closed && last > 0 && ring[0][0] === ring[last][0] && ring[0][1] === ring[last][1] ? ring.slice(0, last) : ring;
    for (const [x, y] of points) {
      const p = [Math.round(x * f), Math.round(y * f)];
      if (prev && p[0] === prev[0] && p[1] === prev[1]) continue;
      if (!prev) out += `M${num(p[0] / f)} ${num(p[1] / f)}`;
      else {
        const dx = num((p[0] - prev[0]) / f);
        const dy = num((p[1] - prev[1]) / f);
        body += `${count ? ' ' : 'l'}${dx} ${dy}`;
        count++;
      }
      prev = p;
    }
    out += body + (closed ? 'z' : '');
  }
  // Tidy: no space before a minus sign.
  return out.replace(/ -/g, '-');
}
