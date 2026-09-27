import React, { useEffect, useRef } from 'react';
import CvsEventLookup, { CvsSelectedEvent } from './CvsEventLookup';
import { TreeResultCard } from './TreeResultCard';
import { useCvsLookup } from '../hooks/useCvsLookup';
import { getTreeCvsMessage, getTreeCvsOutcome } from '../utils/treeCvs';

// A decision-tree answer that depends on the Event's live CVS status. The card starts with the
// result's outcome and changes with the status of the Event found below it; what that status
// means is added under the answer's text. The search runs through this app's Worker
// (cvs-api.js); the texts are the tree's "cvsCheck" in treeData.json.
export function TreeCvsCheck({ node, cvsCheck, onOpenReference }) {
  const lookup = useCvsLookup();
  const cardRef = useRef(null);
  const statusLabel = lookup.busy === 'status' ? null : lookup.status?.status?.raw;
  const message = getTreeCvsMessage(cvsCheck, node.cvsCheck, {
    status: statusLabel,
    noMatch: lookup.search?.results?.length === 0,
  });
  const outcome = getTreeCvsOutcome(node.cvsCheck, message?.tone, node.outcome);

  // The Event is chosen from up to 50 search results below the card: when a status arrives,
  // scroll back to the card's outcome if it is out of view.
  const retrievedAt = lookup.status?.retrievedAt;
  useEffect(() => {
    const card = cardRef.current;
    if (!statusLabel || !card) return;
    const view = card.closest('main')?.getBoundingClientRect() || { top: 0, bottom: window.innerHeight };
    const { top } = card.getBoundingClientRect();
    if (top < view.top || top > view.bottom - 80) card.scrollIntoView({ block: 'start' });
  }, [statusLabel, retrievedAt]);

  const settings = cvsCheck?.[node.cvsCheck];
  return (
    <>
      <TreeResultCard
        cardRef={cardRef}
        outcome={outcome}
        text={node.text}
        reference={node.reference}
        onOpenReference={onOpenReference}
      >
        <div aria-live="polite" aria-atomic="true">
          {message && <p className="mb-4 leading-relaxed">{message.text}</p>}
        </div>
        <CvsSelectedEvent lookup={lookup} compact />
      </TreeResultCard>

      {settings && (
        <section aria-label={cvsCheck.title} className="no-print mb-6">
          <h2 className="text-base font-bold text-gray-900">{cvsCheck.title}</h2>
          <p className="mt-2 text-sm leading-relaxed text-gray-600">{settings.intro}</p>
          <CvsEventLookup lookup={lookup} showSelected={false} />
        </section>
      )}
    </>
  );
}
