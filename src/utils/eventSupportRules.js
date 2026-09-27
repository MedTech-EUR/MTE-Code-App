// The event support checker's evaluator: applies the Code's rules to the answers and, for a
// third-party Event, to its live CVS status. It returns message and source IDs; the wording is
// in src/data/eventSupportRules.json, so the text can be corrected without touching the logic.
import { calculateTpptEligibility } from './tpptParser.js';
import { classifyCvsStatus, getCvsScopeWarning } from './eventSupportCvs.js';
import {
  getActivity,
  getAreaHcpsAnswer,
  getContext,
  getEventQuestions,
  getEventType,
  getQuestionIds,
  isKnown,
  isOutsideScope,
} from './eventSupportQuestions.js';

const GRANTS = ['grant-running', 'grant-attendance', 'grant-faculty'];
const EXPENSE_ORDER = ['fee', 'registration', 'travel', 'accommodation', 'meals'];
const TPPT_CRITERIA = ['procedureSkills', 'clinicalVenue', 'standalone', 'activeStations'];
const CONDITION_OPTIONS = [['yes', 'Yes'], ['no', 'No'], ['unknown', 'Not sure yet']];

// The tags a condition's "appliesTo" can use (see conditionTags below).
export const CONDITION_TAGS = Object.freeze([
  'all', 'eventSupport', 'inPersonEvent', 'meal', 'hospitality', 'travel', 'consulting',
  'employerNotification', 'funding', 'grant', 'grantAttendance', 'grantOrganiser', 'pco',
  'travelAgency', 'commercial', 'staff', 'companyTraining', 'companyVenue', 'companyBusiness',
  'mealAtTpoe', 'items', 'products', 'samples', 'donation', 'inKind', 'intermediary',
]);

// Facts about the Event and the company that stay true whatever is proposed. They are kept when
// another activity is chosen, and also while a question before them is still unanswered; each
// is read only where its own question applies.
const SHARED_FACTS = new Set([
  'member', 'eventType', 'format', 'eventArea', 'audience', 'areaAttendance', 'overlap',
  'handsOnChanged', 'sessions', 'procedureSkills', 'streamingFollowed', 'clinicalVenue',
  'standalone', 'activeStations', 'interactionInArea', 'intermediary',
]);

// Answers that belong to one proposal. Choosing another activity clears them.
const ACTIVITY_ANSWERS = [
  'facultyRole', 'beneficiariesInArea', 'recipientInArea', 'supportedHcpInArea', 'recipient',
  'paymentRoute', 'packageMixed', 'packageEducation', 'expenses', 'accessRequired',
  'grantCoversAttendance', 'incrementalCosts', 'nonPortable', 'inKindType', 'identifiableAttendance',
  'mealGrantHospitality', 'demoKind', 'demoClinicalUse', 'proctorshipSetting', 'donationRecipient',
  'fundraiserHcps',
];

/**
 * Whether the Event qualifies as a Third Party Organised Procedure Training (Annex VII):
 * 'qualified' | 'failed' | 'unknown' | 'changed' (hands-on part cancelled or moved online).
 */
export function getTpptQualification(answers) {
  const agenda = calculateTpptEligibility(answers.sessions || []);
  if (answers.handsOnChanged === 'yes') return { state: 'changed', agenda };
  if (answers.format === 'virtual') return { state: 'failed', agenda };
  const criteria = TPPT_CRITERIA.map((id) => answers[id]);
  if (answers.sessions?.some((session) => session.type === 'Streaming')) criteria.push(answers.streamingFollowed);
  const agendaComplete = agenda.valid && agenda.total > 0;
  if (criteria.includes('no') || (agendaComplete && !agenda.passesAgenda)) return { state: 'failed', agenda };
  if (!agendaComplete || criteria.some((value) => value !== 'yes')) return { state: 'unknown', agenda };
  return { state: 'qualified', agenda };
}

function createResult(data, answers) {
  return {
    version: data.version,
    codeVersion: data.codeVersion,
    activity: answers.activity || null,
    permission: null, // 'conditional' | 'prohibited' | 'review' | 'outside' | 'handoff'
    blocking: null, // for a prohibition: 'rule' (the activity itself) or 'proposal' (its details)
    cvsRequirement: 'none', // 'none' | 'required' | 'internal' | 'mecomed' | 'unknown'
    cvsState: 'missing',
    cvsRelevant: false,
    reasons: [],
    missing: [],
    warnings: [],
    expenses: [],
    conditions: [],
    sources: [],
    tppt: null,
    evidence: null,
  };
}

