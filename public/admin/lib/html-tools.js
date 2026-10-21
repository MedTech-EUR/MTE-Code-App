/**
 * Small tools for the HTML stored in the Code's JSON (legalText, answers, summaries), shared by
 * the content editor (cms-fields.js), Content history and `npm run validate:data`.
 * No DOM is needed, so they also run in Node.
 */

/** Elements that never have a closing tag. */
const VOID_ELEMENTS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);

/** Elements that end a line of text, for htmlToText(). */
const BLOCK_ELEMENTS = new Set([
  'address', 'blockquote', 'dd', 'div', 'dl', 'dt', 'figcaption', 'figure', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'hr', 'li', 'ol', 'p', 'pre', 'section', 'table', 'tbody', 'td', 'tfoot', 'th', 'thead', 'tr', 'ul',
]);

// A tag: <name ...>, </name>, <name .../>. Attribute values may contain ">" inside quotes.
const TAG = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:\s+[^\s"'>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'>]+))?)*)\s*(\/?)>|<!--[\s\S]*?-->/g;

/** The line (1-based) of a character offset, for messages. */
const lineOf = (text, index) => text.slice(0, index).split('\n').length;

/**
 * Problems that would make the HTML render differently from what was intended: tags that are
 * never closed, closed without being opened, or closed in the wrong order. Returns
 * [{ message, line }], empty when the HTML is well formed.
 */
export function checkHtml(html) {
  const text = String(html ?? '');
  const problems = [];
  const open = [];
  let match;
  TAG.lastIndex = 0;
  while ((match = TAG.exec(text))) {
    if (match[0].startsWith('<!--')) continue;
    const [, closing, rawName, , selfClosing] = match;
    const name = rawName.toLowerCase();
    const line = lineOf(text, match.index);
    if (VOID_ELEMENTS.has(name)) {
      if (closing) problems.push({ message: `</${name}> is not needed: <${name}> has no closing tag.`, line });
      continue;
    }
    if (selfClosing) continue;
    if (!closing) {
      open.push({ name, line });
      continue;
    }
    const at = open.map((tag) => tag.name).lastIndexOf(name);
    if (at === -1) {
      problems.push({ message: `</${name}> closes a <${name}> that was never opened.`, line });
      continue;
    }
    for (const unclosed of open.splice(at).slice(1).reverse()) {
      problems.push({ message: `<${unclosed.name}> (line ${unclosed.line}) is not closed before </${name}>.`, line: unclosed.line });
    }
  }
  for (const unclosed of open) problems.push({ message: `<${unclosed.name}> (line ${unclosed.line}) is never closed.`, line: unclosed.line });
  // Stray "<" or ">" that are not part of a tag usually mean a damaged tag.
  const leftover = text.replace(TAG, '');
  const stray = leftover.search(/<[a-zA-Z/!]/);
  if (stray !== -1) problems.push({ message: 'There is an incomplete tag (a “<” that is never finished).', line: null });
  return problems;
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ldquo: '“', rdquo: '”', lsquo: '‘', rsquo: '’', ndash: '–', mdash: '—', hellip: '…', euro: '€', bull: '•' };

/** Decodes the character references used in the Code's HTML. */
export const decodeEntities = (text) =>
  text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, ref) => {
    if (ref[0] === '#') return String.fromCodePoint(ref[1].toLowerCase() === 'x' ? parseInt(ref.slice(2), 16) : parseInt(ref.slice(1), 10));
    return ENTITIES[ref.toLowerCase()] ?? whole;
  });

/**
 * The text a reader sees, one line per paragraph, list item or table row, for comparisons
 * people can read. Formatting (bold, links) is dropped; <br> starts a new line.
 */
export function htmlToText(html) {
  const text = String(html ?? '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(TAG, (tag, closing, name) => {
      const element = name?.toLowerCase();
      if (element === 'br') return '\n';
      if (element === 'li' && !closing) return '\n• ';
      if (element === 'td' || element === 'th') return closing ? ' | ' : '';
      return element && BLOCK_ELEMENTS.has(element) ? '\n' : '';
    });
  return decodeEntities(text)
    .split('\n')
    .map((line) => line.replace(/[ \t ]+/g, ' ').replace(/\s*\|\s*$/, '').trim())
    .filter(Boolean)
    .join('\n');
}
