import { useEffect, useState } from 'react';
import { findReaderEmbed, READER_EMBEDS } from '../config/readerEmbeds';

// The interactive figure for a section's text (config/readerEmbeds.js), once it has loaded.
// Null until then, when the text names none, or when it cannot be loaded (offline before the
// first visit to the section): the figure in the text shows instead.
export function useReaderEmbed(html) {
  const name = findReaderEmbed(html);
  const [loaded, setLoaded] = useState(null);

  useEffect(() => {
    if (!name) return undefined;
    let current = true;
    READER_EMBEDS[name]()
      .then((module) => {
        if (current) setLoaded({ name, Component: module.default });
      })
      .catch(() => {});
    return () => {
      current = false;
    };
  }, [name]);

  return loaded && loaded.name === name ? loaded.Component : null;
}
