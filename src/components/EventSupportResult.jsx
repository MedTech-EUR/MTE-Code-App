import React from 'react';
import { AppIcon } from './AppIcons';
import { CODE_CHAPTERS } from '../data/codeData';
import { CODE_CHAPTER_IDS } from '../data/codeOrder';
import { REFERENCE_INDEX } from '../data/referenceIndex';
import { useCheckerText } from '../hooks/useCheckerText';
import { formatMessage } from '../utils/eventSupportText';
import { generateSectionId } from '../utils/textUtils';
import { getReferenceHref, getReferenceTarget, referenceKey } from '../utils/crossReferences';

const OUTCOME_STYLES = {
  'not-permitted': { box: 'border-red-200 bg-red-50 text-red-900', icon: 'XCircle' },
  'not-permitted-as-proposed': { box: 'border-red-200 bg-red-50 text-red-900', icon: 'XCircle' },
  outside: { box: 'border-slate-200 bg-white text-slate-800', icon: 'Info' },
  handoff: { box: 'border-slate-200 bg-white text-slate-800', icon: 'Info' },
  'cvs-needed': { box: 'border-amber-200 bg-amber-50 text-amber-950', icon: 'AlertTriangle' },
  'more-info': { box: 'border-amber-200 bg-amber-50 text-amber-950', icon: 'HelpCircle' },
  review: { box: 'border-amber-200 bg-amber-50 text-amber-950', icon: 'AlertTriangle' },
  permitted: { box: 'border-teal-200 bg-teal-50 text-teal-950', icon: 'CheckCircle' },
  'permitted-confirmed': { box: 'border-teal-300 bg-teal-50 text-teal-950', icon: 'CheckCircle' },
};

const CVS_CARD_MESSAGES = {
  required: 'cvsRequired',
  none: 'cvsNotRequired',
  internal: 'cvsInternal',
  unknown: 'cvsUnknown',
  mecomed: 'cvsMecomed',
};

const CONDITION_ANSWERS = {
  yes: { label: 'Yes', icon: 'Check', className: 'text-teal-700' },
  covered: { label: 'Covered by CVS', icon: 'Check', className: 'text-teal-700' },
  no: { label: 'No', icon: 'X', className: 'text-red-700' },
  unknown: { label: 'Not sure yet', icon: 'HelpCircle', className: 'text-amber-700' },
};

// A source is a section of the Code, previewed in the app, or published CVS guidance.
function describeSource(data, key) {
  const source = data.sources[key];
  if (!source) return null;
  if (source.url) return { key, external: true, href: source.url, label: source.label, order: [Infinity, 0] };
  const chapter = CODE_CHAPTERS.find((item) => item.id === source.chapter);
  const section = chapter?.sections[source.section];
  if (!section) return null;
  const sectionId = section.computedId || generateSectionId(chapter.id, section.title, source.section);
  const target = getReferenceTarget(REFERENCE_INDEX, `code:${chapter.id}:${sectionId}`);
  if (!target) return null;
  const label = target.location && target.location !== target.title ? `${target.location} › ${target.title}` : target.title;
  const order = [CODE_CHAPTER_IDS.indexOf(chapter.id), source.section];
  return { key, reference: referenceKey(target), href: getReferenceHref(target), label, order };
}

// Sections of the Code in the Code's order, then published guidance.
const bySourceOrder = (a, b) => (a.order[0] - b.order[0]) || (a.order[1] - b.order[1]);

const optionLabel = (data, questionId, value) => data.questions[questionId]?.options
  .find(([option]) => option === value)?.[1] ?? value;

