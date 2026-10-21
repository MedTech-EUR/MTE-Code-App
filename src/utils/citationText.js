// The text that a reader section's or Q&A's Cite/Link and Copy Text actions put on the clipboard.
import { htmlToPlainText } from './htmlTextUtils.js';

const collapseSpaces = (text) => text.replace(/\s+/g, ' ').trim();

/**
 * The printed "Q&A N" of a Q&A: its label (Transparency publications), or the number its question
 * opens with (the Code: "Q&A 31: Can …"). Empty if it has neither.
 */
export const getQaNumberLabel = (qa) => {
  if (qa?.label) return collapseSpaces(qa.label);
  const match = collapseSpaces(htmlToPlainText(qa?.q)).match(/^Q&A\s+\d+/i);
  return match ? match[0] : '';
};

/** A Q&A's title in bookmarks and citations, e.g. "Ch 4 - 3. Educational Grants, Q&A 31". */
export const buildQaTitle = (sectionTitle, qa) => `${sectionTitle}, ${getQaNumberLabel(qa) || 'Q&A'}`;

/**
 * One Q&A as Copy Text gives it. `question` and `answer` are plain text. A question that already
 * opens with "Q:" or with its "Q&A N" number gets no extra "Q: ".
 */
export const formatQaPlainText = ({ label = '', question, answer }) => {
  const questionPrefix = /^(Q:|Q&A\s+\d+)/i.test(question) ? '' : 'Q: ';
  const answerPrefix = /^A:/i.test(answer) ? '' : 'A: ';
  return `${label ? `${label}\n` : ''}${questionPrefix}${question}\n${answerPrefix}${answer}\n`;
};

/** A citation in one of the Cite/Link menu's formats: 'formal', 'markdown' or 'url'. */
export const formatCitation = (format, { sourceTitle, markdownLabel, title, url, date = new Date() }) => {
  if (format === 'formal') {
    const accessed = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    return `${sourceTitle}, ${title}. (Accessed ${accessed}). Available at: ${url}`;
  }
  if (format === 'markdown') return `[${title} - ${markdownLabel}](${url})`;
  return url;
};

export const CITATION_COPIED_MESSAGES = Object.freeze({
  formal: 'Formal citation copied!',
  markdown: 'Markdown link copied!',
  url: 'Direct link copied!',
});
