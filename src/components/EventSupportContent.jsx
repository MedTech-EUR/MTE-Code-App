import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AppIcon } from './AppIcons';
import { ContextPanel } from './ContextPanel';
import { ResizeHandle } from './ResizeHandle';
import CvsEventLookup from './CvsEventLookup';
import EventSupportAgenda from './EventSupportAgenda';
import EventSupportResult, { optionLabel } from './EventSupportResult';
import { useCvsLookup } from '../hooks/useCvsLookup';
import { useCheckerText } from '../hooks/useCheckerText';
import EVENT_SUPPORT_DATA from '../data/eventSupportRules.json';
import { evaluateEventSupport, getConditionQuestions, updateEventAnswer } from '../utils/eventSupportRules';
import { getContext, getEventQuestions } from '../utils/eventSupportQuestions';
import { createLinkedTextHandlers } from '../utils/linkedTextEvents';

const data = EVENT_SUPPORT_DATA;

const STAGE_LABELS = {
  activity: 'Planned support',
  details: 'Details',
  cvs: 'CVS check',
  conditions: 'Conditions',
  answer: 'Your answer',
};

const primary = 'inline-flex items-center justify-center gap-2 rounded-xl bg-[#7654A1] px-5 py-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-40';
const secondary = 'inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600 hover:border-[#7654A1]';
// Code references in the checker's text ("Chapter 4, Section 3") look like the reader's.
const LINK_STYLES = '[&_a.cross-reference]:text-[#007A86] [&_a.cross-reference]:underline [&_a.cross-reference]:underline-offset-2 [&_a.cross-reference]:decoration-[#0099A7]/50 [&_a.cross-reference:hover]:text-[#7654A1] print:[&_a.cross-reference]:text-inherit print:[&_a.cross-reference]:no-underline';

// A multiple choice needs at least one option; the agenda can be completed later.
const hasAnswer = (question, answers) => {
  if (question.type === 'agenda') return true;
  if (question.type === 'multi') return Array.isArray(answers[question.id]) && answers[question.id].length > 0;
  return answers[question.id] !== undefined;
};

