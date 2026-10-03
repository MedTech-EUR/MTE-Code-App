/**
 * Standalone OAuth proxy for Decap CMS.
 * Deployed as a separate Cloudflare Worker to handle GitHub authentication.
 *
 * Security: Uses HMAC-signed state tokens for CSRF protection,
 * restricted CORS, and no-cache headers on token responses. The GitHub token
 * is sent only to the CMS origins below.
 */

// Where the CMS runs. ALLOWED_ORIGINS (comma-separated) replaces this list,
// for example to add a test deployment.
const DEFAULT_ALLOWED_ORIGINS = [
  'https://medtecheurope-code.org',
  'https://www.medtecheurope-code.org',
];

// The repository is public, so the CMS needs only `public_repo`. A token
// with `repo` would also open every private repository of the editor.
const DEFAULT_OAUTH_SCOPE = 'public_repo';

function allowedOrigins(env) {
  const configured = (env.ALLOWED_ORIGINS || '').split(',').map((origin) => origin.trim()).filter(Boolean);
  return configured.length ? configured : DEFAULT_ALLOWED_ORIGINS;
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
<html><head><title>Authorizing...</title></head>
<body>
<script>
(function() {
  var allowedOrigins = ${scriptJson(origins)};
  var message = ${scriptJson(message)};
  function sendMsg(e) {
    if (!window.opener || e.source !== window.opener || allowedOrigins.indexOf(e.origin) === -1) return;
    window.removeEventListener("message", sendMsg, false);
    window.opener.postMessage(message, e.origin);
  }
  window.addEventListener("message", sendMsg, false);
  // The handshake carries no secret, so it may go to any origin: the popup
  // cannot read its opener's origin after GitHub's redirect chain.
  if (window.opener) {
    window.opener.postMessage("authorizing:github", "*");
  }
})();
</script>
</body></html>`;
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

    // CORS only for the CMS origins
    const origins = allowedOrigins(env);
    const requestOrigin = request.headers.get('Origin');
    const corsHeaders = {
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Vary': 'Origin',
    };
    if (requestOrigin && origins.includes(requestOrigin)) {
      corsHeaders['Access-Control-Allow-Origin'] = requestOrigin;
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // OAuth Initiation
    if (url.pathname === '/auth' || url.pathname === '/') {
      const clientId = env.GITHUB_CLIENT_ID;
      if (!clientId) {
        return new Response('OAuth configuration error.', { status: 500, headers: corsHeaders });
      }

      const state = await generateState(env.GITHUB_CLIENT_SECRET);

      const redirectUrl = new URL('https://github.com/login/oauth/authorize');
      redirectUrl.searchParams.set('client_id', clientId);
      redirectUrl.searchParams.set('scope', env.GITHUB_OAUTH_SCOPE || DEFAULT_OAUTH_SCOPE);
      redirectUrl.searchParams.set('state', state);

      return Response.redirect(redirectUrl.toString(), 302);
    }

    // OAuth Callback
    if (url.pathname === '/callback') {
      const { GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET } = env;
      if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET) {
        return new Response('OAuth configuration error.', { status: 500, headers: corsHeaders });
      }

      // Verify CSRF state
      const state = url.searchParams.get('state');
      if (!(await verifyState(state, GITHUB_CLIENT_SECRET))) {
        return new Response('Invalid or expired authorization request. Please try logging in again.', {
          status: 403, headers: corsHeaders,
        });
      }

      const code = url.searchParams.get('code');
      if (!code) {
        return new Response('Missing authorization code.', { status: 400, headers: corsHeaders });
      }

      try {
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
          return new Response('Authentication failed. Please try again.', {
            status: 401, headers: corsHeaders,
          });
        }

        // Send the token back to the Decap CMS window via postMessage
        const html = renderCallbackPage(tokenData.access_token, origins);

        return new Response(html, {
          headers: {
            ...corsHeaders,
            'Content-Type': 'text/html;charset=UTF-8',
            'Cache-Control': 'no-store',
            'Pragma': 'no-cache',
          },
        });
      } catch (err) {
        console.error('OAuth token exchange error:', err);
        return new Response('Authentication failed. Please try again.', { status: 500, headers: corsHeaders });
      }
    }

    return new Response('MTE OAuth Proxy — use /auth or /callback', { status: 200, headers: corsHeaders });
  },
};