function createApi(result) {
  const addSources = (source) => {
    if (source) result.sources.push(...[].concat(source));
  };
  const add = (id, params, source) => {
    result.reasons.push(params ? { id, params } : { id });
    addSources(source);
  };
  const settled = () => ['prohibited', 'outside', 'handoff'].includes(result.permission);
  return {
    addSources,
    reason: add,
    allow() {
      if (result.permission === null) result.permission = 'conditional';
    },
    review(id, params, source) {
      if (!settled()) result.permission = 'review';
      add(id, params, source);
    },
    prohibit(id, params, source, blocking = 'proposal') {
      result.permission = 'prohibited';
      if (result.blocking !== 'rule') result.blocking = blocking;
      add(id, params, source);
    },
    outside(id, source) {
      result.permission = 'outside';
      add(id, null, source);
    },
    missing(entry) {
      const key = entry.question || entry.id;
      if (!result.missing.some((item) => (item.question || item.id) === key)) result.missing.push(entry);
    },
  };
}

// Annex I column: 0 national, 1 international in the Area, 2 outside the Area with HCPs from the
// Area, 3 outside the Area without them. Online Events use columns 2 and 3 for scope only.
function annex1Column(ctx, answers) {
  if (ctx.inArea) {
    if (answers.audience === 'local') return 0;
    if (answers.audience === 'international') return 1;
    return null;
  }
  if (ctx.outsideOrOnline) {
    const areaHcps = getAreaHcpsAnswer(ctx, answers);
    if (areaHcps === 'yes') return 2;
    if (areaHcps === 'no') return 3;
  }
  return null;
}

function annex1Cell(data, row, column) {
  if (column === null) return null;
  const [permission, cvs] = data.conferenceMatrix[row][column].split(':');
  return { permission, cvs };
}

function quoteAnnex1(data, api, ctx, row, column) {
  if (column === null || ctx.virtual) return;
  api.reason('annex1Cell', { column: data.annex1Columns[column], text: data.annex1Text[row][column] }, 'annex1');
}

function quoteAnnex6(data, api, setting, role) {
  api.reason('annex6Cell', {
    role: role === 'faculty' ? 'Faculty and speakers' : 'Delegates',
    setting: data.annex6Settings[setting],
    text: data.annex6Text[setting][role],
  }, 'annex6');
}

// Whether CVS vets this kind of support at an international Event (Annex I's second column).
const vettedByCvs = (data, row) => data.conferenceMatrix[row][1].endsWith(':required');

// For Events in Mecomed countries CVS applies Mecomed's guidelines, whose scope covers national
// Events as well as international ones: support that CVS vets needs Mecomed's vetting whatever
// the audience.
function setMecomedCvs(result, api, ctx, answers, vetted) {
  if (ctx.virtual || answers.eventArea !== 'mecomed' || !vetted) return false;
  result.cvsRequirement = 'mecomed';
  api.reason('mecomedCvs', null, ['geography', 'cvsGuidance', 'mecomedCvs']);
  return true;
}

// A CVS decision is never needed for a Virtual Event.
function setCvsRequirement(result, api, ctx, answers, cvs, vetted = cvs === 'required') {
  if (ctx.virtual) {
    result.cvsRequirement = 'none';
    return;
  }
  if (setMecomedCvs(result, api, ctx, answers, vetted)) return;
  result.cvsRequirement = cvs;
}

function setUnclassifiedCvs(result, api, ctx, answers, vetted = false) {
  if (setMecomedCvs(result, api, ctx, answers, vetted)) return;
  result.cvsRequirement = ctx.virtual ? 'none' : 'unknown';
  if (ctx.inArea && answers.audience === 'other') api.reason('audienceUnclassified', null, ['annex1', 'cvsGuidance']);
}

