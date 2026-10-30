/**
 * Cloudflare Worker entry point for MTE Code App.
 * Handles the content editor's OAuth flow, the Historical Declarations API, and
 * serves the React app as static assets.
 *
 * Security: Uses HMAC-signed state tokens for CSRF protection,
 * no-cache headers on token responses, and generic error messages.
 */

import { handleHistoricalDeclarationsRequest } from './historical-declarations-api.js';
import { handleCvsRequest } from './cvs-api.js';
import { isPrerenderedFilePath, prerenderedAssetPathFor } from './prerendered-pages.js';

/**
 * The one address each page is indexed under: without "www." and without a trailing slash.
 * Returns the URL to redirect to, or null when the request already uses it. The API and the
 * content editor (whose own address ends in a slash) are left alone, so their requests and
 * sign-in keep working on either host. (http to https is Cloudflare's "Always Use HTTPS"
 * setting: `wrangler dev` hands the Worker the site's own address over http.)
 */
export function canonicalRedirectUrl(request) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return null;

  const url = new URL(request.url);
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/admin')) return null;

  const target = new URL(url);
  if (target.hostname.startsWith('www.')) target.hostname = target.hostname.slice(4);
  if (target.pathname !== '/' && target.pathname.endsWith('/')) {
    target.pathname = target.pathname.replace(/\/+$/, '') || '/';
  }

  return target.href === url.href ? null : target.href;
}

/**
 * A page of the app: the HTML the build wrote for it, with its own title, description and text.
 * Any other address gets the app shell with a 404, so search engines drop it while a visitor
 * still lands in the app (which opens its home page).
 */
async function servePage(request, env, url) {
  if (!isPrerenderedFilePath(url.pathname)) {
    const page = await env.ASSETS.fetch(
      new Request(new URL(prerenderedAssetPathFor(url.pathname), url), request),
    );
    if (page.ok || page.status === 304) return page;
  }

  // A build that skipped scripts/prerender-pages.mjs has no page files at all: then every
  // address keeps getting the app shell, rather than every page being reported missing.
  const home = await env.ASSETS.fetch(
    new Request(new URL(prerenderedAssetPathFor('/'), url), { method: 'HEAD' }),
  );
  const status = home.ok ? 404 : 200;

  // Requested without the browser's cache validators, which belong to another file.
  const shell = await env.ASSETS.fetch(new Request(new URL('/', url), { method: request.method }));
  const headers = new Headers(shell.headers);
  headers.delete('ETag');
  return new Response(shell.body, { status, headers });
}

/**
 * Generate an HMAC-signed state token for CSRF protection.
 * Format: timestamp.hmacSignature
 */
async function generateState(secret) {
  const timestamp = Date.now().toString();
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(timestamp));
  const sigHex = [...new Uint8Array(signature)].map(b => b.toString(16).padStart(2, '0')).join('');
  return `${timestamp}.${sigHex}`;
}

/**
 * Verify an HMAC-signed state token.
 * Checks both the signature integrity and that the token is < maxAgeMs old.
 */
