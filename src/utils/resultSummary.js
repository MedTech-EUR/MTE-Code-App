/**
 * The plain text that "Copy summary" puts on the clipboard for a decision-tree result or an
 * event support answer, so a reader can keep it in an email or a compliance file.
 */

/**
 * Ends every summary. It is the first sentence of the TPPT Checker's disclaimer
 * (components/TPPTContent.tsx), reused so the summary adds no new legal wording.
 */
export const GUIDANCE_NOTE = 'This tool is intended as a helpful guide for preliminary assessment only and does not certify the official status of any event under the MedTech Europe Code.';

/** "17 November 2026". */
export function formatSummaryDate(date = new Date()) {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
}

const clean = (text) => String(text ?? '').replace(/\s+/g, ' ').trim();

/**
 * Lays a summary out as text. Each section has an optional heading and lines; a line is a
 * string, or { label, value } for "label: value", or { question, answer } for a numbered answer.
 * Empty lines and sections are left out.
 */
export function buildResultSummary({ title, date = new Date(), sections = [], url = '' }) {
  const blocks = [[clean(title), `The Code App · ${formatSummaryDate(date)}`].join('\n')];
  for (const section of sections) {
    let number = 0;
    const lines = (section.lines || []).map((line) => {
      if (line && typeof line === 'object' && 'question' in line) {
        number += 1;
        return `${number}. ${clean(line.question)}\n   ${clean(line.answer)}`;
      }
      if (line && typeof line === 'object' && 'label' in line) {
        const value = clean(line.value);
        return value ? `${clean(line.label)}: ${value}` : '';
      }
      return clean(line);
    }).filter(Boolean);
    if (lines.length === 0) continue;
    blocks.push([section.heading ? clean(section.heading) : '', ...lines].filter(Boolean).join('\n'));
  }
  if (url) blocks.push(url);
  blocks.push(GUIDANCE_NOTE);
  return `${blocks.join('\n\n')}\n`;
}

/** A decision tree's result: the answers given, the outcome, its text and reference. */
export function buildTreeSummary({ title, steps = [], outcomeLabel, text, reference, url, date }) {
  return buildResultSummary({
    title,
    date,
    url,
    sections: [
      { heading: 'Your answers', lines: steps.map(({ question, answer }) => ({ question, answer })) },
      { lines: [{ label: 'Result', value: outcomeLabel }, text, { label: 'Reference', value: reference }] },
    ],
  });
}