function assessExpenses(answers, ctx, api, result, context) {
  const expenses = Array.isArray(answers.expenses) ? answers.expenses : null;
  if (!expenses) return;
  if (!expenses.length) {
    api.missing({ id: 'expensesNeeded' });
    return;
  }
  const yes = (value) => value === 'yes';
  const no = (value) => value === 'no';
  const byAnswer = (value, reason) => {
    if (yes(value)) return ['allowed', reason];
    if (no(value)) return ['not-allowed', reason];
    return ['check', reason];
  };
  const assess = (expense) => {
    // Nobody travels, stays or eats at the company's expense to take part online.
    if (ctx.virtual && (expense === 'travel' || expense === 'accommodation')) return ['not-allowed', 'expVirtualTravel'];
    if (ctx.virtual && expense === 'meals') return ['not-allowed', 'expVirtualHospitality'];
    switch (context) {
      case 'tppt-delegate':
        return expense === 'fee' ? ['not-allowed', 'expFeeNoServices'] : ['allowed', 'expTpptAllowed'];
      case 'tppt-changed':
        return [expense === 'registration' ? 'allowed' : 'not-allowed', 'expChangedTppt'];
      case 'satellite':
        if (expense === 'fee') return ['allowed', 'expFeeServices'];
        if (expense === 'registration') return byAnswer(answers.accessRequired, 'expRegistrationAccess');
        if (expense === 'travel' || expense === 'accommodation') {
          if (yes(answers.grantCoversAttendance)) return ['not-allowed', 'expGrantDuplicate'];
          if (no(answers.grantCoversAttendance)) return ['allowed', 'expGrantDuplicate'];
          return ['check', 'expGrantDuplicate'];
        }
        if (yes(answers.grantCoversAttendance)) return ['check', 'expGrantHospitality'];
        return no(answers.grantCoversAttendance) ? ['allowed', 'expServices'] : ['check', 'expGrantHospitality'];
      case 'company-delegate':
        return expense === 'fee' ? ['not-allowed', 'expFeeNoServices'] : ['allowed', 'expAllowed'];
      case 'business-delegate':
        if (expense === 'fee') return ['not-allowed', 'expFeeNoServices'];
        if (expense === 'travel' || expense === 'accommodation') return byAnswer(answers.nonPortable, 'expNonPortable');
        return ['allowed', 'expAllowed'];
      case 'services-overlap':
        if (expense === 'fee') return ['allowed', 'expFeeServices'];
        if (expense === 'registration') return ['not-allowed', 'expIncrementalRegistration'];
        if (yes(answers.incrementalCosts)) return ['not-allowed', 'expIncremental'];
        return no(answers.incrementalCosts) ? ['allowed', 'expIncremental'] : ['check', 'expIncremental'];
      default: // services, and Faculty at a procedure training
        return expense === 'fee' ? ['allowed', 'expFeeServices'] : ['allowed', 'expServices'];
    }
  };
  for (const expense of EXPENSE_ORDER.filter((item) => expenses.includes(item))) {
    const [state, reason] = assess(expense);
    result.expenses.push({ id: expense, state, reason });
  }
  if (result.expenses.some((expense) => expense.state === 'not-allowed')) api.prohibit('expensesRemove');
  if (context === 'satellite' && yes(answers.grantCoversAttendance) && expenses.includes('meals')) {
    api.review('speakerGrantHospitality', null, 'companyAtTpoe');
  }
}

// Direct support of Delegates, or of Faculty in the Event's own programme: not allowed at a
// Third Party Organised Educational Conference, allowed at a qualifying procedure training.
function assessDirectSupport(data, answers, ctx, api, result) {
  const row = ctx.role === 'delegate' ? 'direct-delegate' : 'direct-faculty';
  const banned = () => {
    if (ctx.virtual) api.prohibit('virtualNoDirect', null, ['virtualEvents', 'virtualGuidance'], 'rule');
    api.prohibit('directSponsorshipBan', null, ['conferences', 'annex6'], 'rule');
    quoteAnnex1(data, api, ctx, row, annex1Column(ctx, answers));
    quoteAnnex6(data, api, 'conference', ctx.role);
    result.cvsRequirement = 'none';
  };
  if (ctx.eventType === 'conference') {
    if (answers.facultyRole === 'poster') api.reason('posterIsDelegate', null, ['annex6Definitions', 'glossary']);
    banned();
    return;
  }
  // A procedure training.
  api.addSources(['tppt', 'tpptCriteria']);
  if (ctx.virtual) {
    api.reason('tpptVirtual', null, 'tpptCriteria');
    banned();
    return;
  }
  const qualification = getTpptQualification(answers);
  result.tppt = qualification;
  if (qualification.state === 'failed') {
    api.reason('tpptNotQualified', null, 'tpptCriteria');
    banned();
    return;
  }
  if (qualification.state === 'changed') {
    api.reason('tpptChanged', null, 'tppt');
    if (ctx.role === 'faculty') {
      banned();
      return;
    }
  } else {
    if (qualification.state === 'qualified') {
      api.reason(ctx.role === 'delegate' ? 'tpptQualifiedDelegate' : 'tpptQualifiedFaculty', null, ['tppt', 'tpptCriteria']);
    } else {
      api.missing({ id: 'tpptUnknown' });
    }
    quoteAnnex6(data, api, 'tppt', ctx.role);
    api.reason('tpptCompanyCheck', null, 'tpptGuidance');
  }
  // Cross-border and international procedure trainings are submitted to CVS.
  const column = annex1Column(ctx, answers);
  if (column === 0) setCvsRequirement(result, api, ctx, answers, 'none', true);
  else if (column === 1 || column === 2) {
    api.reason('tpptCvs', null, 'tpptGuidance');
    setCvsRequirement(result, api, ctx, answers, 'required');
  } else setUnclassifiedCvs(result, api, ctx, answers, true);
  api.allow();
  let context = 'services';
  if (qualification.state === 'changed') context = 'tppt-changed';
  else if (ctx.role === 'delegate') context = 'tppt-delegate';
  assessExpenses(answers, ctx, api, result, context);
}

