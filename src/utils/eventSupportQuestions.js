// Which questions the event support checker asks, in order, for the answers given so far.
// The wording lives in src/data/eventSupportRules.json; this file only decides which questions
// are relevant. A question is asked only when its answer can change the result, so the list
// stops as soon as the answers establish that the Code does not apply or that the support is
// not permitted.
import { calculateTpptEligibility } from './tpptParser.js';

export const isKnown = (value) => value !== undefined && value !== null && value !== '' && value !== 'unknown';

const DIRECT_SUPPORT = ['direct-delegate', 'direct-faculty'];
const TPPT_CRITERIA = ['procedureSkills', 'streamingFollowed', 'clinicalVenue', 'standalone', 'activeStations'];

export const getActivity = (data, id) => data.activities.find((activity) => activity.id === id) || null;

// The kind of Event: set by the answer, or implied when the activity allows only one kind.
export function getEventType(data, answers) {
  const activity = getActivity(data, answers.activity);
  if (!activity?.eventTypes.length) return null;
  if (activity.eventTypes.length === 1) return activity.eventTypes[0];
  if (answers.eventType === 'unknown') return 'unknown';
  return activity.eventTypes.includes(answers.eventType) ? answers.eventType : null;
}

/**
 * Facts derived from the answers, shared by the questions and the evaluator.
 */
export function getContext(data, answers) {
  const activity = getActivity(data, answers.activity);
  const eventType = getEventType(data, answers);
  const thirdParty = eventType === 'conference' || eventType === 'tppt';
  const company = Boolean(eventType?.startsWith('company-'));
  const eventActivity = Boolean(activity?.eventTypes.length);
  const virtual = eventActivity && answers.format === 'virtual';
  const onConference = eventType === 'conference';
  // A speaker at the company's own satellite symposium or booth follows the satellite rules,
  // whichever of the two activities was chosen.
  const satelliteSpeaker = activity?.id === 'satellite'
    || (activity?.id === 'direct-faculty' && onConference && answers.facultyRole === 'satellite');
  let role = null;
  if (activity?.id === 'direct-delegate') role = 'delegate';
  if (activity?.id === 'satellite') role = 'faculty';
  if (activity?.id === 'direct-faculty') {
    if (!onConference) role = 'faculty';
    else if (answers.facultyRole === 'poster') role = 'delegate';
    else if (isKnown(answers.facultyRole)) role = 'faculty';
  }
  // Direct sponsorship of a Delegate, or of Faculty in the conference's own programme.
  const conferenceDirect = onConference && DIRECT_SUPPORT.includes(activity?.id) && !satelliteSpeaker && role !== null;
  const area = !eventActivity ? null : virtual ? 'online' : answers.eventArea;
  return {
    activity,
    eventType,
    thirdParty,
    company,
    eventActivity,
    virtual,
    satelliteSpeaker,
    role,
    conferenceDirect,
    tpptDirect: eventType === 'tppt' && DIRECT_SUPPORT.includes(activity?.id),
    area,
    inArea: area === 'in' || area === 'mecomed',
    outsideOrOnline: area === 'out' || area === 'online',
  };
}

// The answer that tells whether HCPs from the MedTech Europe Geographic Area are involved in an
// Event held outside the Area or online. Which HCPs count depends on the support.
export function getAreaHcpsAnswer(ctx, answers) {
  const id = ctx.activity?.id;
  if (ctx.company) return answers.areaAttendance;
  if (id === 'grant-attendance') return answers.beneficiariesInArea;
  if (DIRECT_SUPPORT.includes(id) || id === 'satellite') return answers.supportedHcpInArea;
  return answers.areaAttendance;
}

