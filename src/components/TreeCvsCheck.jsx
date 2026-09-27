import React, { useEffect, useRef } from 'react';
import CvsEventLookup from './CvsEventLookup';
import { useCvsLookup } from '../hooks/useCvsLookup';
import { getTreeCvsMessage } from '../utils/treeCvs';

const TONE_STYLES = {
  positive: 'border-teal-200 bg-teal-50 text-teal-950',
  caution: 'border-amber-200 bg-amber-50 text-amber-950',
  negative: 'border-red-200 bg-red-50 text-red-900',
};

// Under a decision-tree result: find the Event in CVS and say what its current status means for
// that result. The search runs through this app's Worker (cvs-api.js); the texts are the tree's
// "cvsCheck" in treeData.json.
export function TreeCvsCheck({ mode, cvsCheck }) {
  const lookup = useCvsLookup();
  const messageRef = useRef(null);
  const message = getTreeCvsMessage(cvsCheck, mode, {
    status: lookup.busy === 'status' ? null : lookup.status?.status?.raw,
    noMatch: lookup.search?.results?.length === 0,
  });
  // The message sits below up to 50 search results: bring it into view when it changes.
  useEffect(() => {
    if (message) messageRef.current?.scrollIntoView({ block: 'nearest' });
  }, [message?.text]); // eslint-disable-line react-hooks/exhaustive-deps

  const settings = cvsCheck?.[mode];
  if (!settings) return null;
  return (
    <section aria-label={cvsCheck.title} className="mb-6">
      <h2 className="text-base font-bold text-gray-900">{cvsCheck.title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-gray-600">{settings.intro}</p>
      <CvsEventLookup lookup={lookup} />
      {message && (
        <p ref={messageRef} role="status" className={`mt-4 rounded-xl border p-4 text-sm leading-relaxed ${TONE_STYLES[message.tone] || TONE_STYLES.caution}`}>
          {message.text}
        </p>
      )}
    </section>
  );
}