function assessSatelliteSpeaker(data, answers, ctx, api, result) {
  const column = annex1Column(ctx, answers);
  api.reason('satelliteRules', null, ['conferences', 'companyAtTpoe']);
  quoteAnnex6(data, api, 'satellite', 'faculty');
  quoteAnnex1(data, api, ctx, 'satellite', column);
  const cell = annex1Cell(data, 'satellite', column);
  const vetted = vettedByCvs(data, 'satellite');
  if (cell && column !== 3) setCvsRequirement(result, api, ctx, answers, cell.cvs, vetted);
  else setUnclassifiedCvs(result, api, ctx, answers, vetted);
  api.allow();
  assessExpenses(answers, ctx, api, result, 'satellite');
}

function assessGrant(data, answers, ctx, api, result) {
  const id = ctx.activity.id;
  if (answers.recipient === 'individual') {
    api.prohibit('grantToIndividual', null, ['grantsGeneral', 'tppt']);
    return;
  }
  if (answers.recipient === 'agency') {
    api.prohibit('grantToTravelAgency', null, 'educationalGrants');
    return;
  }
  if (answers.recipient === 'patient') {
    api.outside('grantToPatientOrg', 'grantsGeneral');
    return;
  }
  if (answers.recipient === 'pco') api.reason('grantToPco', null, 'educationalGrants');
  if (answers.paymentRoute === 'personal') api.prohibit('personalAccount', null, 'grantsGeneral');
  if (answers.packageMixed === 'yes') api.review('grantPackageSplit', null, 'educationalGrants');
  if (ctx.eventType === 'tppt') api.reason('tpptQualifiedGrant', null, 'tppt');
  const column = annex1Column(ctx, answers);
  let cell = annex1Cell(data, id, column);
  if (column === 3) {
    // Annex I, footnotes 3 and 5: a recipient in the Area brings the grant within the Code,
    // without a CVS decision.
    cell = null;
    if (answers.recipientInArea === 'yes') {
      api.reason('recipientInAreaApplies', null, 'annex1Footnotes');
      if (!ctx.virtual) api.reason(id === 'grant-attendance' ? 'beneficiariesNotInArea' : 'noAreaHcpsNoCvs', null, 'annex1Footnotes');
      cell = { permission: 'conditional', cvs: 'none' };
    }
  } else {
    // A Virtual Event is outside CVS: HCPs from the Area bring the grant within the Code, nothing more.
    if (column === 2 && id === 'grant-attendance') {
      if (ctx.virtual) api.reason('virtualGrantAttendance', null, 'scope');
      else api.reason('beneficiariesInArea', null, 'annex1Footnotes');
    }
    quoteAnnex1(data, api, ctx, id, column);
  }
  const vetted = vettedByCvs(data, id);
  if (cell) setCvsRequirement(result, api, ctx, answers, cell.cvs, vetted);
  else setUnclassifiedCvs(result, api, ctx, answers, vetted);
  api.allow();
}

function assessBooth(data, answers, ctx, api, result) {
  if (answers.packageEducation === 'yes') api.review('boothPackageSplit', null, 'educationalGrants');
  const column = annex1Column(ctx, answers);
  quoteAnnex1(data, api, ctx, 'booth', column);
  if (column === 3 && ctx.virtual) {
    // A Virtual Event is outside CVS and is not an Event held outside the Area: the Code applies
    // through the organiser in the Area (Annex I, footnote 5).
    if (answers.recipientInArea === 'yes') api.reason('recipientInAreaApplies', null, 'annex1Footnotes');
    result.cvsRequirement = 'none';
    api.allow();
    return;
  }
  if (column === 3) {
    api.review('boothOutsideReview', null, 'annex1');
    result.cvsRequirement = 'internal';
    return;
  }
  const cell = annex1Cell(data, 'booth', column);
  const vetted = vettedByCvs(data, 'booth');
  if (cell) setCvsRequirement(result, api, ctx, answers, cell.cvs, vetted);
  else setUnclassifiedCvs(result, api, ctx, answers, vetted);
  api.allow();
}