function scopeQuestionIds(ctx, answers) {
  const id = ctx.activity.id;
  if (!ctx.outsideOrOnline) return [];
  if (id === 'company-attendance') return [];
  if (id === 'grant-attendance') {
    return answers.beneficiariesInArea === 'no' ? ['beneficiariesInArea', 'recipientInArea'] : ['beneficiariesInArea'];
  }
  if (DIRECT_SUPPORT.includes(id) || id === 'satellite') return ['supportedHcpInArea'];
  // Without HCPs from the Area, a grant (and a booth at a Virtual Event, which is outside CVS)
  // comes within the Code through a recipient in the Area.
  if (answers.areaAttendance === 'no' && (id === 'grant-running' || id === 'grant-faculty' || (id === 'booth' && ctx.virtual))) {
    return ['areaAttendance', 'recipientInArea'];
  }
  return ['areaAttendance'];
}

// True when the answers so far place the support outside the Code's scope.
export function isOutsideScope(ctx, answers) {
  if (answers.member === 'no') return true;
  if (!ctx.eventActivity) return answers.interactionInArea === 'no';
  if (!ctx.outsideOrOnline || ctx.activity.id === 'company-attendance') return false;
  const areaHcps = getAreaHcpsAnswer(ctx, answers);
  if (areaHcps !== 'no') return false;
  const id = ctx.activity.id;
  // Annex I asks for internal review at an Event outside the Area, not "out of scope". A Virtual
  // Event is not held outside the Area: the Code's scope decides (Annex I, footnote 5).
  if (id === 'booth') return ctx.virtual && answers.recipientInArea === 'no';
  if (['grant-running', 'grant-attendance', 'grant-faculty'].includes(id)) return answers.recipientInArea === 'no';
  return true;
}

// A complete programme below the Annex VII thresholds: the Event cannot qualify, whatever else.
export function tpptAgendaFails(answers) {
  const agenda = calculateTpptEligibility(answers.sessions || []);
  return agenda.valid && agenda.total > 0 && !agenda.passesAgenda;
}

// Questions about whether a procedure training qualifies, up to the first criterion not met.
function tpptQuestionIds(answers) {
  const ids = ['handsOnChanged'];
  if (answers.handsOnChanged === 'yes') return ids;
  ids.push('sessions');
  if (tpptAgendaFails(answers)) return ids;
  for (const id of TPPT_CRITERIA) {
    if (id === 'streamingFollowed' && !answers.sessions?.some((session) => session.type === 'Streaming')) continue;
    ids.push(id);
    if (answers[id] === 'no') break;
  }
  return ids;
}

const expensesAllowNothing = (ctx, answers) => ctx.company && answers.overlap === 'yes' && ctx.role === 'delegate';

function expenseQuestionIds(ctx, answers) {
  const ids = ['expenses'];
  const expenses = Array.isArray(answers.expenses) ? answers.expenses : [];
  const has = (...types) => types.some((type) => expenses.includes(type));
  if (ctx.satelliteSpeaker) {
    if (has('registration')) ids.push('accessRequired');
    if (!ctx.virtual && has('travel', 'accommodation', 'meals')) ids.push('grantCoversAttendance');
  }
  if (ctx.company && answers.overlap === 'yes' && ctx.role === 'faculty' && !ctx.virtual && has('travel', 'accommodation', 'meals')) {
    ids.push('incrementalCosts');
  }
  if (ctx.eventType === 'company-business' && ctx.role === 'delegate' && answers.overlap === 'no'
    && !ctx.virtual && has('travel', 'accommodation')) {
    ids.push('nonPortable');
  }
  return ids;
}

/**
 * The IDs of the questions to ask, in order, for the answers given so far.
 */
