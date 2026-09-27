// What a decision-tree result says about an Event's live CVS status. The texts are in the tree's
// "cvsCheck" in src/data/treeData.json, keyed by CVS's own status labels; a result node sets
// "cvsCheck" to the mode it needs.
import { normalizeCvsStatus } from './eventSupportCvs.js';

// 'required': the support needs a positive CVS decision. 'national': the user expects a
// national Event, so a CVS record is worth a warning.
export const TREE_CVS_MODES = Object.freeze(['required', 'national']);
export const TREE_CVS_TONES = Object.freeze(['positive', 'caution', 'negative']);

/**
 * The message for the Event found in CVS (`status`, its label as CVS shows it) or for a search
 * that found nothing (`noMatch`): { text, tone }, or null when there is nothing to say yet.
 */
export function getTreeCvsMessage(cvsCheck, mode, { status = null, noMatch = false } = {}) {
  const settings = cvsCheck?.[mode];
  if (!settings) return null;
  if (typeof status === 'string' && status.trim()) {
    const wanted = normalizeCvsStatus(status);
    const entry = settings.statuses?.find((item) => item.labels.some((label) => normalizeCvsStatus(label) === wanted));
    const text = entry ? entry.text : settings.otherStatus;
    return text ? { text: text.replaceAll('{status}', status.trim()), tone: entry?.tone || 'caution' } : null;
  }
  if (noMatch && settings.noMatch) return { text: settings.noMatch, tone: 'caution' };
  return null;
}

// The answer's outcome once the Event's status is known. Support that needs a positive CVS
// decision turns Compliant or Non-Compliant with a final decision and stays Conditional while one
// is pending; a national Event found in CVS turns Conditional.
const TREE_CVS_OUTCOMES = Object.freeze({
  required: Object.freeze({ positive: 'compliant', caution: 'conditional', negative: 'non-compliant' }),
  national: Object.freeze({ caution: 'conditional', negative: 'non-compliant' }),
});

/**
 * The outcome the answer card shows for a message's `tone` (from getTreeCvsMessage), or the
 * result's own `outcome` when there is no message or the tone does not change it.
 */
export function getTreeCvsOutcome(mode, tone, outcome) {
  return TREE_CVS_OUTCOMES[mode]?.[tone] || outcome;
}
