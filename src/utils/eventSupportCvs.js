// Reads an Event's live CVS status. The status labels, and what each one means for the checker,
// are listed under "cvsStatuses" in src/data/eventSupportRules.json.

// Case, spacing and the kind of dash are ignored ("Not assessed – Out of scope" appears with an
// en dash in CVS training material and with a hyphen on the CVS site). Nothing else is.
export const normalizeCvsStatus = (value) => (typeof value === 'string'
  ? value.replace(/[‐-―−]/g, '-').trim().replace(/\s+/g, ' ').toLowerCase()
  : '');

/**
 * 'exempt' | 'positive' | 'negative' | 'not-pre-cleared' | 'not-assessed' | 'pre-cleared' |
 * 'pending' | 'unknown'
 */
export function classifyCvsStatus(data, raw) {
  const status = normalizeCvsStatus(raw);
  if (!status) return 'unknown';
  const listed = (labels) => labels.some((label) => normalizeCvsStatus(label) === status);
  const { exempt, positive, negative, notPreCleared, notAssessed, preCleared, pending } = data.cvsStatuses;
  if (listed(exempt)) return 'exempt';
  if (listed(positive)) return 'positive';
  if (listed(negative)) return 'negative';
  if (listed(notPreCleared)) return 'not-pre-cleared';
  if (listed(notAssessed)) return 'not-assessed';
  if (listed(preCleared)) return 'pre-cleared';
  if (listed(pending)) return 'pending';
  return 'unknown';
}

/**
 * When the company says a third-party Event is national (its Delegates from the Area are local
 * HCPs only, possibly with HCPs from outside the Area) but
 * the Event has a CVS record, the organiser or another Member Company may expect Delegates from
 * more than one country: warn, whatever the record's status, unless it is one of the two
 * "Not assessed" labels that confirm the Event is outside CVS scope. Events in Mecomed countries
 * are exempt, because Mecomed's CVS scope covers national Events too.
 */
export function getCvsScopeWarning(data, ctx, answers, evidence) {
  if (!ctx.thirdParty || ctx.virtual || !['local', 'other'].includes(answers.audience) || answers.eventArea === 'mecomed' || !evidence) return null;
  if (classifyCvsStatus(data, evidence.status?.raw) === 'exempt') return null;
  return {
    id: 'national-cvs-record',
    titleId: 'nationalRecordTitle',
    messageId: 'nationalRecord',
    noteId: 'nationalRecordNote',
    params: { status: evidence.status.raw },
  };
}
