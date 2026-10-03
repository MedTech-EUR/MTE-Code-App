/**
 * Cloudflare Worker entry point for MTE Code App.
 * Handles the Decap CMS OAuth flow, the Historical Declarations API, and
 * serves the React app as static assets.
 *
 * Security: Uses HMAC-signed state tokens for CSRF protection,
 * no-cache headers on token responses, and generic error messages.
 * The GitHub token is sent only to an allowed origin, and every response
 * carries the headers in security-headers.js.
 */

import { handleHistoricalDeclarationsRequest } from './historical-declarations-api.js';
import { handleCvsRequest } from './cvs-api.js';
import { withSecurityHeaders } from './security-headers.js';

// The repository is public, so the CMS needs only `public_repo`. A token
// with `repo` would also open every private repository of the editor.
const DEFAULT_OAUTH_SCOPE = 'public_repo';

/**
 * Origins allowed to receive the GitHub token: this Worker's own origin (the
 * CMS at /admin/ signs in here) plus any listed in ALLOWED_ORIGINS
 * (comma-separated), such as the other of the apex and www hosts.
 */
function allowedOrigins(url, env) {
  const extra = (env.ALLOWED_ORIGINS || '').split(',').map((origin) => origin.trim()).filter(Boolean);
  return [...new Set([url.origin, ...extra])];
}

// JSON that is safe inside an inline <script>: "<" cannot close the element.
function scriptJson(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

/**
 * The page GitHub's callback leaves in the Decap CMS sign-in popup. Decap's
 * handshake: the popup announces itself to its opener, the CMS window answers,
 * and the popup sends the token to the window that answered. The answer must
 * come from the opener at an allowed origin, so a page elsewhere that opens
 * this popup cannot receive the token.
 */
function renderCallbackPage(token, origins) {
  const message = `authorization:github:success:${JSON.stringify({ token, provider: 'github' })}`;
  return `<!doctype html>
<html>
<head><title>Authorizing...</title></head>
<body>
  <script>
    (function() {
      var allowedOrigins = ${scriptJson(origins)};
      var message = ${scriptJson(message)};
      function receiveMessage(e) {
        if (!window.opener || e.source !== window.opener || allowedOrigins.indexOf(e.origin) === -1) return;
        window.removeEventListener("message", receiveMessage, false);
        window.opener.postMessage(message, e.origin);
      }
      window.addEventListener("message", receiveMessage, false);
      // The handshake carries no secret, so it may go to any origin: the popup
      // cannot read its opener's origin after GitHub's redirect chain.
      if (window.opener) {
        window.opener.postMessage("authorizing:github", "*");
      }
    })();
  </script>
</body>
</html>`;
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

const app = {
  async fetch(request, env) {
    const url = new URL(request.url);

    // 1. Handle OAuth Initiation: /api/auth
    if (url.pathname === '/api/auth') {
      const clientId = env.GITHUB_CLIENT_ID;

      if (!clientId) {
        return new Response('OAuth configuration error.', { status: 500 });
      }

      const state = await generateState(env.GITHUB_CLIENT_SECRET);

      const redirectUrl = new URL('https://github.com/login/oauth/authorize');
      redirectUrl.searchParams.set('client_id', clientId);
      redirectUrl.searchParams.set('scope', env.GITHUB_OAUTH_SCOPE || DEFAULT_OAUTH_SCOPE);
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
        const html = renderCallbackPage(tokenData.access_token, allowedOrigins(url, env));

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
    // Ensure the Decap CMS admin interface is served correctly
    if (url.pathname === '/admin' || url.pathname === '/admin/') {
      return env.ASSETS.fetch(new Request(new URL('/admin/index.html', request.url), request));
    }

    // For any other SPA route, serve the app shell. Request "/" rather than
    // "/index.html": the assets binding answers /index.html with a 307 to "/",
    // which would send every deep link to the home page.
    let assetReq = request;
    if (!url.pathname.includes('.')) {
      assetReq = new Request(new URL('/', request.url), request);
    }

    return env.ASSETS.fetch(assetReq);
  },
};

export default {
  async fetch(request, env) {
    const response = await app.fetch(request, env);
    return withSecurityHeaders(response, new URL(request.url).pathname);
  },
};
