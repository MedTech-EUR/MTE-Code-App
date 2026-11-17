/** Helpers for the Glossary's filter box and A–Z bar (components/GlossaryIndex.jsx). */

const fold = (text) => String(text ?? '')
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .toLowerCase();

/** The letter a term is listed under: its first letter, without accents, in capitals. */
export function firstLetter(title) {
  const letter = fold(title).match(/[a-z]/)?.[0];
  return letter ? letter.toUpperCase() : '';
}

/**
 * Whether a term matches what was typed: every typed word appears in the term, in any order,
 * ignoring case and accents. "hcp" finds "Healthcare Professional (HCP)".
 */
export function matchesTerm(title, query) {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const term = fold(title);
  return words.every((word) => term.includes(word));
}
