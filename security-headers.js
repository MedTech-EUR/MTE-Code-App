/**
 * Security headers for the responses the Worker builds (the app shell for deep links and the
 * APIs). Cloudflare serves the static files itself and applies public/_headers to them, not to
 * Worker responses; tests/securityHeaders.test.mjs keeps the two in step.
 */
export const SECURITY_HEADERS = Object.freeze({
  'Strict-Transport-Security': 'max-age=31536000',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
});

export function withSecurityHeaders(response) {
  // Copy first: responses from fetch() and Response.redirect() have immutable headers.
  const secured = new Response(response.body, response);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) secured.headers.set(name, value);
  return secured;
}