export default function EventSupportResult({ data, result, glossaryMap }) {
  const style = OUTCOME_STYLES[result.outcome] || OUTCOME_STYLES.review;
  // Not shown when the activity itself is ruled out: no CVS decision could change that.
  const showCvsCard = Boolean(result.context?.thirdParty)
    && !['outside', 'handoff'].includes(result.permission)
    && !(result.permission === 'prohibited' && result.blocking === 'rule' && !result.evidence);
  const cvsCardId = CVS_CARD_MESSAGES[result.cvsRequirement] || 'cvsUnknown';
  const missing = result.missing.map((item) => (item.question ? data.questions[item.question].label : formatMessage(data, item.id)));
  const sources = result.sources.map((key) => describeSource(data, key)).filter(Boolean).sort(bySourceOrder);

  // Less common circumstances that can change an answer about a third-party Event.
  const showConsiderations = Boolean(result.context?.thirdParty) && !['outside', 'handoff'].includes(result.permission);

  // Every text in reading order, so each glossary term is linked once in the whole answer.
  const texts = [
    data.outcomeTexts[result.outcome],
    data.messages.codeDisclaimer,
    ...result.warnings.flatMap((warning) => [formatMessage(data, warning.messageId, warning.params), warning.noteId ? formatMessage(data, warning.noteId) : '']),
    ...result.reasons.map((reason) => formatMessage(data, reason.id, reason.params)),
    formatMessage(data, cvsCardId),
    ...missing,
    ...result.expenses.map((expense) => formatMessage(data, expense.reason)),
    ...result.conditions.map((condition) => condition.label),
    showConsiderations ? data.messages.additionalConsiderations : '',
  ];
  const markup = useCheckerText(texts, glossaryMap);
  let cursor = 0;
  const take = (count = 1) => {
    const slice = markup.slice(cursor, cursor + count);
    cursor += count;
    return slice;
  };
  const [introMarkup, disclaimerMarkup] = take(2);
  const warningMarkup = take(result.warnings.length * 2);
  const reasonMarkup = take(result.reasons.length);
  const [cvsCardMarkup] = take();
  const missingMarkup = take(missing.length);
  const expenseMarkup = take(result.expenses.length);
  const conditionMarkup = take(result.conditions.length);
  const [considerationsMarkup] = take();

  return (
    <section className="space-y-5" aria-label="Support assessment">
      <div className={`rounded-2xl border p-5 ${style.box}`}>
        <div className="flex items-start gap-3">
          <AppIcon name={style.icon} size={24} className="mt-0.5 shrink-0" />
          <div>
            <h2 className="text-xl font-bold">{data.outcomes[result.outcome]}</h2>
            <p className="mt-2 text-sm" dangerouslySetInnerHTML={introMarkup} />
            <p className="mt-3 text-xs leading-relaxed opacity-90" dangerouslySetInnerHTML={disclaimerMarkup} />
          </div>
        </div>
      </div>

      {result.warnings.map((warning, index) => (
        <div key={warning.id} role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-950">
          <p className="font-bold">{formatMessage(data, warning.titleId)}</p>
          <p className="mt-2" dangerouslySetInnerHTML={warningMarkup[index * 2]} />
          {warning.noteId && <p className="mt-2 text-xs" dangerouslySetInnerHTML={warningMarkup[index * 2 + 1]} />}
        </div>
      ))}

      {result.reasons.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="font-semibold text-slate-800">Why this answer?</h3>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-slate-700">
            {result.reasons.map((reason, index) => (
              <li key={`${reason.id}-${index}`} dangerouslySetInnerHTML={reasonMarkup[index]} />
            ))}
          </ul>
        </div>
      )}

      {showCvsCard && (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="font-semibold text-slate-800">CVS position</h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-700" dangerouslySetInnerHTML={cvsCardMarkup} />
          {result.evidence ? (
            <div className="mt-3 text-sm text-slate-700">
              <p className="font-semibold">{result.evidence.name} · {result.evidence.emtId}</p>
              <p className="mt-1">Status in CVS: <strong>{result.evidence.status.raw}</strong></p>
              <p className="mt-1 text-xs text-slate-500">
                Checked {new Date(result.evidence.retrievedAt).toLocaleString()}. The status can change.
              </p>
              {result.evidence.detailUrl && (
                <a href={result.evidence.detailUrl} target="_blank" rel="noopener noreferrer" className="no-print mt-2 inline-flex items-center gap-1 font-semibold text-[#007A86] hover:underline">
                  View this Event in CVS <AppIcon name="ExternalLink" size={14} />
                </a>
              )}
            </div>
          ) : result.cvsRelevant && (
            <p className="mt-2 text-sm text-amber-800">No CVS record has been confirmed for this Event.</p>
          )}
        </div>
      )}

      {missing.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-950">
          <h3 className="font-semibold">Still to confirm</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed">
            {missing.map((text, index) => <li key={text} dangerouslySetInnerHTML={missingMarkup[index]} />)}
          </ul>
        </div>
      )}

      {result.expenses.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <caption className="p-4 text-left font-semibold text-slate-800">What the company would pay</caption>
            <thead>
              <tr className="bg-slate-50 text-slate-600">
                <th scope="col" className="p-3 font-semibold">Cost</th>
                <th scope="col" className="p-3 font-semibold">Position</th>
                <th scope="col" className="p-3 font-semibold">Why</th>
              </tr>
            </thead>
            <tbody>
              {result.expenses.map((expense, index) => (
                <tr key={expense.id} className="border-t border-slate-100 align-top">
                  <td className="p-3 text-slate-800">{optionLabel(data, 'expenses', expense.id)}</td>
                  <td className={`p-3 font-semibold ${expense.state === 'not-allowed' ? 'text-red-700' : expense.state === 'check' ? 'text-amber-800' : 'text-teal-800'}`}>
                    {data.expenseStates[expense.state]}
                  </td>
                  <td className="p-3 leading-relaxed text-slate-700" dangerouslySetInnerHTML={expenseMarkup[index]} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {result.conditions.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="font-semibold text-slate-800">Conditions</h3>
          <ul className="mt-3 space-y-3 text-sm leading-relaxed text-slate-700">
            {result.conditions.map((condition, index) => {
              const answer = CONDITION_ANSWERS[condition.answer] || CONDITION_ANSWERS.unknown;
              return (
                <li key={condition.id} className="flex gap-2">
                  <AppIcon name={answer.icon} size={16} className={`mt-0.5 shrink-0 ${answer.className}`} />
                  <span>
                    <strong className={answer.className}>{answer.label}:</strong>{' '}
                    <span dangerouslySetInnerHTML={conditionMarkup[index]} />
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {showConsiderations && (
        <>
          <details className="rounded-xl border border-slate-200 bg-white p-5 print:hidden">
            <summary className="cursor-pointer font-semibold text-slate-800">Additional considerations</summary>
            <p className="mt-3 text-sm leading-relaxed text-slate-700" dangerouslySetInnerHTML={considerationsMarkup} />
          </details>
          <div className="hidden rounded-xl border border-slate-200 bg-white p-5 print:block">
            <h3 className="font-semibold text-slate-800">Additional considerations</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-700" dangerouslySetInnerHTML={considerationsMarkup} />
          </div>
        </>
      )}

      {sources.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="font-semibold text-slate-800">Sources</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {sources.map((source) => (
              <li key={source.key}>
                {source.external ? (
                  <a href={source.href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[#007A86] hover:underline">
                    {source.label} <AppIcon name="ExternalLink" size={12} className="no-print" />
                  </a>
                ) : (
                  <a href={source.href} className="cross-reference text-[#007A86] hover:underline" data-reference={source.reference}>
                    {source.label}
                  </a>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

export { optionLabel };
