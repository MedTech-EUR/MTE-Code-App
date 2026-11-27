import { SITE_ORIGIN } from './pageMeta.js';

export function liveEmbedPath(id, { includeQas = false, showVersion = true } = {}) {
  const params = new URLSearchParams();
  if (includeQas) params.set('qas', '1');
  if (!showVersion) params.set('version', '0');
  const query = params.toString();
  return '/api/code/v1/embed/' + encodeURIComponent(id) + (query ? '?' + query : '');
}

export function liveEmbedSnippet(id, options) {
  const src = (SITE_ORIGIN + liveEmbedPath(id, options)).replaceAll('&', '&amp;');
  return '<iframe src="' + src + '" title="Live excerpt from the MedTech Europe Code" width="100%" height="420" loading="lazy" style="border:0"></iframe>';
}
