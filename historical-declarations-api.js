/**
 * Historical Declarations API — read-only D1-backed query handlers for the
 * Transparency section's declarations registry. Called from server.js before
 * the static-asset SPA fallback.
 */

const PAGE_SIZE_DEFAULT = 50;
const PAGE_SIZE_MAX = 100;
const MAX_ACCESSIBLE_RECORDS = 1000;

// Search text this long or longer is looked up in the declarations_fts
// trigram index (d1/historical-declarations/search-index.sql). A trigram
// index cannot match fewer than three characters, so shorter text (such as
// "3M") falls back to a LIKE scan of the table.
const SEARCH_INDEX_MIN_LENGTH = 3;

// Part of every edge-cache key. Bump it after loading a new dataset so the
// next deploy stops serving answers cached from the old one.
const CACHE_VERSION = '1';
const EDGE_CACHE_HEADER = 'X-Declarations-Cache';

function jsonResponse(data, { status = 200, cacheSeconds } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (cacheSeconds) {
    // The Cloudflare edge caches for the full window (s-maxage), but browsers
    // must revalidate on every request (max-age=0). A shared browser max-age
    // here makes a dataset swap invisible to anyone who loaded the page before
    // it -- for /metadata that stale window was 24 hours.
    headers['Cache-Control'] = `public, max-age=0, must-revalidate, s-maxage=${cacheSeconds}`;
  }
  return new Response(JSON.stringify(data), { status, headers });
}

function parseIntOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

/**
 * Answers from Cloudflare's edge cache when it can, and stores successful
 * answers there. A Response a Worker builds is never cached at the edge just
 * because it has a Cache-Control header, so without this every visit queried
 * D1. The stored copy keeps the edge lifetime in max-age; the copy sent to the
 * browser keeps the original header (browsers revalidate every time).
 */
async function withEdgeCache(request, ctx, build) {
  const cache = globalThis.caches?.default;
  if (!cache) return build();

  const keyUrl = new URL(request.url);
  keyUrl.searchParams.sort();
  keyUrl.searchParams.set('_v', CACHE_VERSION);
  const key = new Request(keyUrl.toString(), { method: 'GET' });

  const hit = await cache.match(key);
  if (hit) {
    const headers = new Headers(hit.headers);
    headers.set('Cache-Control', hit.headers.get('X-Browser-Cache-Control') ?? 'no-store');
    headers.delete('X-Browser-Cache-Control');
    headers.set(EDGE_CACHE_HEADER, 'HIT');
    return new Response(hit.body, { status: hit.status, headers });
  }

  const response = await build();
  const browserCacheControl = response.headers.get('Cache-Control') ?? '';
  const edgeSeconds = /s-maxage=(\d+)/.exec(browserCacheControl)?.[1];
  if (response.status !== 200 || !edgeSeconds) return response;

  const body = await response.text();
  const stored = new Headers(response.headers);
  stored.set('Cache-Control', `public, max-age=${edgeSeconds}`);
  stored.set('X-Browser-Cache-Control', browserCacheControl);
  const store = cache.put(key, new Response(body, { status: 200, headers: stored }));
  if (ctx?.waitUntil) ctx.waitUntil(store); else await store;

  const headers = new Headers(response.headers);
  headers.set(EDGE_CACHE_HEADER, 'MISS');
  return new Response(body, { status: 200, headers });
}

function isMissingSearchIndex(error) {
  return /no such table: declarations_fts/i.test(String(error?.message ?? error));
}

async function handleMetadata(env) {
  const [years, countries, currencies, natures] = await Promise.all([
    env.DB.prepare('SELECT DISTINCT year FROM declarations ORDER BY year DESC').all(),
    env.DB.prepare('SELECT DISTINCT name, iso_code FROM countries ORDER BY name ASC').all(),
    env.DB.prepare('SELECT DISTINCT code FROM currencies ORDER BY code ASC').all(),
    env.DB.prepare('SELECT DISTINCT nature, nature_label FROM declarations ORDER BY nature_label ASC').all(),
  ]);

  return jsonResponse({
    years: years.results.map((r) => r.year),
    countries: countries.results,
    currencies: currencies.results.map((r) => r.code),
    natures: natures.results,
  }, { cacheSeconds: 86400 });
}