function assessInKind(data, answers, ctx, api, result) {
  const types = Array.isArray(answers.inKindType) ? answers.inKindType : [];
  api.reason('inKindAllowed', null, 'tppt');
  if (types.includes('money')) api.prohibit('inKindMoney', null, 'tppt');
  if (answers.identifiableAttendance === 'yes') {
    if (ctx.eventType === 'conference') api.prohibit('inKindIdentifiable', null, ['conferences', 'tppt']);
    else api.review('inKindTpptAttendance', null, 'tppt');
  }
  // For CVS, In Kind support to the Event is treated like support for its general running.
  const column = annex1Column(ctx, answers);
  const cell = annex1Cell(data, 'grant-running', column);
  const vetted = vettedByCvs(data, 'grant-running');
  if (cell && column !== 3) {
    if (cell.cvs === 'required' && !ctx.virtual) api.reason('inKindCvs', null, ['cvs', 'annex1']);
    setCvsRequirement(result, api, ctx, answers, cell.cvs, vetted);
  } else setUnclassifiedCvs(result, api, ctx, answers, vetted);
  api.allow();
}

function assessThirdPartyEvent(data, answers, ctx, api, result) {
  const id = ctx.activity.id;
  if (answers.format === 'hybrid') api.reason('hybridIsInPerson', null, 'glossary');
  if (ctx.virtual) api.reason('virtualNoCvs', null, ['virtualEvents', 'virtualGuidance']);
  if (id === 'company-attendance') {
    api.review('companyAttendanceReview', null, 'conferences');
    if (!ctx.virtual) api.reason('annex1AllColumns', { text: data.annex1Text[id][0] }, 'annex1');
    result.cvsRequirement = 'internal';
    return;
  }
  if (ctx.satelliteSpeaker) assessSatelliteSpeaker(data, answers, ctx, api, result);
  else if (id === 'direct-delegate' || id === 'direct-faculty') assessDirectSupport(data, answers, ctx, api, result);
  else if (GRANTS.includes(id)) assessGrant(data, answers, ctx, api, result);
  else if (id === 'booth') assessBooth(data, answers, ctx, api, result);
  else if (id === 'in-kind') assessInKind(data, answers, ctx, api, result);
}

function assessCompanyEvent(data, answers, ctx, api, result) {
  const { eventType, role } = ctx;
  const overlap = answers.overlap === 'yes';
  result.cvsRequirement = 'none';
  api.addSources('companyEvents');
  if (eventType === 'company-services') {
    api.reason('servicesAllowed', null, ['consultingFees', 'companyAtTpoe']);
    if (overlap) api.reason('servicesOverlap', null, 'companyAtTpoe');
    api.allow();
    if (isKnown(answers.overlap)) assessExpenses(answers, ctx, api, result, overlap ? 'services-overlap' : 'services');
    return;
  }
  if (!isKnown(answers.overlap)) return;
  const setting = `${eventType}${overlap ? '-overlap' : ''}`;
  quoteAnnex6(data, api, setting, role);
  if (role === 'delegate') {
    if (data.directSupportMatrix[setting].delegate === 'prohibited') {
      api.prohibit('companyDelegateOverlap', null, 'companyAtTpoe', 'rule');
      return;
    }
    if (eventType === 'company-training') api.reason('companyDelegateAllowed', null, 'companyTraining');
    else api.reason('businessDelegate', null, ['businessMeetings', 'transparency']);
    api.allow();
    assessExpenses(answers, ctx, api, result, eventType === 'company-business' ? 'business-delegate' : 'company-delegate');
    return;
  }
  api.reason('servicesAllowed', null, ['consultingFees', 'eventsGeneral']);
  if (overlap) api.reason('servicesOverlap', null, 'companyAtTpoe');
  api.allow();
  assessExpenses(answers, ctx, api, result, overlap ? 'services-overlap' : 'services');
}

