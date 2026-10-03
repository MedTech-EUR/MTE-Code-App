/**
 * Security headers for the responses the Worker builds (the app shell for deep links, the APIs,
 * the OAuth endpoints). Cloudflare serves the static files itself and applies public/_headers
 * to them, not to Worker responses; tests/securityHeaders.test.mjs keeps the two in step.
 *
 * Only the CMS and its sign-in pages refuse to be framed by other sites; the public reader can
 * still be embedded.
 */
export const SECURITY_HEADERS = Object.freeze({
  'Strict-Transport-Security': 'max-age=31536000',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
});

export const NO_FRAMING_HEADERS = Object.freeze({
  'X-Frame-Options': 'SAMEORIGIN',
  'Content-Security-Policy': "frame-ancestors 'self'",
});

export function isNoFramingPath(pathname) {
  return pathname === '/admin' || pathname.startsWith('/admin/')
    || pathname === '/api/auth' || pathname.startsWith('/api/auth/');
}

export function withSecurityHeaders(response, pathname) {
  // Copy first: responses from fetch() and Response.redirect() have immutable headers.
  const secured = new Response(response.body, response);
  const headers = isNoFramingPath(pathname)
    ? { ...SECURITY_HEADERS, ...NO_FRAMING_HEADERS }
    : SECURITY_HEADERS;
  for (const [name, value] of Object.entries(headers)) secured.headers.set(name, value);
  return secured;
}
