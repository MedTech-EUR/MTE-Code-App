import React, { useId, useMemo, useState } from 'react';
import DOMPurify from 'dompurify';
import { AppIcon } from './AppIcons';
import { REFERENCE_INDEX } from '../data/referenceIndex';
import {
  describeReferenceTarget,
  getReferenceHref,
  getReferencePreviewHtml,
  isPlainLinkClick,
  resolveTreeReference,
} from '../utils/crossReferences';

const OUTCOME_STYLES = {
  'compliant':     { bg: 'bg-emerald-50',  border: 'border-emerald-200', text: 'text-emerald-800', icon: '✅', label: 'Compliant' },
  'non-compliant': { bg: 'bg-red-50',      border: 'border-red-200',     text: 'text-red-800',     icon: '❌', label: 'Non-Compliant' },
  'conditional':   { bg: 'bg-amber-50',    border: 'border-amber-200',   text: 'text-amber-800',   icon: '⚠️', label: 'Conditional' },
  'consult-legal': { bg: 'bg-blue-50',     border: 'border-blue-200',    text: 'text-blue-800',    icon: '⚖️', label: 'Consult Legal' },
  'not-required':  { bg: 'bg-teal-50',     border: 'border-teal-200',    text: 'text-teal-800',    icon: 'ℹ️', label: 'CVS Assessment Not Required' },
  'out-of-scope':  { bg: 'bg-purple-50',   border: 'border-purple-200',  text: 'text-purple-800',  icon: '➖', label: 'Out of Scope' },
  'not-applicable':{ bg: 'bg-purple-50',   border: 'border-purple-200',  text: 'text-purple-800',  icon: '➖', label: 'Not Applicable' },
  'prior-review':  { bg: 'bg-purple-50',   border: 'border-purple-200',  text: 'text-purple-800',  icon: '📋', label: 'Prior Review Required' },
  'in-scope':      { bg: 'bg-indigo-50',   border: 'border-indigo-200',  text: 'text-indigo-800',  icon: '🎯', label: 'In Scope of the Code' },
  'more-info':     { bg: 'bg-gray-50',     border: 'border-gray-300',    text: 'text-gray-800',    icon: '❔', label: 'More Information Needed' },
};

// The provision a result cites. It opens in place, so the tree keeps its answers, and links to
// the full text in the Code.
const ResultReference = ({ reference, onOpenReference }) => {
  const target = useMemo(() => resolveTreeReference(reference, REFERENCE_INDEX), [reference]);
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const preview = target ? describeReferenceTarget(target) : null;
  const previewHtml = getReferencePreviewHtml(preview);
  const previewMarkup = useMemo(
    () => ({ __html: DOMPurify.sanitize(previewHtml) }),
    [previewHtml],
  );

  return (
    <div className="bg-white/60 rounded-xl p-4 border border-white/80">
      <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Reference</p>
      {!target ? (
        <p className="text-sm text-gray-700">{reference}</p>
      ) : (
        <>
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-controls={panelId}
            className="inline-flex items-center gap-1 text-left text-sm font-medium text-gray-800 underline decoration-dotted underline-offset-4 hover:text-gray-950"
          >
            {reference}
            <AppIcon name={open ? 'ChevronUp' : 'ChevronDown'} size={14} className="shrink-0" />
          </button>
          {open && (
            <div id={panelId} className="mt-3 pt-3 border-t border-gray-200/80 animate-fade-in">
              <p className="text-xs font-semibold text-gray-500 mb-2">
                {[preview.location, preview.title].filter(Boolean).join(' › ')}
              </p>
              <div
                className="max-h-72 overflow-y-auto custom-scrollbar pr-1 text-sm leading-relaxed text-gray-700 space-y-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mt-1"
                dangerouslySetInnerHTML={previewMarkup}
              />
              <a
                href={getReferenceHref(target)}
                onClick={(event) => {
                  if (!onOpenReference || !isPlainLinkClick(event)) return;
                  event.preventDefault();
                  onOpenReference(target);
                }}
                className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-[#007A86] hover:text-[#7654A1]"
              >
                Open in the Code
                <AppIcon name="ArrowRight" size={12} />
              </a>
            </div>
          )}
        </>
      )}
    </div>
  );
};

// Shown under every answer: the trees apply the Code, but they are not its text, legal advice
// or a decision of the Conference Vetting System.
export const TREE_ANSWER_NOTE = 'This answer is a guide to the Code, not legal advice or a CVS decision. '
  + 'Check the Code’s text and, when in doubt, ask your compliance team.';

// A decision tree's answer: its outcome, its text, anything shown under the text (such as what
// the Event's CVS status means) and the provision it cites.
export const TreeResultCard = ({ outcome, text, reference, onOpenReference, cardRef, children }) => {
  const style = OUTCOME_STYLES[outcome] || OUTCOME_STYLES['conditional'];

  return (
    <div
      ref={cardRef}
      className={`rounded-2xl border-2 ${style.border} ${style.bg} p-8 mb-6 scroll-mt-4 transition-colors duration-300 motion-reduce:transition-none`}
    >
      <div className="flex items-center gap-3 mb-4">
        <span className="text-2xl">{style.icon}</span>
        <span className={`text-sm font-bold uppercase tracking-wider ${style.text}`}>
          {style.label}
        </span>
      </div>
      <p className={`text-lg font-semibold leading-relaxed mb-4 ${style.text}`}>
        {text}
      </p>

      {children && <div className={style.text}>{children}</div>}

      {reference && (
        <ResultReference reference={reference} onOpenReference={onOpenReference} />
      )}
      <p className={`mt-4 text-xs leading-relaxed opacity-90 ${style.text}`}>{TREE_ANSWER_NOTE}</p>
    </div>
  );
};