function assessOtherInteraction(answers, ctx, api, result) {
  result.cvsRequirement = 'none';
  switch (ctx.activity.id) {
    case 'meal':
      if (answers.overlap === 'yes') {
        api.reason('mealAtTpoe', null, 'companyAtTpoe');
        if (answers.mealGrantHospitality === 'yes') api.review('mealGrantHospitality', null, 'companyAtTpoe');
      } else {
        api.reason('mealGeneral', null, ['hospitality', 'transparency']);
      }
      break;
    case 'items':
      api.reason('items', null, 'items');
      break;
    case 'demos':
      if (answers.demoKind === 'demo') {
        if (answers.demoClinicalUse === 'yes') api.prohibit('demoClinicalUse', null, ['demos', 'samples']);
        else api.reason('demosAllowed', null, 'demos');
      }
      if (answers.demoKind === 'sample') api.reason('samplesAllowed', null, 'samples');
      break;
    case 'proctorship':
      api.reason('proctorshipNoCvs', null, ['tppt', 'glossary', 'consultingCriteria']);
      if (answers.proctorshipSetting === 'no') api.review('proctorshipElsewhere', null, 'tppt');
      break;
    case 'donation':
      api.reason('donationAllowed', null, 'donations');
      if (answers.donationRecipient === 'hcp-charity') api.prohibit('donationHcpCharity', null, 'donations', 'rule');
      if (answers.donationRecipient === 'hco') api.review('donationHco', null, 'donations');
      if (answers.fundraiserHcps === 'yes') api.prohibit('fundraiserHcps', null, 'donations');
      break;
    default:
      break;
  }
  api.allow();
}

function isAnswered(question, answers) {
  const value = answers[question.id];
  if (question.type === 'agenda') {
    const agenda = calculateTpptEligibility(answers.sessions || []);
    return agenda.valid && agenda.total > 0;
  }
  if (question.type === 'multi') {
    return Array.isArray(value) && value.every((item) => question.options.some(([option]) => option === item));
  }
  return isKnown(value) && question.options.some(([option]) => option === value);
}

/**
 * The Code's position from the answers alone, before the Event's CVS status and the conditions
 * are taken into account.
 */
export function assessProposal(data, answers) {
  const ctx = getContext(data, answers);
  const result = createResult(data, answers);
  const api = createApi(result);
  result.context = ctx;
  const { activity } = ctx;
  if (!activity) {
    api.missing({ id: 'missingActivity' });
    return result;
  }
  api.addSources(activity.sources);
  if (activity.id === 'research') {
    result.permission = 'handoff';
    api.reason('research', null, ['research', 'royalties']);
    return result;
  }
  if (answers.member === 'no') {
    api.outside('notMember', ['scope', 'transposition']);
    return result;
  }
  if (isOutsideScope(ctx, answers)) {
    const perHcp = ctx.eventActivity && (ctx.role !== null || ctx.satelliteSpeaker) && !ctx.company;
    api.outside(perHcp ? 'outsideSupportedHcp' : 'outsideArea', ['scope', 'annex1Footnotes', 'geography']);
    return result;
  }
  if (!ctx.eventActivity) assessOtherInteraction(answers, ctx, api, result);
  else if (ctx.eventType && ctx.eventType !== 'unknown') {
    if (ctx.thirdParty) assessThirdPartyEvent(data, answers, ctx, api, result);
    else assessCompanyEvent(data, answers, ctx, api, result);
  }
  for (const question of getEventQuestions(data, answers)) {
    if (!isAnswered(question, answers)) api.missing({ question: question.id });
  }
  api.addSources('scope');
  return result;
}

function conditionTags(data, answers, result) {
  const tags = new Set();
  const ctx = result.context;
  if (!ctx?.activity || ['prohibited', 'outside', 'handoff'].includes(result.permission)) return tags;
  const id = ctx.activity.id;
  const expenses = Array.isArray(answers.expenses) ? answers.expenses : [];
  tags.add('all');
  if (ctx.eventActivity && id !== 'company-attendance') {
    tags.add('eventSupport');
    if (!ctx.virtual) tags.add('inPersonEvent');
  }
  if (id === 'meal') tags.add('meal').add('hospitality');
  if (expenses.includes('travel')) tags.add('travel');
  if (expenses.includes('accommodation') || expenses.includes('meals')) tags.add('hospitality');
  const consulting = ctx.satelliteSpeaker
    || (id === 'direct-faculty' && ctx.role === 'faculty')
    || id === 'proctorship'
    || (id === 'in-kind' && answers.inKindType?.includes('speakers'));
  if (consulting) tags.add('consulting').add('employerNotification');
  if (id === 'direct-delegate' && (ctx.tpptDirect || ctx.company)) tags.add('employerNotification');
  if (GRANTS.includes(id) || id === 'donation') tags.add('funding');
  if (GRANTS.includes(id)) {
    tags.add('grant');
    tags.add(id === 'grant-attendance' ? 'grantAttendance' : 'grantOrganiser');
    if (answers.recipient === 'pco') tags.add('pco');
    if (answers.paymentRoute === 'agency') tags.add('travelAgency');
  }
  if (id === 'booth') tags.add('commercial');
  if (id === 'company-attendance') tags.add('staff');
  if (ctx.eventType === 'company-training') {
    tags.add('companyTraining');
    if (!ctx.virtual) tags.add('companyVenue');
  }
  if (ctx.eventType === 'company-business') tags.add('companyBusiness');
  if ((id === 'meal' && answers.overlap === 'yes')
    || (ctx.company && answers.overlap === 'yes' && expenses.includes('meals'))) tags.add('mealAtTpoe');
  if (id === 'items') tags.add('items');
  if (id === 'demos' || (id === 'in-kind' && answers.inKindType?.includes('products'))) tags.add('products');
  if (id === 'demos' && answers.demoKind !== 'demo') tags.add('samples');
  if (id === 'donation') tags.add('donation');
  if (id === 'in-kind') tags.add('inKind');
  if (answers.intermediary === 'yes') tags.add('intermediary');
  return tags;
}

