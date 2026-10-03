/**
 * Historical Declarations API — read-only D1-backed query handlers for the
 * Transparency section's declarations registry. Called from server.js before
 * the static-asset SPA fallback.
 */

const PAGE_SIZE_DEFAULT = 50;
const PAGE_SIZE_MAX = 100;
const MAX_ACCESSIBLE_RECORDS = 1000;

/**
 * The oldest reporting year still public. Companies publish a year's declarations by
 * 31 August of the following year, and each year stays public for three years after that
 * deadline (the Disclosure Guidelines' minimum): 2023 until 31 August 2027.
 */
export function oldestPublicYear(now = new Date()) {
  const year = now.getUTCFullYear();
  const afterAugust = now.getUTCMonth() > 7;
  return afterAugust ? year - 3 : year - 4;
}

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

async function handleMetadata(env, minYear) {
  const [years, countries, currencies, natures] = await Promise.all([
    env.DB.prepare('SELECT DISTINCT year FROM declarations WHERE year >= ? ORDER BY year DESC').bind(minYear).all(),
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

async function handleSearch(url, env, minYear) {
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

  let query = 'SELECT * FROM declarations WHERE year >= ?';
  const params = [minYear];

  if (q) {
    // Match the search text literally. "%" and "_" are LIKE wildcards, so a bare
    // "%" would otherwise count as a filter and match every row.
    const pattern = `%${q.replace(/[!%_]/g, '!$&')}%`;
    query += " AND (company_name LIKE ? ESCAPE '!' OR beneficiary_name LIKE ? ESCAPE '!')";
    params.push(pattern, pattern);
  }
  if (year) {
    query += ' AND year = ?';
    params.push(year);
  }
  if (country) {
    query += ' AND beneficiary_country_code = ?';
    params.push(country);
  }
  if (companyCountry) {
    query += ' AND (company_country_code = ? OR company_id IN (SELECT id FROM companies WHERE country_code = ?))';
    params.push(companyCountry, companyCountry);
  }
  if (nature) {
    query += ' AND nature = ?';
    params.push(nature);
  }
  if (currency) {
    query += ' AND currency_code = ?';
    params.push(currency);
  }

  const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total');
  const totalResult = await env.DB.prepare(countQuery).bind(...params).first();

  query += ' ORDER BY year DESC, company_name ASC LIMIT ? OFFSET ?';
  params.push(limitNum, offset);

  const { results } = await env.DB.prepare(query).bind(...params).all();
  const total = totalResult?.total ?? 0;

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

async function handleDetail(id, env, minYear) {
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
    WHERE d.id = ? AND d.year >= ?
  `).bind(id, minYear).first();

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
export async function handleHistoricalDeclarationsRequest(request, env, now = new Date()) {
  if (request.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed' }, { status: 405 });
  }

  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\/historical-declarations\/?/, '');
  const minYear = oldestPublicYear(now);

  if (path === 'metadata') {
    return handleMetadata(env, minYear);
  }
  if (path === 'search') {
    return handleSearch(url, env, minYear);
  }
  if (path) {
    let id;
    try {
      id = decodeURIComponent(path);
    } catch {
      // Malformed percent-encoding cannot name a real declaration.
      return jsonResponse({ error: 'Declaration not found' }, { status: 404 });
    }
    return handleDetail(id, env, minYear);
  }

  return jsonResponse({ error: 'Not found' }, { status: 404 });
}