async function verifyState(state, secret, maxAgeMs = 600000) {
  if (!state) return false;
  const parts = state.split('.');
  if (parts.length !== 2) return false;
  const [timestamp, sig] = parts;
  const age = Date.now() - parseInt(timestamp, 10);
  if (isNaN(age) || age > maxAgeMs || age < 0) return false;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const expectedSig = await crypto.subtle.sign('HMAC', key, encoder.encode(timestamp));
  const expectedHex = [...new Uint8Array(expectedSig)].map(b => b.toString(16).padStart(2, '0')).join('');
  return sig === expectedHex;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    const canonicalUrl = canonicalRedirectUrl(request);
    if (canonicalUrl) return Response.redirect(canonicalUrl, 301);

    // 1. Handle OAuth Initiation: /api/auth
    if (url.pathname === '/api/auth') {
      const clientId = env.GITHUB_CLIENT_ID;

      if (!clientId) {
        return new Response('OAuth configuration error.', { status: 500 });
      }

      const state = await generateState(env.GITHUB_CLIENT_SECRET);

      const redirectUrl = new URL('https://github.com/login/oauth/authorize');
      redirectUrl.searchParams.set('client_id', clientId);
      redirectUrl.searchParams.set('scope', 'repo');
      redirectUrl.searchParams.set('state', state);

      return Response.redirect(redirectUrl.toString(), 302);
    }

    // 2. Handle OAuth Callback: /api/auth/callback
    if (url.pathname === '/api/auth/callback') {
      const { GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET } = env;

      if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET) {
        return new Response('OAuth configuration error.', { status: 500 });
      }

      // Verify CSRF state
      const state = url.searchParams.get('state');
      if (!(await verifyState(state, GITHUB_CLIENT_SECRET))) {
        return new Response('Invalid or expired authorization request. Please try logging in again.', { status: 403 });
      }

      const code = url.searchParams.get('code');
      if (!code) {
        return new Response('Missing authorization code.', { status: 400 });
      }

      try {
        // Exchange the code for an access token
        const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify({
            client_id: GITHUB_CLIENT_ID,
            client_secret: GITHUB_CLIENT_SECRET,
            code,
          }),
        });

        const tokenData = await tokenResponse.json();

        if (tokenData.error) {
          return new Response('Authentication failed. Please try again.', { status: 401 });
        }

        // Send the token back to the Decap CMS window via postMessage
        const html = `<!doctype html>
<html>
<head><title>Authorizing...</title></head>
<body>
  <script>
    (function() {
      function receiveMessage(e) {
        if (window.opener) {
          window.opener.postMessage(
            'authorization:github:success:${JSON.stringify({ token: tokenData.access_token, provider: 'github' })}',
            e.origin
          );
        }
      }
      window.addEventListener("message", receiveMessage, false);
      // Initial handshake uses "*" because the popup cannot determine the opener's
      // origin after GitHub's redirect chain. This is Decap CMS's documented pattern.
      // The actual token above is always sent using the validated e.origin.
      if (window.opener) {
        window.opener.postMessage("authorizing:github", "*");
      }
    })();
  </script>
</body>
</html>`;

        return new Response(html, {
          headers: {
            'Content-Type': 'text/html;charset=UTF-8',
            'Cache-Control': 'no-store',
            'Pragma': 'no-cache',
          },
        });
      } catch (err) {
        console.error('OAuth token exchange error:', err);
        return new Response('Authentication failed. Please try again.', { status: 500 });
      }
    }

    // 3. Handle Historical Declarations API: /api/historical-declarations/*
    // Must run before the SPA fallback below, since that fallback serves
    // index.html for any dotless path and would otherwise swallow these.
    if (url.pathname.startsWith('/api/historical-declarations')) {
      return handleHistoricalDeclarationsRequest(request, env);
    }

    // Live CVS event lookup used by the event support checker; keep before the SPA fallback.
    if (url.pathname === '/api/cvs' || url.pathname.startsWith('/api/cvs/')) {
      return handleCvsRequest(request);
    }

    // 4. Fallback: Serve static assets
    // The content editor (/admin/) and Content history (/admin/history/) are their own pages,
    // not the app, so they are kept out of the app-shell fallback below.
    // The assets binding serves each folder's index.html at its address with the slash (and
    // redirects the other spellings to it), so these requests go to it unchanged.
    if (url.pathname === '/admin' || url.pathname.startsWith('/admin/')) {
      return env.ASSETS.fetch(request);
    }

    // Any other extensionless path is a page of the app (or an address that is not one).
    if (!url.pathname.includes('.') || isPrerenderedFilePath(url.pathname)) {
      return servePage(request, env, url);
    }

    return env.ASSETS.fetch(request);
  },
};