/**
 * The Code requirements that apply to the proposal, from the answers alone.
 */
export function getApplicableConditions(data, answers, proposal = assessProposal(data, answers)) {
  const tags = conditionTags(data, answers, proposal);
  return data.conditions.filter((condition) => condition.appliesTo.some((tag) => tags.has(tag)));
}

// A Compliant CVS decision is binding on all Member Companies and settles the Event's own
// criteria, so those conditions are not asked again.
const coveredByCvs = (condition, ctx, cvsState) => Boolean(condition.coveredByCvs && ctx?.thirdParty && !ctx.virtual && cvsState === 'positive');

export function getConditionQuestions(data, answers, evidence = null) {
  const proposal = assessProposal(data, answers);
  const evaluated = evaluateEventSupport(data, answers, evidence);
  // Nothing more to confirm once a binding CVS decision rules the support out.
  if (evaluated.permission === 'prohibited' && evaluated.blocking === 'rule') return [];
  const cvsState = evaluated.cvsState;
  return getApplicableConditions(data, answers, proposal)
    .filter((condition) => !coveredByCvs(condition, proposal.context, cvsState))
    .map((condition) => ({ ...condition, type: 'choice', options: CONDITION_OPTIONS }));
}

function applyCvsEvidence(data, answers, result, api, evidence) {
  const ctx = result.context;
  const id = ctx?.activity?.id;
  if (!ctx?.thirdParty || ctx.virtual || ['outside', 'handoff'].includes(result.permission)) return;
  if (result.permission === 'prohibited' && result.blocking === 'rule') return;
  result.cvsRelevant = true;
  result.evidence = evidence || null;
  if (!evidence) {
    if (result.cvsRequirement === 'required') api.reason('cvsMissing', null, ['cvs', 'cvsGuidance']);
    if (result.cvsRequirement === 'required' && GRANTS.includes(id)) api.reason('grantPreCondition', null, 'educationalGrants');
    return;
  }
  const state = classifyCvsStatus(data, evidence.status?.raw);
  const params = { status: evidence.status.raw };
  result.cvsState = state;
  const decision = ['positive', 'negative', 'not-pre-cleared'].includes(state);

  // A CVS decision binds through Annex I (Q&A 16): support that Annex I does not make subject to
  // a CVS decision is not ruled out by a negative one, but the answer says why to look closer.
  if (!['required', 'mecomed', 'unknown'].includes(result.cvsRequirement)) {
    if (id === 'company-attendance' && ['negative', 'not-pre-cleared'].includes(state)) {
      api.review('cvsNegativeAttendance', params, ['conferences', 'cvs']);
    } else if (state === 'negative') api.reason('cvsNegativeNotNeeded', params, ['annex1', 'cvs']);
    else if (state === 'not-pre-cleared') api.reason('cvsNotPreClearedNotNeeded', null, ['annex1', 'cvsGuidance']);
    else if (state === 'positive') api.reason('cvsPositive', null, 'cvs');
    return;
  }

  // A decision settles an audience Annex I does not classify, and Mecomed's vetting: CVS has decided.
  if (decision && result.cvsRequirement !== 'required') {
    result.cvsRequirement = 'required';
    result.reasons = result.reasons.filter((reason) => reason.id !== 'audienceUnclassified');
  }
  if (state === 'positive') {
    api.reason('cvsPositive', null, 'cvs');
    return;
  }
  if (state === 'negative') {
    api.prohibit('cvsNegativeBinding', params, 'cvs', 'rule');
    return;
  }
  if (state === 'not-pre-cleared') {
    api.prohibit('cvsNotPreCleared', null, ['cvs', 'cvsGuidance'], 'rule');
    return;
  }
  if (result.cvsRequirement === 'unknown') return;
  if (state === 'not-assessed') api.prohibit('cvsNotAssessed', params, ['cvs', 'cvsGuidance'], 'rule');
  else if (state === 'exempt') api.review('cvsScopeDisagrees', params, ['annex1', 'cvsGuidance']);
  else if (state === 'pre-cleared') api.reason('cvsPreCleared', null, 'cvsGuidance');
  else if (state === 'pending') api.reason('cvsPending', params, 'cvs');
  else api.reason('cvsUnrecognised', params, 'cvsGuidance');
  if (GRANTS.includes(id) && state !== 'not-assessed') api.reason('grantPreCondition', null, 'educationalGrants');
}

