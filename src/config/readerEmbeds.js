// Interactive versions of figures in the reader text.
//
// A figure in a section's text can name one: <figure data-reader-embed="geographic-area-map">.
// The reader then shows that component above the section's text, in place of the figure. The
// figure itself stays in the text: it is what prints, what the page shows until the component
// has loaded (or if it cannot load), and what the content editor and search engines see.
// Each component is loaded only when a section that names it is shown.
export const READER_EMBEDS = {
  'geographic-area-map': () => import('../components/GeographicAreaMap'),
};

// The name of the interactive figure in a section's text, if it has one this app knows.
export function findReaderEmbed(html) {
  const name = /\sdata-reader-embed="([a-z0-9-]+)"/.exec(html || '')?.[1];
  return name && Object.hasOwn(READER_EMBEDS, name) ? name : null;
}

// Added to the section's text while its interactive figure shows: the figure in the text is
// hidden on screen and still printed.
export const READER_EMBED_SHOWN = '[&_[data-reader-embed]]:hidden print:[&_[data-reader-embed]]:block';