function Question({ question, answers, onChange, glossaryMap }) {
  const [labelMarkup, helpMarkup] = useCheckerText([question.label, question.help || ''], glossaryMap);
  const multi = question.type === 'multi';
  return (
    <fieldset>
      <legend className="text-xl font-semibold leading-snug text-slate-800" dangerouslySetInnerHTML={labelMarkup} />
      {question.help && <p className="mt-3 text-sm leading-relaxed text-slate-600" dangerouslySetInnerHTML={helpMarkup} />}
      {question.type === 'agenda' ? (
        <div className="mt-5">
          <EventSupportAgenda sessions={answers.sessions} onChange={(sessions) => onChange('sessions', sessions)} />
        </div>
      ) : (
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {question.options.map(([value, label]) => {
            const selected = multi ? (answers[question.id] || []).includes(value) : answers[question.id] === value;
            const toggle = () => onChange(question.id, multi
              ? (selected ? answers[question.id].filter((item) => item !== value) : [...(answers[question.id] || []), value])
              : value);
            return (
              <label
                key={value}
                className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 text-sm ${selected ? 'border-[#7654A1] bg-purple-50 text-[#634488]' : 'border-slate-200 bg-white text-slate-700 hover:border-purple-300'}`}
              >
                <input
                  type={multi ? 'checkbox' : 'radio'}
                  name={question.id}
                  value={value}
                  checked={selected}
                  onChange={toggle}
                  className="mt-0.5 accent-[#7654A1]"
                />
                <span>{label}</span>
              </label>
            );
          })}
        </div>
      )}
      {multi && <p className="mt-3 text-xs text-slate-500">Select all that apply.</p>}
    </fieldset>
  );
}

function ConditionList({ conditions, answers, onChange, glossaryMap }) {
  const markup = useCheckerText(conditions.map((condition) => condition.label), glossaryMap);
  return (
    <div className="mt-6 space-y-6">
      {conditions.map((condition, index) => (
        <fieldset key={condition.id} className="border-b border-slate-100 pb-5">
          <legend className="mb-3 text-sm leading-relaxed text-slate-700" dangerouslySetInnerHTML={markup[index]} />
          <div className="flex flex-wrap gap-3">
            {condition.options.map(([value, label]) => (
              <label key={value} className={`flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-xs ${answers[condition.id] === value ? 'bg-purple-50 text-[#634488] ring-1 ring-[#7654A1]' : 'bg-slate-50 text-slate-700'}`}>
                <input type="radio" name={condition.id} checked={answers[condition.id] === value} onChange={() => onChange(condition.id, value)} className="accent-[#7654A1]" />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
      ))}
    </div>
  );
}

function AnswerFacts({ questions, answers }) {
  const describe = (question) => {
    const value = answers[question.id];
    if (question.type === 'agenda') {
      return (answers.sessions || []).map((session) => `${session.title}: ${session.type}, ${session.durationMinutes} min`).join('; ') || 'Not given';
    }
    if (question.type === 'multi') return (value || []).map((item) => optionLabel(data, question.id, item)).join(', ') || 'Not given';
    const labels = question.options.find(([option]) => option === value);
    return labels ? labels[1] : 'Not given';
  };
  return (
    <dl className="mt-4 space-y-3 text-sm">
      {questions.map((question) => (
        <div key={question.id}>
          <dt className="font-semibold text-slate-700">{question.label}</dt>
          <dd className="mt-1 text-slate-600">{describe(question)}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function EventSupportContent({ onBack, scrollRef, glossaryMap, onTermClick, onOpenReference, sidePane }) {
  const [answers, setAnswers] = useState({});
  const [stage, setStage] = useState('activity');
  const [questionIndex, setQuestionIndex] = useState(0);
  const [overview, setOverview] = useState(false);
  const [assessedAt, setAssessedAt] = useState(null);
  const [printing, setPrinting] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [identityNotice, setIdentityNotice] = useState(false);
  const headingRef = useRef(null);
  const mounted = useRef(true);
  const eventIdentity = useRef(null);
  const assessmentRequest = useRef(0);
  const lookup = useCvsLookup();

  const result = useMemo(() => evaluateEventSupport(data, answers, lookup.status), [answers, lookup.status]);
  const eventQuestions = useMemo(() => getEventQuestions(data, answers), [answers]);
  const conditions = useMemo(() => getConditionQuestions(data, answers, lookup.status), [answers, lookup.status]);
  const context = getContext(data, answers);
  const activity = context.activity;
  const stages = [
    'activity',
    'details',
    ...(result.cvsRelevant ? ['cvs'] : []),
    ...(conditions.length ? ['conditions'] : []),
    'answer',
  ];
  const question = eventQuestions[Math.min(questionIndex, eventQuestions.length - 1)];
  const { handleClick, handleKeyDown, handleKeyUp } = createLinkedTextHandlers({ onTermClick, onOpenReference });

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  useEffect(() => {
    scrollRef?.current?.scrollTo({ top: 0 });
    headingRef.current?.focus({ preventScroll: true });
  }, [stage, questionIndex, scrollRef]);

  // Another Event selected in CVS: the conditions about the Event must be confirmed again.
  useEffect(() => {
    const nextId = lookup.selected?.emtId;
    if (!nextId) return;
    if (eventIdentity.current && eventIdentity.current !== nextId) {
      assessmentRequest.current += 1;
      setPreparing(false);
      setPrinting(false);
      setIdentityNotice(true);
      setAssessedAt(null);
      setAnswers((previous) => {
        const next = { ...previous };
        for (const condition of data.conditions) delete next[condition.id];
        return next;
      });
    }
    eventIdentity.current = nextId;
  }, [lookup.selected?.emtId]);

  useEffect(() => {
    if (!printing || lookup.busy) return undefined;
    const timer = setTimeout(() => {
      window.print();
      setPrinting(false);
    }, 100);
    return () => clearTimeout(timer);
  }, [printing, lookup.busy]);

  const cancelPending = () => {
    assessmentRequest.current += 1;
    setPreparing(false);
    setPrinting(false);
  };

  const change = (key, value) => {
    cancelPending();
    setAnswers((previous) => updateEventAnswer(data, previous, key, value));
    setAssessedAt(null);
    setOverview(false);
  };

  // The current CVS status is fetched again before an answer is shown or printed.
  const showAnswer = async () => {
    const request = ++assessmentRequest.current;
    setPreparing(true);
    if (lookup.selected) await lookup.refresh();
    if (!mounted.current || assessmentRequest.current !== request) return;
    setIdentityNotice(false);
    setAssessedAt(new Date().toISOString());
    setStage('answer');
    setPreparing(false);
  };

  const advanceFrom = (from) => {
    const next = stages[stages.indexOf(from) + 1] || 'answer';
    if (next === 'answer') showAnswer();
    else setStage(next);
  };

  const choose = (id) => {
    cancelPending();
    setIdentityNotice(false);
    const next = updateEventAnswer(data, answers, 'activity', id);
    setAnswers(next);
    setOverview(false);
    setAssessedAt(null);
    const questions = getEventQuestions(data, next);
    if (!questions.length) {
      setStage('answer');
      setAssessedAt(new Date().toISOString());
      return;
    }
    const index = questions.findIndex((item) => !hasAnswer(item, next));
    setQuestionIndex(index < 0 ? questions.length - 1 : index);
    setStage('details');
  };

  const nextQuestion = () => {
    if (questionIndex < eventQuestions.length - 1) setQuestionIndex(questionIndex + 1);
    else advanceFrom('details');
  };

  const back = () => {
    cancelPending();
    if (stage === 'details' && questionIndex > 0) {
      setQuestionIndex(questionIndex - 1);
      return;
    }
    const position = stages.indexOf(stage);
    const previous = position > 0 ? stages[position - 1] : 'activity';
    if (previous === 'details') setQuestionIndex(Math.max(0, eventQuestions.length - 1));
    setStage(position < 0 ? 'details' : previous);
  };

  const printSummary = async () => {
    const request = ++assessmentRequest.current;
    setPreparing(true);
    if (lookup.selected) await lookup.refresh();
    if (!mounted.current || assessmentRequest.current !== request) return;
    setAssessedAt(new Date().toISOString());
    setPreparing(false);
    setPrinting(true);
  };

  const reset = () => {
    cancelPending();
    setIdentityNotice(false);
    eventIdentity.current = null;
    lookup.clearLookup();
    setAnswers({});
    setStage('activity');
    setQuestionIndex(0);
    setOverview(false);
    setAssessedAt(null);
  };

  const cvsIntro = result.cvsRequirement === 'required'
    ? 'This support needs a positive CVS decision. Find the Event, and the right edition, in CVS.'
    : answers.audience === 'local'
      ? 'You indicated that the Event’s Delegates are local HCPs only. Check whether the Event has a CVS record: if it does, it may still be within CVS scope.'
      : 'If the Event has a CVS record, check its status: a CVS decision is binding on all Member Companies.';
  const alternatives = data.activities.filter((item) => item.id !== answers.activity
    && item.group === activity?.group
    && (!context.eventType || context.eventType === 'unknown' || !item.eventTypes.length || item.eventTypes.includes(context.eventType)));

  return (
    <div className="flex flex-1 min-w-0 h-full print:block print:h-auto">
      <main
        ref={scrollRef}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
        className={`flex-1 min-w-0 h-full overflow-y-auto bg-slate-50 custom-scrollbar print:h-auto print:overflow-visible print:bg-white ${LINK_STYLES}`}
      >
        <div className="mx-auto max-w-4xl px-4 py-8 sm:px-8 print:p-0">
          <div className="no-print mb-6 flex items-center justify-between gap-3">
            <button type="button" onClick={onBack} className="flex items-center gap-1 text-sm text-slate-500 hover:text-[#7654A1]">
              <AppIcon name="ChevronLeft" size={16} /> All Decision Trees
            </button>
            {Boolean(answers.activity) && (
              <button type="button" onClick={reset} className="text-sm font-semibold text-[#7654A1]">Start again</button>
            )}
          </div>

          <div className="mb-7">
            <p className="text-xs font-bold uppercase tracking-widest text-[#7654A1]">Event support · MedTech Europe Code, {data.codeVersion}</p>
            <h1 ref={headingRef} tabIndex={-1} className="mt-2 text-3xl font-bold tracking-tight text-slate-800 outline-none sm:text-4xl">
              Can we support this event?
            </h1>
            <p className="mt-3 text-slate-600">
              Interactive guide to asess specific scenarios on whether support to an Event can be provided.
            </p>
          </div>

          <nav aria-label="Steps" className="no-print mb-7 flex flex-wrap gap-2">
            {stages.map((id, index) => (
              <span
                key={id}
                aria-current={stage === id ? 'step' : undefined}
                className={`rounded-full px-3 py-2 text-xs font-semibold ${stage === id ? 'bg-[#7654A1] text-white' : 'bg-white text-slate-500'}`}
              >
                {index + 1}. {STAGE_LABELS[id]}
              </span>
            ))}
          </nav>

          {stage === 'activity' && (
            <div className="no-print space-y-8">
              <p className="text-sm text-slate-600">
                Choose one type of interaction. If the company plans several, check each one separately: the facts about the Event are kept when you switch.
              </p>
              {data.activityGroups.map((group) => (
                <section key={group.id}>
                  <h2 className="mb-4 text-lg font-semibold text-slate-800">{group.label}</h2>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {data.activities.filter((item) => item.group === group.id).map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => choose(item.id)}
                        className="group flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-[#7654A1] hover:shadow-md"
                      >
                        <span className="mt-1 rounded-lg bg-purple-50 p-2 text-[#7654A1]">
                          <AppIcon name={item.id.startsWith('grant') ? 'Gift' : group.id === 'event' ? 'Compass' : 'FileText'} size={20} />
                        </span>
                        <span>
                          <strong className="block text-sm text-slate-800">{item.label}</strong>
                          <span className="mt-2 block text-xs leading-relaxed text-slate-500">{item.description}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}

          {stage === 'details' && question && (
            <div className="no-print rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <p className="mb-5 text-xs font-semibold text-[#7654A1]">
                {activity?.label} · Question {Math.min(questionIndex + 1, eventQuestions.length)}
              </p>
              <Question key={question.id} question={question} answers={answers} onChange={change} glossaryMap={glossaryMap} />
              <div className="mt-8 flex justify-between gap-3">
                <button type="button" onClick={back} className={secondary}><AppIcon name="ChevronLeft" size={16} /> Back</button>
                <button type="button" disabled={!hasAnswer(question, answers) || preparing} onClick={nextQuestion} className={primary}>
                  Continue <AppIcon name="ChevronRight" size={16} />
                </button>
              </div>
            </div>
          )}

          {stage === 'cvs' && (
            <div className="no-print">
              <h2 className="text-xl font-semibold text-slate-800">Find the Event in CVS</h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">{cvsIntro}</p>
              <CvsEventLookup lookup={lookup} />
              <div className="mt-7 flex flex-wrap justify-between gap-3">
                <button type="button" onClick={back} className={secondary}><AppIcon name="ChevronLeft" size={16} /> Back</button>
                <button type="button" disabled={Boolean(lookup.busy) || preparing} onClick={() => advanceFrom('cvs')} className={primary}>
                  {preparing ? 'Checking the current status…' : 'Continue'} <AppIcon name="ChevronRight" size={16} />
                </button>
              </div>
              <p className="mt-3 text-xs text-slate-500">You can continue without a match. A CVS decision that is needed and not confirmed stays open in your answer.</p>
            </div>
          )}

          {stage === 'conditions' && (
            <div className="no-print rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              {identityNotice && (
                <p role="status" className="mb-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
                  You selected a different Event in CVS. Confirm the conditions again.
                </p>
              )}
              <h2 className="text-xl font-semibold text-slate-800">Confirm the Code’s requirements</h2>
              <p className="mt-2 text-sm text-slate-600">
                Answer for the proposal as it stands. Anything you are not sure of stays open in your answer; it does not count as met.
              </p>
              <ConditionList conditions={conditions} answers={answers} onChange={change} glossaryMap={glossaryMap} />
              <div className="mt-7 flex flex-wrap justify-between gap-3">
                <button type="button" onClick={back} className={secondary}><AppIcon name="ChevronLeft" size={16} /> Back</button>
                <button type="button" disabled={preparing} onClick={() => advanceFrom('conditions')} className={primary}>
                  {preparing ? 'Checking the current status…' : 'Show my answer'} <AppIcon name="ChevronRight" size={16} />
                </button>
              </div>
            </div>
          )}

          {stage === 'answer' && (
            <>
              <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-800">{activity?.label}</h2>
                  <p className="mt-1 text-xs text-slate-500">
                    Rules version {result.version} · Checked {assessedAt ? new Date(assessedAt).toLocaleString() : 'now'}
                  </p>
                </div>
                <div className="no-print flex flex-wrap gap-2">
                  {eventQuestions.length > 0 && (
                    <button type="button" onClick={() => { cancelPending(); setStage('details'); setQuestionIndex(0); }} className={secondary}>
                      Edit answers
                    </button>
                  )}
                  <button type="button" disabled={preparing || Boolean(lookup.busy)} onClick={printSummary} className={secondary}>
                    <AppIcon name="Printer" size={16} /> {preparing ? 'Checking…' : 'Print summary'}
                  </button>
                </div>
              </div>
              {lookup.error && (
                <p role="alert" className="mb-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
                  {lookup.error.message} The Event’s current CVS status is not confirmed.
                </p>
              )}
              <EventSupportResult data={data} result={result} glossaryMap={glossaryMap} />
              {lookup.selected && (
                <button type="button" className="no-print mt-4 text-sm font-semibold text-[#7654A1] underline" disabled={Boolean(lookup.busy)} onClick={() => lookup.refresh()}>
                  Check the CVS status again
                </button>
              )}
              {eventQuestions.length > 0 && (
                <>
                  <details className="mt-6 rounded-xl border border-slate-200 bg-white p-5 print:hidden">
                    <summary className="cursor-pointer text-sm font-semibold text-slate-800">Your answers</summary>
                    <AnswerFacts questions={eventQuestions} answers={answers} />
                  </details>
                  <div className="hidden print:block">
                    <h3 className="mt-6 font-semibold">Your answers</h3>
                    <AnswerFacts questions={eventQuestions} answers={answers} />
                  </div>
                </>
              )}
              {alternatives.length > 0 && (
                <div className="no-print mt-7">
                  <button type="button" aria-expanded={overview} onClick={() => setOverview(!overview)} className={primary}>
                    {overview ? 'Hide other ways to support this Event' : 'What else could the company provide?'}
                    <AppIcon name={overview ? 'ChevronUp' : 'ChevronDown'} size={16} />
                  </button>
                </div>
              )}
              {overview && (
                <section className="no-print mt-6">
                  <h2 className="mb-3 text-xl font-semibold text-slate-800">Other ways to support this Event</h2>
                  <p className="mb-5 text-sm text-slate-600">
                    These use the facts you gave and the CVS status found. Each option still needs its own details and conditions: select one to check it.
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {alternatives.map((item) => {
                      const candidate = evaluateEventSupport(data, updateEventAnswer(data, answers, 'activity', item.id), lookup.status);
                      const tone = candidate.outcome.startsWith('not-permitted') ? 'text-red-700' : candidate.outcome.startsWith('permitted') ? 'text-teal-800' : 'text-amber-800';
                      return (
                        <button key={item.id} type="button" onClick={() => choose(item.id)} className="rounded-xl border border-slate-200 bg-white p-5 text-left hover:border-[#7654A1]">
                          <strong className="block text-sm text-slate-800">{item.label}</strong>
                          <span className={`mt-2 block text-xs font-semibold ${tone}`}>{data.outcomes[candidate.outcome]}</span>
                          {candidate.cvsRequirement === 'required' && <span className="mt-1 block text-xs text-slate-500">Needs a positive CVS decision.</span>}
                          <span className="mt-3 block text-xs font-semibold text-[#7654A1]">Check this option →</span>
                        </button>
                      );
                    })}
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </main>

      {sidePane && (
        <aside
          id="side-pane"
          aria-label="Side panel"
          className="hidden xl:flex flex-col relative shrink-0 w-[var(--side-pane-size)] h-full border-l border-gray-200 bg-slate-50 no-print"
        >
          <ResizeHandle edge="left" label="Resize the side panel" controls="side-pane" resize={sidePane.resize} />
          <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-6 pt-8 pb-10">
            {sidePane.item ? (
              <ContextPanel item={sidePane.item} onClose={sidePane.onClose} onOpenTarget={sidePane.onOpenTarget} />
            ) : (
              <p className="flex gap-2 text-xs leading-relaxed text-gray-500">
                <AppIcon name="BookOpen" size={14} className="shrink-0 mt-0.5 text-gray-400" />
                Select an underlined term or a reference to the Code to see its definition or text here.
              </p>
            )}
          </div>
        </aside>
      )}
    </div>
  );
}