function applyConditions(data, answers, result, api, proposal) {
  if (result.permission === 'prohibited' && result.blocking === 'rule') return;
  const ctx = result.context;
  let notMet = false;
  let needsReview = false;
  for (const condition of getApplicableConditions(data, answers, proposal)) {
    const covered = coveredByCvs(condition, ctx, result.cvsState);
    const answer = covered ? 'covered' : (isKnown(answers[condition.id]) ? answers[condition.id] : 'unknown');
    result.conditions.push({ id: condition.id, label: condition.label, sources: condition.sources, answer });
    api.addSources(condition.sources);
    if (answer === 'no' && condition.failure === 'prohibited') notMet = true;
    if (answer === 'no' && condition.failure === 'review') needsReview = true;
  }
  if (notMet) api.prohibit('conditionsNotMet');
  if (needsReview) api.review('conditionsNeedReview');
}

function applyWarnings(data, answers, result, evidence) {
  const ctx = result.context;
  if (!ctx || ['prohibited', 'outside', 'handoff'].includes(result.permission)) return;
  const warning = getCvsScopeWarning(data, ctx, answers, evidence);
  if (warning) result.warnings.push(warning);
}

function finish(result) {
  result.sources = [...new Set(result.sources)];
  const conditionsConfirmed = result.conditions.every((condition) => ['yes', 'covered'].includes(condition.answer));
  const cvsSatisfied = ['none', 'internal'].includes(result.cvsRequirement)
    || (result.cvsRequirement === 'required' && result.cvsState === 'positive');
  if (result.permission === 'prohibited') {
    result.outcome = result.blocking === 'rule' ? 'not-permitted' : 'not-permitted-as-proposed';
  } else if (result.permission === 'outside') result.outcome = 'outside';
  else if (result.permission === 'handoff') result.outcome = 'handoff';
  else if (result.cvsRequirement === 'required' && result.cvsState !== 'positive') result.outcome = 'cvs-needed';
  else if (result.missing.length) result.outcome = 'more-info';
  else if (result.permission === 'review' || result.permission === null || result.warnings.length
    || ['unknown', 'mecomed'].includes(result.cvsRequirement)) result.outcome = 'review';
  else result.outcome = conditionsConfirmed ? 'permitted-confirmed' : 'permitted';
  result.ready = result.outcome === 'permitted-confirmed' && cvsSatisfied;
  return result;
}

/**
 * The full assessment: the answers, the Event's live CVS status (for a third-party Event) and
 * the answers to the conditions.
 */
export function evaluateEventSupport(data, answers, evidence = null) {
  const proposal = assessProposal(data, answers);
  const result = { ...proposal, reasons: [...proposal.reasons], missing: [...proposal.missing], sources: [...proposal.sources], expenses: [...proposal.expenses] };
  const api = createApi(result);
  applyCvsEvidence(data, answers, result, api, evidence);
  applyConditions(data, answers, result, api, proposal);
  applyWarnings(data, answers, result, evidence);
  return finish(result);
}

/**
 * Records one answer and drops the answers that no longer apply. Choosing another activity keeps
 * the facts about the Event and clears the answers that belong to the previous proposal.
 */
export function updateEventAnswer(data, answers, key, value) {
  const next = { ...answers, [key]: value };
  if (key === 'activity') {
    for (const id of ACTIVITY_ANSWERS) delete next[id];
    for (const condition of data.conditions) delete next[condition.id];
    const activity = getActivity(data, value);
    // A kind of Event implied by the previous activity (a satellite symposium is always at a
    // conference) is kept as an answer when the new activity asks for it.
    const implied = getEventType(data, answers);
    if (!next.eventType && implied && implied !== 'unknown') next.eventType = implied;
    if (next.eventType && !activity?.eventTypes.includes(next.eventType)) delete next.eventType;
  }
  const kept = new Set([
    'activity',
    ...SHARED_FACTS,
    ...getQuestionIds(data, next),
    ...getApplicableConditions(data, next).map((condition) => condition.id),
  ]);
  for (const id of Object.keys(next)) if (!kept.has(id)) delete next[id];
  return next;
}