async function handleSearch(url, env) {
  const q = url.searchParams.get('q')?.trim();
  const year = parseIntOrNull(url.searchParams.get('year'));
  const country = url.searchParams.get('country');
  const companyCountry = url.searchParams.get('company_country');
  const nature = url.searchParams.get('nature');
  const currency = url.searchParams.get('currency');

  // Anti-scraping: no bare "browse everything" mode. A real search or filter
  // is required to return any results.
  const hasFilter = Boolean(q || year || country || companyCountry || nature || currency);
  if (!hasFilter) {
    return jsonResponse({
      error: 'At least one search term or filter is required.',
      results: [],
      total: 0,
    }, { status: 400 });
  }

  const pageNum = Math.max(parseIntOrNull(url.searchParams.get('page')) ?? 1, 1);
  // Clamp both ends: SQLite treats a negative LIMIT as "no limit".
  const limitNum = Math.min(
    Math.max(parseIntOrNull(url.searchParams.get('limit')) ?? PAGE_SIZE_DEFAULT, 1),
    PAGE_SIZE_MAX,
  );
  const offset = (pageNum - 1) * limitNum;

  // Anti-scraping: cap total accessible offset per query. Narrower filters
  // are required to reach records beyond this window.
  if (offset >= MAX_ACCESSIBLE_RECORDS) {
    return jsonResponse({
      error: 'Pagination limit reached. Please use filters to narrow your search results.',
      results: [],
      total: 0,
    }, { status: 403 });
  }

  const filters = { q, year, country, companyCountry, nature, currency };
  const useIndex = Boolean(q) && Array.from(q).length >= SEARCH_INDEX_MIN_LENGTH;

  let page;
  try {
    page = await runSearch(env, filters, { useIndex, limitNum, offset });
  } catch (error) {
    // The trigram index is created by a separate script after the data is
    // loaded; until it exists, search the table as before.
    if (!useIndex || !isMissingSearchIndex(error)) throw error;
    page = await runSearch(env, filters, { useIndex: false, limitNum, offset });
  }
  const { results, total } = page;

  return jsonResponse({
    results,
    total: Math.min(total, MAX_ACCESSIBLE_RECORDS),
    page: pageNum,
    limit: limitNum,
    note: total > MAX_ACCESSIBLE_RECORDS
      ? 'Results capped for security. Use filters to narrow your search.'
      : undefined,
  }, { cacheSeconds: 3600 });
}

function buildWhere({ q, year, country, companyCountry, nature, currency }, { useIndex }) {
  let where = ' WHERE 1=1';
  const params = [];

  if (q && useIndex) {
    // One FTS5 phrase: with the trigram tokenizer it matches the text anywhere
    // in either name, ignoring case, like the LIKE below. Double quotes are
    // escaped by doubling; nothing else in the text is query syntax.
    where += ' AND rowid IN (SELECT rowid FROM declarations_fts WHERE declarations_fts MATCH ?)';
    params.push(`"${q.replace(/"/g, '""')}"`);
  } else if (q) {
    // Match the search text literally. "%" and "_" are LIKE wildcards, so a bare
    // "%" would otherwise count as a filter and match every row.
    const pattern = `%${q.replace(/[!%_]/g, '!$&')}%`;
    where += " AND (company_name LIKE ? ESCAPE '!' OR beneficiary_name LIKE ? ESCAPE '!')";
    params.push(pattern, pattern);
  }
  if (year) {
    where += ' AND year = ?';
    params.push(year);
  }
  if (country) {
    where += ' AND beneficiary_country_code = ?';
    params.push(country);
  }
  if (companyCountry) {
    where += ' AND (company_country_code = ? OR company_id IN (SELECT id FROM companies WHERE country_code = ?))';
    params.push(companyCountry, companyCountry);
  }
  if (nature) {
    where += ' AND nature = ?';
    params.push(nature);
  }
  if (currency) {
    where += ' AND currency_code = ?';
    params.push(currency);
  }

  return { where, params };
}

async function runSearch(env, filters, { useIndex, limitNum, offset }) {
  const { where, params } = buildWhere(filters, { useIndex });

  // Only "more than MAX_ACCESSIBLE_RECORDS" is ever reported, so stop
  // counting one row past it instead of counting every match.
  const countQuery = `SELECT COUNT(*) AS total FROM (SELECT 1 FROM declarations${where} LIMIT ${MAX_ACCESSIBLE_RECORDS + 1})`;
  const totalResult = await env.DB.prepare(countQuery).bind(...params).first();

  const pageQuery = `SELECT * FROM declarations${where} ORDER BY year DESC, company_name ASC, id ASC LIMIT ? OFFSET ?`;
  const { results } = await env.DB.prepare(pageQuery).bind(...params, limitNum, offset).all();

  return { results, total: totalResult?.total ?? 0 };
}

async function handleDetail(id, env) {
  const declaration = await env.DB.prepare(`
    SELECT
      d.*,
      c.unique_identifier AS company_ui,
      c.postal_code AS company_zip,
      c.contact_url,
      c.parent_name AS company_parent_name,
      b.unique_identifier AS beneficiary_ui,
      b.address AS beneficiary_address,
      b.city AS beneficiary_city
    FROM declarations d
    JOIN companies c ON c.id = d.company_id
    JOIN beneficiaries b ON b.id = d.beneficiary_id
    WHERE d.id = ?
  `).bind(id).first();

  if (!declaration) {
    return jsonResponse({ error: 'Declaration not found' }, { status: 404 });
  }

  return jsonResponse(declaration, { cacheSeconds: 604800 });
}

/**
 * Routes GET requests under /api/historical-declarations/*.
 * Must be called before the static-asset SPA fallback in server.js, since
 * that fallback would otherwise serve index.html for any dotless path.
 */
export async function handleHistoricalDeclarationsRequest(request, env, ctx) {
  if (request.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed' }, { status: 405 });
  }

  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\/historical-declarations\/?/, '');

  if (path === 'metadata') {
    return withEdgeCache(request, ctx, () => handleMetadata(env));
  }
  if (path === 'search') {
    return withEdgeCache(request, ctx, () => handleSearch(url, env));
  }
  if (path) {
    let id;
    try {
      id = decodeURIComponent(path);
    } catch {
      // Malformed percent-encoding cannot name a real declaration.
      return jsonResponse({ error: 'Declaration not found' }, { status: 404 });
    }
    return withEdgeCache(request, ctx, () => handleDetail(id, env));
  }

  return jsonResponse({ error: 'Not found' }, { status: 404 });
}
