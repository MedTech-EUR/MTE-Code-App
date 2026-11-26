/**
 * The Code API: the text of the MedTech Europe Code (chapters, sections and Q&As) as JSON, for
 * anyone to read: Member Companies' own tools, ethicalmedtech.eu and any other site. It is
 * read-only and public, so every site may read it from the browser (CORS "*"), and no cookies
 * or credentials are involved.
 *
 * The answers are files the build writes (scripts/build-code-api.mjs, from the Code's chapter
 * files through scripts/lib/code-api.mjs); the Worker (server.js) only serves them at their
 * addresses with these headers. See docs/code-api.md.
 */

/** The address of version 1. A change that breaks existing readers gets a new version. */
export const CODE_API_PATH = '/api/code/v1';

/** The files the build writes under dist/ + CODE_API_PATH, by what they answer. */
export const CODE_API_FILES = Object.freeze({
  index: 'index.json',
  code: 'code.json',
  chapter: (chapterId) => `chapters/${chapterId}.json`,
});

const CHAPTER_PATH = /^\/api\/code\/v1\/chapters\/([a-z0-9][a-z0-9-]{0,63})$/;

// Successful answers may be kept for an hour; the ETag lets a reader check for a newer copy
// cheaply at any time.
const CACHE_CONTROL = 'public, max-age=3600';
const CORS_HEADERS = Object.freeze({
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Expose-Headers': 'ETag',
});
const CONDITIONAL_HEADERS = ['If-None-Match', 'If-Modified-Since'];

/**
 * The static-assets path of the file that answers an API address (a trailing slash is allowed),
 * or null when the address is not one of the API's.
 */
export function codeApiAssetPathFor(pathname) {
  const path = pathname.replace(/\/+$/, '');
  if (path === CODE_API_PATH) return `${CODE_API_PATH}/${CODE_API_FILES.index}`;
  if (path === `${CODE_API_PATH}/code`) return `${CODE_API_PATH}/${CODE_API_FILES.code}`;
  const chapter = CHAPTER_PATH.exec(path);
  return chapter ? `${CODE_API_PATH}/${CODE_API_FILES.chapter(chapter[1])}` : null;
}

function errorResponse(status, code, message, extraHeaders = {}) {
  return Response.json({ error: { code, message } }, {
    status,
    headers: { ...CORS_HEADERS, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...extraHeaders },
  });
}

export async function handleCodeApiRequest(request, env) {
  const url = new URL(request.url);
  const assetPath = codeApiAssetPathFor(url.pathname);
  if (!assetPath) {
    return errorResponse(404, 'NOT_FOUND', `Unknown Code API address. The list of addresses is at ${url.origin}${CODE_API_PATH}.`);
  }

  if (request.method === 'OPTIONS') {
    // A browser's question before a request that sends a header such as If-None-Match.
    return new Response(null, { status: 204, headers: {
      ...CORS_HEADERS,
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': CONDITIONAL_HEADERS.join(', '),
      'Access-Control-Max-Age': '86400',
    } });
  }
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return errorResponse(405, 'METHOD_NOT_ALLOWED', 'Use GET.', { Allow: 'GET, HEAD, OPTIONS' });
  }

  // Only the reader's cache validators are passed on, so an unchanged file is answered with 304.
  const headers = new Headers();
  for (const name of CONDITIONAL_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  const file = await env.ASSETS.fetch(new Request(new URL(assetPath, url), { method: request.method, headers }));

  if (file.status === 404) {
    return CHAPTER_PATH.test(url.pathname.replace(/\/+$/, ''))
      ? errorResponse(404, 'CHAPTER_NOT_FOUND', `No chapter has this ID. The chapters are listed at ${url.origin}${CODE_API_PATH}.`)
      : errorResponse(503, 'UNAVAILABLE', 'The Code API is not available right now.');
  }
  if (!file.ok && file.status !== 304) {
    return errorResponse(502, 'UNAVAILABLE', 'The Code API is not available right now.');
  }

  const responseHeaders = new Headers({
    ...CORS_HEADERS,
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': CACHE_CONTROL,
    'X-Content-Type-Options': 'nosniff',
  });
  for (const name of ['ETag', 'Last-Modified']) {
    const value = file.headers.get(name);
    if (value) responseHeaders.set(name, value);
  }
  return new Response(file.status === 304 ? null : file.body, { status: file.status, headers: responseHeaders });
}
