import { createCvsAdapter, readBoundedText } from './cvs-adapter.js';
import { CvsError } from './cvs-parser.js';

/**
 * Other MedTech Europe sites whose pages may use this lookup from the browser: ethicalmedtech.eu's
 * "CVS and e4ethics check" (which replaced this app's own Conference Vetting System check), on
 * its own address and on its Cloudflare Pages preview addresses. Any other site is refused, so
 * the lookup is not a public proxy for CVS.
 */
export const ALLOWED_ORIGINS = Object.freeze(['https://www.ethicalmedtech.eu', 'https://ethicalmedtech.eu']);
const ALLOWED_ORIGIN_PATTERN = /^https:\/\/(?:[a-z0-9-]+\.)?ethicalmedtech\.pages\.dev$/;

export function isAllowedOrigin(origin) {
  return typeof origin === 'string' && (ALLOWED_ORIGINS.includes(origin) || ALLOWED_ORIGIN_PATTERN.test(origin));
}

function json(data, status = 200, extraHeaders = {}) {
  return Response.json(data, { status, headers: {
    'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...extraHeaders,
  } });
}

export async function handleCvsRequest(request, adapter = createCvsAdapter()) {
  const url = new URL(request.url);
  const search = url.pathname === '/api/cvs/search';
  const detail = /^\/api\/cvs\/events\/(EMT-\d{2}-\d{5})$/.exec(url.pathname);
  if (!search && !detail) return json({ error: { code: 'NOT_FOUND', message: 'Unknown CVS endpoint.' } }, 404);
  const method = search ? 'POST' : 'GET';
  // This app itself, or a site on the list above: no public CORS proxy, and no browser cookies
  // are forwarded. A listed site's browser needs to be told it may read the answer.
  const origin = request.headers.get('origin');
  const listed = isAllowedOrigin(origin);
  const cors = listed ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : {};
  if (request.method === 'OPTIONS' && listed) {
    // The browser's question before a cross-site search: may it send this JSON request?
    return new Response(null, { status: 204, headers: { ...cors,
      'Access-Control-Allow-Methods': method, 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400',
    } });
  }
  if (request.method !== method) return json({ error: { code: 'METHOD_NOT_ALLOWED', message: `Use ${method}.` } }, 405, { Allow: method, ...cors });
  if (!listed && ((origin !== null && origin !== url.origin) || request.headers.get('sec-fetch-site') === 'cross-site')) {
    return json({ error: { code: 'INVALID_ORIGIN', message: 'Use the CVS lookup in this app.' } }, 403);
  }
  try {
    if (detail) return json(await adapter.getEventStatus(detail[1]), 200, cors);
    if (!/^application\/json\b/i.test(request.headers.get('content-type') || '')) {
      throw new CvsError('INVALID_REQUEST', 'Send a JSON search request.', 400);
    }
    let input;
    try { input = JSON.parse(await readBoundedText(request, 4096)); }
    catch { throw new CvsError('INVALID_REQUEST', 'The search request is invalid or too large.', 400); }
    return json(await adapter.searchEvents(input), 200, cors);
  } catch (error) {
    if (error instanceof CvsError) return json({ error: { code: error.code, message: error.message } }, error.httpStatus, cors);
    // Never leak upstream HTML, tokens, cookies, or exception details.
    return json({ error: { code: 'CVS_UNKNOWN', message: 'The CVS lookup could not be completed. Status is unknown.' } }, 502, cors);
  }
}
