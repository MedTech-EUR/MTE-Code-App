/**
 * Cloudflare Worker entry point for MTE Code App.
 * Serves the Historical Declarations API, the CVS lookup and the React app
 * as static assets. Every response carries the headers in security-headers.js.
 */

import { handleHistoricalDeclarationsRequest } from './historical-declarations-api.js';
import { handleCvsRequest } from './cvs-api.js';
import { withSecurityHeaders } from './security-headers.js';

const app = {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Historical Declarations API: /api/historical-declarations/*
    // Must run before the SPA fallback below, since that fallback serves
    // index.html for any dotless path and would otherwise swallow these.
    if (url.pathname.startsWith('/api/historical-declarations')) {
      return handleHistoricalDeclarationsRequest(request, env);
    }

    // Live CVS event lookup used by the event support checker; keep before the SPA fallback.
    if (url.pathname === '/api/cvs' || url.pathname.startsWith('/api/cvs/')) {
      return handleCvsRequest(request);
    }

    // Serve static files, and the app shell for any other route. Request "/" rather than
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
    return withSecurityHeaders(await app.fetch(request, env));
  },
};