export function getQuestionIds(data, answers) {
  const ctx = getContext(data, answers);
  const { activity } = ctx;
  if (!activity || activity.id === 'research') return [];
  const ids = ['member'];
  if (answers.member === 'no') return ids;
  const withIntermediary = () => [...ids, 'intermediary'];

  if (!ctx.eventActivity) {
    ids.push('interactionInArea');
    if (answers.interactionInArea === 'no') return ids;
    if (activity.id === 'meal') {
      ids.push('overlap');
      if (answers.overlap === 'yes') ids.push('mealGrantHospitality');
    }
    if (activity.id === 'demos') {
      ids.push('demoKind');
      if (answers.demoKind === 'demo') {
        ids.push('demoClinicalUse');
        if (answers.demoClinicalUse === 'yes') return ids;
      }
    }
    if (activity.id === 'proctorship') ids.push('proctorshipSetting');
    if (activity.id === 'donation') {
      ids.push('donationRecipient');
      if (answers.donationRecipient === 'hcp-charity') return ids;
      if (answers.donationRecipient === 'hco') {
        ids.push('donationHcoBasis');
        if (answers.donationHcoBasis === 'neither') return ids;
      }
      ids.push('fundraiserHcps');
    }
    return withIntermediary();
  }

  if (activity.eventTypes.length > 1) ids.push('eventType');
  const { eventType } = ctx;
  if (!eventType || eventType === 'unknown') return ids;
  if (activity.id === 'direct-faculty' && eventType === 'conference') {
    ids.push('facultyRole');
    if (!isKnown(answers.facultyRole)) return ids;
  }
  ids.push('format');
  // Annex I gives company attendance the same answer wherever the Event is and whoever attends.
  if (activity.id === 'company-attendance') return withIntermediary();
  if (!ctx.virtual) ids.push('eventArea');
  const locationKnown = ctx.virtual || isKnown(answers.eventArea);
  if (!locationKnown) return ids;

  // Direct sponsorship at a third-party conference, or at any third-party Virtual Event, is not
  // allowed wherever the Code applies: only the question of scope is left.
  const directBanned = ctx.conferenceDirect || (ctx.tpptDirect && ctx.virtual);
  if (directBanned) return [...ids, ...scopeQuestionIds(ctx, answers)];

  if (ctx.thirdParty && ctx.inArea) ids.push('audience');
  if (ctx.company && ctx.outsideOrOnline) ids.push('areaAttendance');
  else ids.push(...scopeQuestionIds(ctx, answers));
  if (isOutsideScope(ctx, answers)) return ids;

  if (ctx.company) {
    ids.push('overlap');
    if (!isKnown(answers.overlap)) return ids;
    if (expensesAllowNothing(ctx, answers)) return ids;
  }

  if (ctx.tpptDirect) {
    const tpptIds = tpptQuestionIds(answers);
    ids.push(...tpptIds);
    const failed = tpptAgendaFails(answers) || TPPT_CRITERIA.some((id) => answers[id] === 'no' && tpptIds.includes(id));
    // Hands-on part cancelled: Faculty are then treated as at a conference and cannot be paid.
    if (failed || (answers.handsOnChanged === 'yes' && ctx.role === 'faculty')) return ids;
  }

  switch (activity.id) {
    case 'grant-running':
    case 'grant-attendance':
    case 'grant-faculty':
      ids.push('recipient');
      if (['individual', 'agency', 'patient'].includes(answers.recipient)) return ids;
      ids.push('paymentRoute', 'packageMixed');
      break;
    case 'booth':
      ids.push('packageEducation');
      break;
    case 'in-kind':
      ids.push('inKindType', 'identifiableAttendance');
      break;
    case 'satellite':
    case 'direct-delegate':
    case 'direct-faculty':
      ids.push(...expenseQuestionIds(ctx, answers));
      break;
    default:
      break;
  }
  return withIntermediary();
}

// Delegates are not paid a fee, so the fee option is only offered for services.
function questionFor(data, id, ctx) {
  const question = data.questions[id];
  if (id === 'eventType') {
    const allowed = new Set([...(ctx.activity?.eventTypes || []), 'unknown']);
    return { id, ...question, options: question.options.filter(([value]) => allowed.has(value)) };
  }
  if (id === 'expenses' && ctx.role === 'delegate') {
    return { id, ...question, options: question.options.filter(([value]) => value !== 'fee') };
  }
  return { id, ...question };
}

export function getEventQuestions(data, answers) {
  const ctx = getContext(data, answers);
  return getQuestionIds(data, answers).map((id) => questionFor(data, id, ctx));
}
