import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';

import { generateSectionId } from '../src/utils/textUtils.js';
import {
  createReferenceIndex,
  findCrossReferences,
  resolveTreeReference,
} from '../src/utils/crossReferences.js';
import { tokenizeAllWithOffsets, tokenizeWords } from '../src/utils/searchText.js';
import { CONDITION_TAGS } from '../src/utils/eventSupportRules.js';
import { normalizeCvsStatus } from '../src/utils/eventSupportCvs.js';
import { TREE_CVS_MODES, TREE_CVS_TONES } from '../src/utils/treeCvs.js';
import { loadSplitCodeData } from './lib/code-content.mjs';
import { loadTransparencyData } from './lib/transparency-content.mjs';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(SCRIPT_DIR, '..');

const ALLOWED_PARTS = new Set(['intro', 'part1', 'part2', 'part3', 'website']);
const ALLOWED_OUTCOMES = new Set([
  'compliant',
  'non-compliant',
  'conditional',
  'consult-legal',
  'not-required',
  'out-of-scope',
  'not-applicable',
  'prior-review',
  'in-scope',
  'more-info',
]);

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

// A decision tree's texts for the live CVS check under its results (see src/utils/treeCvs.js).
function validateTreeCvsCheck(cvsCheck, path, errors) {
  if (!cvsCheck || typeof cvsCheck !== 'object' || Array.isArray(cvsCheck)) {
    errors.push(`${path}: expected an object.`);
    return;
  }
  if (!isNonEmptyString(cvsCheck.title)) errors.push(`${path}: missing title.`);
  for (const key of Object.keys(cvsCheck)) {
    if (key !== 'title' && !TREE_CVS_MODES.includes(key)) errors.push(`${path}: unknown mode "${key}".`);
  }
  for (const mode of TREE_CVS_MODES) {
    const settings = cvsCheck[mode];
    if (settings === undefined) continue;
    const modePath = `${path}.${mode}`;
    if (!isNonEmptyString(settings?.intro)) errors.push(`${modePath}: missing intro.`);
    if (!isNonEmptyString(settings?.otherStatus)) errors.push(`${modePath}: missing otherStatus.`);
    if (settings?.noMatch !== undefined && !isNonEmptyString(settings.noMatch)) errors.push(`${modePath}: noMatch must be text.`);
    if (!Array.isArray(settings?.statuses)) {
      errors.push(`${modePath}: expected a statuses array.`);
      continue;
    }
    const seen = new Set();
    settings.statuses.forEach((entry, index) => {
      const entryPath = `${modePath}.statuses[${index}]`;
      if (!Array.isArray(entry?.labels) || !entry.labels.length || !entry.labels.every(isNonEmptyString)) {
        errors.push(`${entryPath}: expected a non-empty list of CVS status labels.`);
      } else {
        for (const label of entry.labels) {
          const key = normalizeCvsStatus(label);
          if (seen.has(key)) errors.push(`${entryPath}: status "${label}" is listed twice.`);
          seen.add(key);
        }
      }
      if (!isNonEmptyString(entry?.text)) errors.push(`${entryPath}: missing text.`);
      if (entry?.tone !== undefined && !TREE_CVS_TONES.includes(entry.tone)) {
        errors.push(`${entryPath}: unsupported tone "${entry.tone}".`);
      }
    });
  }
}

function findDuplicates(values) {
  const seen = new Set();
  const duplicates = new Set();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates];
}

// Independent of either search corpus: hyphens, apostrophes and spaces have the same token
// boundary for phrase matching. Stemming is deliberately excluded because it needs a corpus.
const phraseSourceKey = (phrase) => tokenizeAllWithOffsets(phrase)
  .map((token) => token.word).join(' ');

function validatePhrasebookPhrase(phrase, path, errors) {
  if (typeof phrase !== 'string') {
    errors.push(`${path}: must be a string.`);
    return false;
  }

  if (phrase !== phrase.trim()) {
    errors.push(`${path}: must be equal to its trimmed form.`);
    return false;
  }

  if (!/^[a-z]+(?:[ '-][a-z]+)*$/.test(phrase)) {
    errors.push(`${path}: must be lowercase letters, spaces, hyphens or apostrophes only.`);
    return false;
  }

  const words = tokenizeAllWithOffsets(phrase).length;
  if (words < 1 || words > 4) {
    errors.push(`${path}: must be 1 to 4 words.`);
    return false;
  }

  if (tokenizeWords(phrase).length === 0) {
    errors.push(`${path}: must contain at least one content word (not only stopwords).`);
    return false;
  }

  return true;
}

// Checks a phrase list and returns its valid phrases, reporting format errors and repeats.
function validatePhrasebookList(group, key, groupPath, errors) {
  const phrases = [];
  const seen = new Map();
  group[key].forEach((phrase, phraseIndex) => {
    if (validatePhrasebookPhrase(phrase, `${groupPath} ${key}[${phraseIndex}]`, errors)) {
      phrases.push(phrase);
      const normalized = phraseSourceKey(phrase);
      if (seen.has(normalized)) {
        errors.push(`${groupPath}: "${key}" contains duplicate phrase "${phrase}" (same source as "${seen.get(normalized)}").`);
      } else {
        seen.set(normalized, phrase);
      }
    }
  });
  return phrases;
}

// The search phrasebook is general English, so only its structure is checked here. Whether its
// words appear in the Code is deliberately never checked: it must keep working, unedited, when
// the Code changes. Returns the number of groups.
function validateSearchPhrasebook(phrasebook, errors) {
  const phrasebookPath = 'phrasebook.json';

  if (typeof phrasebook !== 'object' || phrasebook === null || Array.isArray(phrasebook)) {
    errors.push(`${phrasebookPath}: must be an object.`);
    return 0;
  }
  if (Object.keys(phrasebook).length !== 1 || !Array.isArray(phrasebook.groups)) {
    errors.push(`${phrasebookPath}: must have exactly one key "groups" containing an array.`);
    return 0;
  }

  const fromGroupByPhrase = new Map();
  const samePhrases = new Set();
  const sourceGroupByPhrase = new Map();
  const checkSource = (phrase, groupIndex, groupPath) => {
    const key = phraseSourceKey(phrase);
    const prior = sourceGroupByPhrase.get(key);
    if (prior && prior.groupIndex !== groupIndex) {
      errors.push(`${groupPath}: source phrase "${phrase}" also appears in groups[${prior.groupIndex}] as "${prior.phrase}" after normalization.`);
    } else if (!prior) {
      sourceGroupByPhrase.set(key, { groupIndex, phrase });
    }
  };

  phrasebook.groups.forEach((group, groupIndex) => {
    const groupPath = `${phrasebookPath} groups[${groupIndex}]`;
    if (typeof group !== 'object' || group === null || Array.isArray(group)) {
      errors.push(`${groupPath}: must be an object.`);
      return;
    }

    const keys = Object.keys(group).sort().join(',');
    if ('same' in group && ('from' in group || 'to' in group)) {
      errors.push(`${groupPath}: cannot mix "same" with "from"/"to".`);
    } else if (keys === 'same') {
      if (!Array.isArray(group.same) || group.same.length < 2) {
        errors.push(`${groupPath}: "same" must be an array of at least 2 phrases.`);
        return;
      }
      for (const phrase of validatePhrasebookList(group, 'same', groupPath, errors)) {
        const key = phraseSourceKey(phrase);
        if (samePhrases.has(key)) {
          errors.push(`${groupPath}: "same" phrase "${phrase}" appears in more than one "same" group.`);
        }
        samePhrases.add(key);
        checkSource(phrase, groupIndex, groupPath);
      }
    } else if (keys === 'from,to') {
      if (!Array.isArray(group.from) || group.from.length === 0) {
        errors.push(`${groupPath}: "from" must be a non-empty array.`);
      }
      if (!Array.isArray(group.to) || group.to.length === 0) {
        errors.push(`${groupPath}: "to" must be a non-empty array.`);
      }
      if (!Array.isArray(group.from) || !Array.isArray(group.to)) return;

      const fromPhrases = validatePhrasebookList(group, 'from', groupPath, errors);
      const toPhrases = validatePhrasebookList(group, 'to', groupPath, errors);
      for (const phrase of fromPhrases) {
        const key = phraseSourceKey(phrase);
        if (fromGroupByPhrase.has(key)) {
          errors.push(`${groupPath}: "from" phrase "${phrase}" also appears in groups[${fromGroupByPhrase.get(key)}].`);
        } else {
          fromGroupByPhrase.set(key, groupIndex);
        }
        checkSource(phrase, groupIndex, groupPath);
        if (toPhrases.some((target) => phraseSourceKey(target) === key)) {
          errors.push(`${groupPath}: "from" phrase "${phrase}" also appears in "to".`);
        }
      }
    } else {
      errors.push(`${groupPath}: must have either "same" or both "from" and "to", and no other keys.`);
    }
  });

  return phrasebook.groups.length;
}

// References such as "Chapter 4" or "Section 3 of Chapter 4" become links when the text is
// displayed. A reference to something that does not exist is an error (a typo in the text or a
// numbering the linker does not know). One whose section is missing still links to its chapter
// and is reported as a note, because the published text itself says so.
function validateCrossReferences({ chapters, transparencyDocuments, trees }, errors, warnings) {
  const isWellFormed = (unit) => isNonEmptyString(unit?.id) && Array.isArray(unit.sections);
  const codeChapters = chapters.filter((chapter) => isWellFormed(chapter) && chapter.part !== 'website');
  const documents = transparencyDocuments
    .filter((document) => isNonEmptyString(document?.id) && Array.isArray(document.units))
    .map((document) => ({ ...document, units: document.units.filter(isWellFormed) }));
  const index = createReferenceIndex({ codeChapters, transparencyDocuments: documents });
  let linked = 0;

  const check = (html, context, path) => {
    if (!isNonEmptyString(html)) return;
    for (const reference of findCrossReferences(html, { index, context })) {
      if (reference.status === 'linked') linked += 1;
      if (reference.status === 'fallback') {
        linked += 1;
        warnings.push(`${path}: "${reference.text}": ${reference.note}.`);
      }
      if (reference.status === 'unresolved') {
        errors.push(`${path}: "${reference.text}" does not match anything (${reference.note}).`);
      }
    }
  };
  const checkUnit = (unit, context, unitPath) => {
    unit.sections.forEach((section, sectionIndex) => {
      const sectionPath = `${unitPath} sections[${sectionIndex}]`;
      check(section?.legalText, context, sectionPath);
      asArray(section?.qas).forEach((qa, qaIndex) => {
        check(qa?.q, context, `${sectionPath} qas[${qaIndex}] q`);
        check(qa?.a, context, `${sectionPath} qas[${qaIndex}] a`);
      });
    });
  };

  codeChapters.forEach((chapter) => {
    checkUnit(chapter, { publication: 'code', unitId: chapter.id }, `Code chapter "${chapter.id}"`);
  });
  documents.forEach((document) => {
    document.units.forEach((unit) => {
      checkUnit(
        unit,
        { publication: 'transparency', documentId: document.id, unitId: unit.id },
        `Transparency "${document.id}" unit "${unit.id}"`,
      );
    });
  });
  trees.forEach((tree, treeIndex) => {
    asArray(tree?.nodes).forEach((node, nodeIndex) => {
      if (!isNonEmptyString(node?.reference)) return;
      if (!resolveTreeReference(node.reference, index)) {
        errors.push(
          `treeData.json trees[${treeIndex}] nodes[${nodeIndex}]: reference "${node.reference}" does not match a Code chapter, annex, section or Q&A.`,
        );
      }
    });
  });

  return linked;
}

const EVENT_SUPPORT_CVS_STATUS_LISTS = ['exempt', 'positive', 'negative', 'notAssessed', 'preCleared', 'pending'];
const EVENT_SUPPORT_ANNEX1_ROWS = [
  'grant-running', 'grant-attendance', 'grant-faculty', 'satellite',
  'company-attendance', 'booth', 'direct-delegate', 'direct-faculty',
];
const EVENT_SUPPORT_ANNEX6_SETTINGS = [
  'conference', 'satellite', 'booth', 'tppt', 'company-training',
  'company-training-overlap', 'company-business', 'company-business-overlap',
];

// The event support checker's rules (src/data/eventSupportRules.json): structure, links to Code
// sections, and the "Chapter 4, Section 3" style references in its wording.
function validateEventSupportRules(rules, chapters, errors, warnings) {
  const path = 'eventSupportRules.json';
  if (!rules || typeof rules !== 'object') {
    errors.push(`${path}: expected an object.`);
    return { activities: 0, conditions: 0 };
  }
  if (!isNonEmptyString(rules.version) || !isNonEmptyString(rules.codeVersion)) {
    errors.push(`${path}: missing version or codeVersion.`);
  }

  const sources = rules.sources && typeof rules.sources === 'object' ? rules.sources : {};
  for (const [key, source] of Object.entries(sources)) {
    if (source?.url !== undefined) {
      if (!isNonEmptyString(source.label) || !String(source.url).startsWith('https://www.ethicalmedtech.eu/')) {
        errors.push(`${path} sources.${key}: guidance sources need a label and an ethicalmedtech.eu URL.`);
      }
    } else if (!chapters.find((chapter) => chapter?.id === source?.chapter)?.sections?.[source?.section]) {
      errors.push(`${path} sources.${key}: chapter "${source?.chapter}" has no section ${source?.section}.`);
    }
  }
  const checkSources = (list, itemPath) => {
    if (!Array.isArray(list) || list.length === 0) errors.push(`${itemPath}: expected a non-empty sources array.`);
    for (const key of asArray(list)) {
      if (!sources[key]) errors.push(`${itemPath}: unknown source "${key}".`);
    }
  };

  const questions = rules.questions && typeof rules.questions === 'object' ? rules.questions : {};
  for (const [id, question] of Object.entries(questions)) {
    const questionPath = `${path} questions.${id}`;
    if (!['choice', 'multi', 'agenda'].includes(question?.type)) errors.push(`${questionPath}: unknown type.`);
    if (!isNonEmptyString(question?.label) || typeof question?.help !== 'string') {
      errors.push(`${questionPath}: missing label or help.`);
    }
    const options = asArray(question?.options);
    if (question?.type !== 'agenda' && options.length < 2) errors.push(`${questionPath}: expected options.`);
    for (const duplicate of findDuplicates(options.map((option) => option?.[0]))) {
      errors.push(`${questionPath}: duplicate option "${duplicate}".`);
    }
  }
  const eventTypes = new Set(asArray(questions.eventType?.options).map((option) => option?.[0]));
  const groups = new Set(asArray(rules.activityGroups).map((group) => group?.id));

  const activities = asArray(rules.activities);
  for (const duplicate of findDuplicates(activities.map((activity) => activity?.id))) {
    errors.push(`${path}: duplicate activity "${duplicate}".`);
  }
  activities.forEach((activity, index) => {
    const activityPath = `${path} activities[${index}]`;
    if (!isNonEmptyString(activity?.id) || !isNonEmptyString(activity?.label) || !isNonEmptyString(activity?.description)) {
      errors.push(`${activityPath}: missing id, label or description.`);
    }
    if (!groups.has(activity?.group)) errors.push(`${activityPath}: unknown group "${activity?.group}".`);
    for (const type of asArray(activity?.eventTypes)) {
      if (!eventTypes.has(type) || type === 'unknown') errors.push(`${activityPath}: unknown event type "${type}".`);
    }
    checkSources(activity?.sources, activityPath);
  });

  const conditions = asArray(rules.conditions);
  for (const duplicate of findDuplicates(conditions.map((condition) => condition?.id))) {
    errors.push(`${path}: duplicate condition "${duplicate}".`);
  }
  conditions.forEach((condition, index) => {
    const conditionPath = `${path} conditions[${index}]`;
    if (!isNonEmptyString(condition?.id) || !isNonEmptyString(condition?.label)) {
      errors.push(`${conditionPath}: missing id or label.`);
    }
    // Condition answers are stored beside question answers, so their IDs must differ.
    if (questions[condition?.id]) errors.push(`${conditionPath}: ID "${condition.id}" is also a question ID.`);
    if (!['prohibited', 'review'].includes(condition?.failure)) errors.push(`${conditionPath}: unknown failure "${condition?.failure}".`);
    if (!Array.isArray(condition?.appliesTo) || condition.appliesTo.length === 0) {
      errors.push(`${conditionPath}: expected appliesTo tags.`);
    }
    for (const tag of asArray(condition?.appliesTo)) {
      if (!CONDITION_TAGS.includes(tag)) errors.push(`${conditionPath}: unknown tag "${tag}".`);
    }
    checkSources(condition?.sources, conditionPath);
  });

  const annex1 = rules.conferenceMatrix || {};
  const annex1Text = rules.annex1Text || {};
  if (asArray(rules.annex1Columns).length !== 4) errors.push(`${path}: annex1Columns needs the 4 Annex I columns.`);
  if (Object.keys(annex1).sort().join() !== [...EVENT_SUPPORT_ANNEX1_ROWS].sort().join()) {
    errors.push(`${path}: conferenceMatrix must have exactly the ${EVENT_SUPPORT_ANNEX1_ROWS.length} Annex I rows.`);
  }
  for (const row of EVENT_SUPPORT_ANNEX1_ROWS) {
    const cells = asArray(annex1[row]);
    if (cells.length !== 4 || cells.some((cell) => !/^(conditional|prohibited|review|outside|na):(none|required|internal)$/.test(cell))) {
      errors.push(`${path} conferenceMatrix.${row}: expected 4 "permission:cvs" cells.`);
    }
    if (asArray(annex1Text[row]).length !== 4 || asArray(annex1Text[row]).some((text) => !isNonEmptyString(text))) {
      errors.push(`${path} annex1Text.${row}: expected the 4 Annex I cell texts.`);
    }
  }
  const annex6 = rules.directSupportMatrix || {};
  for (const setting of EVENT_SUPPORT_ANNEX6_SETTINGS) {
    for (const role of ['faculty', 'delegate']) {
      if (!['conditional', 'prohibited', 'equipment-exception'].includes(annex6[setting]?.[role])) {
        errors.push(`${path} directSupportMatrix.${setting}.${role}: expected an Annex VI position.`);
      }
      if (!isNonEmptyString(rules.annex6Text?.[setting]?.[role])) {
        errors.push(`${path} annex6Text.${setting}.${role}: expected the Annex VI cell text.`);
      }
    }
    if (!isNonEmptyString(rules.annex6Settings?.[setting])) errors.push(`${path} annex6Settings.${setting}: missing label.`);
  }

  const statusLabels = [];
  for (const list of EVENT_SUPPORT_CVS_STATUS_LISTS) {
    if (!Array.isArray(rules.cvsStatuses?.[list])) errors.push(`${path} cvsStatuses.${list}: expected a list.`);
    statusLabels.push(...asArray(rules.cvsStatuses?.[list]).map((label) => String(label).toLowerCase()));
  }
  for (const duplicate of findDuplicates(statusLabels)) {
    errors.push(`${path} cvsStatuses: "${duplicate}" is listed more than once.`);
  }

  // References in the checker's wording must name real chapters, sections, annexes and Q&As.
  const index = createReferenceIndex({
    codeChapters: chapters.filter((chapter) => isNonEmptyString(chapter?.id) && Array.isArray(chapter.sections) && chapter.part !== 'website'),
  });
  const texts = [
    ...Object.entries(rules.messages || {}).map(([id, text]) => [`messages.${id}`, text]),
    ...Object.entries(questions).flatMap(([id, question]) => [[`questions.${id}.label`, question?.label], [`questions.${id}.help`, question?.help]]),
    ...conditions.map((condition, conditionIndex) => [`conditions[${conditionIndex}].label`, condition?.label]),
  ];
  for (const [textPath, text] of texts) {
    if (!isNonEmptyString(text)) continue;
    for (const reference of findCrossReferences(text, { index, context: { publication: 'code', unitId: null } })) {
      if (reference.status === 'unresolved') errors.push(`${path} ${textPath}: "${reference.text}" does not match anything (${reference.note}).`);
      if (reference.status === 'fallback') warnings.push(`${path} ${textPath}: "${reference.text}": ${reference.note}.`);
    }
  }

  return { activities: activities.length, conditions: conditions.length };
}

function asArray(value) {
  if (value === null || value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function extractRegisteredIconNames(iconSource) {
  const names = new Set();

  for (const mapName of ['customIconMap', 'lucideIconMap']) {
    const mapMatch = iconSource.match(new RegExp(`const ${mapName} = \\{([\\s\\S]*?)\\};`));
    if (!mapMatch) continue;

    for (const identifier of mapMatch[1].match(/[A-Za-z][A-Za-z0-9]*/g) || []) {
      names.add(identifier);
    }
  }

  return names;
}

export function validateProjectData({
  codeData,
  treeData,
  quizData,
  transparencyData = [],
  iconSource = '',
  searchPhrasebook,
  eventSupportRules,
}) {
  const errors = [];
  const warnings = [];
  const chapters = Array.isArray(codeData?.chapters) ? codeData.chapters : [];
  const trees = Array.isArray(treeData?.trees) ? treeData.trees : [];
  const questions = Array.isArray(quizData) ? quizData : [];
  const transparencyDocuments = Array.isArray(transparencyData) ? transparencyData : [];
  const registeredIconNames = extractRegisteredIconNames(iconSource);

  if (!Array.isArray(codeData?.chapters)) {
    errors.push('Code data: expected a chapters array.');
  }
  if (!Array.isArray(treeData?.trees)) {
    errors.push('treeData.json: expected a top-level "trees" array.');
  }
  if (!Array.isArray(quizData)) {
    errors.push('quizData.json: expected a top-level array.');
  }
  if (!Array.isArray(transparencyData)) {
    errors.push('Transparency data: expected a documents array.');
  }

  const chapterIds = chapters.map((chapter) => chapter?.id).filter(isNonEmptyString);
  for (const duplicate of findDuplicates(chapterIds)) {
    errors.push(`Code data: duplicate chapter ID "${duplicate}".`);
  }

  const chapterIdSet = new Set(chapterIds);
  const sectionIdSet = new Set();
  const generatedSectionIds = [];
  let sectionCount = 0;
  let qaCount = 0;

  chapters.forEach((chapter, chapterIndex) => {
    const chapterPath = `Code data chapters[${chapterIndex}]`;

    if (!isNonEmptyString(chapter?.id)) errors.push(`${chapterPath}: missing chapter ID.`);
    if (!isNonEmptyString(chapter?.title)) errors.push(`${chapterPath}: missing title.`);
    if (!ALLOWED_PARTS.has(chapter?.part)) {
      errors.push(`${chapterPath}: invalid part "${chapter?.part ?? ''}".`);
    }
    if (!isNonEmptyString(chapter?.icon)) {
      errors.push(`${chapterPath}: missing icon.`);
    } else if (!/^\d+$/.test(chapter.icon) && !registeredIconNames.has(chapter.icon)) {
      errors.push(`${chapterPath}: icon "${chapter.icon}" is not registered in AppIcons.jsx.`);
    }

    if (!Array.isArray(chapter?.sections)) {
      errors.push(`${chapterPath}: expected a sections array.`);
      return;
    }

    chapter.sections.forEach((section, sectionIndex) => {
      sectionCount += 1;
      const sectionPath = `${chapterPath} sections[${sectionIndex}]`;
      const sectionId = generateSectionId(chapter.id, section?.title, sectionIndex);
      generatedSectionIds.push(sectionId);
      sectionIdSet.add(sectionId);

      if (!isNonEmptyString(section?.legalText)) errors.push(`${sectionPath}: missing legalText.`);
      if (!Array.isArray(section?.qas)) {
        errors.push(`${sectionPath}: expected a qas array.`);
        return;
      }

      section.qas.forEach((qa, qaIndex) => {
        qaCount += 1;
        const qaPath = `${sectionPath} qas[${qaIndex}]`;
        if (!isNonEmptyString(qa?.q)) errors.push(`${qaPath}: missing question text (q).`);
        if (!isNonEmptyString(qa?.a)) errors.push(`${qaPath}: missing answer text (a).`);
      });
    });
  });

  for (const duplicate of findDuplicates(generatedSectionIds)) {
    errors.push(`Code data: duplicate generated section ID "${duplicate}".`);
  }

  const treeIds = trees.map((tree) => tree?.id).filter(isNonEmptyString);
  for (const duplicate of findDuplicates(treeIds)) {
    errors.push(`treeData.json: duplicate tree ID "${duplicate}".`);
  }

  let treeNodeCount = 0;
  trees.forEach((tree, treeIndex) => {
    const treePath = `treeData.json trees[${treeIndex}]`;
    if (!isNonEmptyString(tree?.id)) {
      errors.push(`${treePath}: missing tree ID.`);
    } else if (!tree.id.startsWith('dt-')) {
      errors.push(`${treePath}: tree ID "${tree.id}" must start with "dt-".`);
    }
    if (!isNonEmptyString(tree?.title)) errors.push(`${treePath}: missing title.`);
    if (!Array.isArray(tree?.nodes) || tree.nodes.length === 0) {
      errors.push(`${treePath}: expected a non-empty nodes array.`);
      return;
    }

    treeNodeCount += tree.nodes.length;
    const nodeIds = tree.nodes.map((node) => node?.id).filter(isNonEmptyString);
    const nodeIdSet = new Set(nodeIds);

    for (const duplicate of findDuplicates(nodeIds)) {
      errors.push(`${treePath}: duplicate node ID "${duplicate}".`);
    }
    if (!nodeIdSet.has('start')) errors.push(`${treePath}: missing required "start" node.`);

    tree.nodes.forEach((node, nodeIndex) => {
      const nodePath = `${treePath} nodes[${nodeIndex}]`;
      if (!isNonEmptyString(node?.id)) errors.push(`${nodePath}: missing node ID.`);
      if (!isNonEmptyString(node?.text)) errors.push(`${nodePath}: missing text.`);

      if (node?.type === 'question') {
        if (!Array.isArray(node.options) || node.options.length === 0) {
          errors.push(`${nodePath}: question node must have options.`);
          return;
        }

        node.options.forEach((option, optionIndex) => {
          const optionPath = `${nodePath} options[${optionIndex}]`;
          if (!isNonEmptyString(option?.label)) errors.push(`${optionPath}: missing label.`);
          if (!isNonEmptyString(option?.next)) {
            errors.push(`${optionPath}: missing next node ID.`);
          } else if (!nodeIdSet.has(option.next)) {
            errors.push(`${optionPath}: target node "${option.next}" does not exist in tree "${tree.id}".`);
          }
        });
      } else if (node?.type === 'result') {
        if (!ALLOWED_OUTCOMES.has(node.outcome)) {
          errors.push(`${nodePath}: unsupported outcome "${node?.outcome ?? ''}".`);
        }
        if (node.cvsCheck !== undefined && !tree.cvsCheck?.[node.cvsCheck]) {
          errors.push(`${nodePath}: cvsCheck "${node.cvsCheck}" has no texts in the tree's cvsCheck.`);
        }
      } else {
        errors.push(`${nodePath}: unsupported node type "${node?.type ?? ''}".`);
      }
    });

    if (tree.cvsCheck !== undefined) validateTreeCvsCheck(tree.cvsCheck, `${treePath} cvsCheck`, errors);

    for (const relatedChapter of asArray(tree.relatedChapter)) {
      if (!chapterIdSet.has(relatedChapter)) {
        errors.push(`${treePath}: relatedChapter "${relatedChapter}" does not exist.`);
      }
    }
    for (const relatedSection of asArray(tree.relatedSection)) {
      if (!sectionIdSet.has(relatedSection)) {
        errors.push(`${treePath}: relatedSection "${relatedSection}" does not exist.`);
      }
    }
  });

  const quizIds = questions.map((question) => question?.id).filter(isNonEmptyString);
  for (const duplicate of findDuplicates(quizIds)) {
    errors.push(`quizData.json: duplicate question ID "${duplicate}".`);
  }

  questions.forEach((question, questionIndex) => {
    const questionPath = `quizData.json questions[${questionIndex}]`;
    if (!isNonEmptyString(question?.id)) errors.push(`${questionPath}: missing question ID.`);
    if (!isNonEmptyString(question?.question)) errors.push(`${questionPath}: missing question text.`);
    if (!chapterIdSet.has(question?.chapterId)) {
      errors.push(`${questionPath}: chapterId "${question?.chapterId ?? ''}" does not exist.`);
    }
    if (!Array.isArray(question?.options) || question.options.length < 2) {
      errors.push(`${questionPath}: expected at least two options.`);
      return;
    }

    const optionIds = question.options.map((option) => option?.id).filter(isNonEmptyString);
    for (const duplicate of findDuplicates(optionIds)) {
      errors.push(`${questionPath}: duplicate option ID "${duplicate}".`);
    }

    question.options.forEach((option, optionIndex) => {
      const optionPath = `${questionPath} options[${optionIndex}]`;
      if (!isNonEmptyString(option?.id)) errors.push(`${optionPath}: missing option ID.`);
      if (!isNonEmptyString(option?.text)) errors.push(`${optionPath}: missing option text.`);
      if (typeof option?.isCorrect !== 'boolean') errors.push(`${optionPath}: isCorrect must be true or false.`);
    });

    const correctCount = question.options.filter((option) => option?.isCorrect === true).length;
    if (correctCount !== 1) {
      errors.push(`${questionPath}: expected exactly one correct option, found ${correctCount}.`);
    }
  });

  const transparencyDocumentIds = transparencyDocuments
    .map((document) => document?.id)
    .filter(isNonEmptyString);
  for (const duplicate of findDuplicates(transparencyDocumentIds)) {
    errors.push(`Transparency data: duplicate document ID "${duplicate}".`);
  }

  let transparencyUnitCount = 0;
  let transparencySectionCount = 0;
  let transparencyQaCount = 0;

  transparencyDocuments.forEach((document, documentIndex) => {
    const documentPath = `Transparency data documents[${documentIndex}]`;
    if (!isNonEmptyString(document?.id)) errors.push(`${documentPath}: missing document ID.`);
    if (!isNonEmptyString(document?.title)) errors.push(`${documentPath}: missing title.`);
    if (!isNonEmptyString(document?.icon)) {
      errors.push(`${documentPath}: missing icon.`);
    } else if (!registeredIconNames.has(document.icon)) {
      errors.push(`${documentPath}: icon "${document.icon}" is not registered in AppIcons.jsx.`);
    }
    if (!Array.isArray(document?.units) || document.units.length === 0) {
      errors.push(`${documentPath}: expected a non-empty units array.`);
      return;
    }

    const resourceIds = (Array.isArray(document.resources) ? document.resources : [])
      .map((resource) => resource?.id)
      .filter(isNonEmptyString);
    for (const duplicate of findDuplicates(resourceIds)) {
      errors.push(`${documentPath}: duplicate resource ID "${duplicate}".`);
    }
    const resourceIdSet = new Set(resourceIds);

    const unitIds = document.units.map((unit) => unit?.id).filter(isNonEmptyString);
    for (const duplicate of findDuplicates(unitIds)) {
      errors.push(`${documentPath}: duplicate unit ID "${duplicate}".`);
    }
    if (Array.isArray(document.unitIds)) {
      if (
        document.unitIds.length !== unitIds.length
        || document.unitIds.some((unitId, index) => unitId !== unitIds[index])
      ) {
        errors.push(`${documentPath}: unitIds must exactly match the loaded unit order.`);
      }
    }

    const generatedSectionIds = [];
    let declarationTemplateLinks = 0;

    document.units.forEach((unit, unitIndex) => {
      transparencyUnitCount += 1;
      const unitPath = `${documentPath} units[${unitIndex}]`;

      if (!isNonEmptyString(unit?.id)) {
        errors.push(`${unitPath}: missing unit ID.`);
      } else {
        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(unit.id)) {
          errors.push(`${unitPath}: unit ID "${unit.id}" is not route-safe.`);
        }
        if (document.id === 'disclosure-guidelines' && !unit.id.startsWith('dg-')) {
          errors.push(`${unitPath}: Disclosure Guidelines unit ID "${unit.id}" must start with "dg-".`);
        }
      }
      if (unit?.documentId !== document.id) {
        errors.push(`${unitPath}: documentId must be "${document.id}".`);
      }
      if (!isNonEmptyString(unit?.title)) errors.push(`${unitPath}: missing title.`);
      if (!isNonEmptyString(unit?.icon)) {
        errors.push(`${unitPath}: missing icon.`);
      } else if (!/^\d+$/.test(unit.icon) && !registeredIconNames.has(unit.icon)) {
        errors.push(`${unitPath}: icon "${unit.icon}" is not registered in AppIcons.jsx.`);
      }
      if (
        !Array.isArray(unit?.sourcePages)
        || unit.sourcePages.length === 0
        || unit.sourcePages.some((page) => !Number.isInteger(page) || page < 1)
      ) {
        errors.push(`${unitPath}: sourcePages must contain positive page numbers.`);
      }
      if (!Array.isArray(unit?.sections) || unit.sections.length === 0) {
        errors.push(`${unitPath}: expected a non-empty sections array.`);
        return;
      }

      unit.sections.forEach((section, sectionIndex) => {
        transparencySectionCount += 1;
        const sectionPath = `${unitPath} sections[${sectionIndex}]`;
        generatedSectionIds.push(generateSectionId(unit.id, section?.title, sectionIndex));

        if (typeof section?.title !== 'string') {
          errors.push(`${sectionPath}: title must be a string (empty is allowed).`);
        }
        if (!isNonEmptyString(section?.legalText)) errors.push(`${sectionPath}: missing legalText.`);
        if (
          !Array.isArray(section?.sourcePages)
          || section.sourcePages.length === 0
          || section.sourcePages.some((page) => !Number.isInteger(page) || page < 1)
        ) {
          errors.push(`${sectionPath}: sourcePages must contain positive page numbers.`);
        }
        if (!Array.isArray(section?.qas)) {
          errors.push(`${sectionPath}: expected a qas array.`);
          return;
        }

        const resourceMatches = String(section.legalText || '')
          .matchAll(/href=(["'])resource:([a-z0-9-]+)\1/gi);
        for (const match of resourceMatches) {
          const resourceId = match[2];
          if (!resourceIdSet.has(resourceId)) {
            errors.push(`${sectionPath}: resource "${resourceId}" is not declared by the document.`);
          }
          if (resourceId === 'declaration-csv-template') declarationTemplateLinks += 1;
        }

        section.qas.forEach((qa, qaIndex) => {
          transparencyQaCount += 1;
          const qaPath = `${sectionPath} qas[${qaIndex}]`;
          if (!isNonEmptyString(qa?.q)) errors.push(`${qaPath}: missing question text (q).`);
          if (!isNonEmptyString(qa?.a)) errors.push(`${qaPath}: missing answer text (a).`);
          if (
            !Array.isArray(qa?.sourcePages)
            || qa.sourcePages.length === 0
            || qa.sourcePages.some((page) => !Number.isInteger(page) || page < 1)
          ) {
            errors.push(`${qaPath}: sourcePages must contain positive page numbers.`);
          }
          if (document.id === 'disclosure-guidelines') {
            if (!/^Q&A \d+$/.test(qa?.label || '')) {
              errors.push(`${qaPath}: label must use the exact "Q&A N" format.`);
            }
            if (!/^Q:/.test(qa?.q || '')) {
              errors.push(`${qaPath}: question text must retain its leading "Q:".`);
            }
            if (/^A:/.test(qa?.a || '')) {
              errors.push(`${qaPath}: answer text must omit "A:" because the renderer supplies it.`);
            }
          }
        });
      });
    });

    for (const duplicate of findDuplicates(generatedSectionIds)) {
      errors.push(`${documentPath}: duplicate generated section ID "${duplicate}".`);
    }

    if (document.id === 'disclosure-guidelines') {
      if (!resourceIdSet.has('declaration-csv-template')) {
        errors.push(`${documentPath}: missing declaration-csv-template resource.`);
      }
      if (declarationTemplateLinks !== 1) {
        errors.push(
          `${documentPath}: expected exactly one local declaration-csv-template link, found ${declarationTemplateLinks}.`,
        );
      }
      const serialized = JSON.stringify(document.units);
      if (/ethicalmedtech\.eu\/wp-content\/uploads/i.test(serialized)) {
        errors.push(`${documentPath}: Annex I must not retain the external template URL.`);
      }
    }
  });

  const phrasebookGroups = searchPhrasebook === undefined
    ? 0
    : validateSearchPhrasebook(searchPhrasebook, errors);

  const crossReferences = validateCrossReferences(
    { chapters, transparencyDocuments, trees },
    errors,
    warnings,
  );

  const eventSupport = eventSupportRules === undefined
    ? { activities: 0, conditions: 0 }
    : validateEventSupportRules(eventSupportRules, chapters, errors, warnings);

  return {
    errors,
    warnings,
    stats: {
      chapters: chapters.length,
      sections: sectionCount,
      qas: qaCount,
      trees: trees.length,
      treeNodes: treeNodeCount,
      quizQuestions: questions.length,
      transparencyDocuments: transparencyDocuments.length,
      transparencyUnits: transparencyUnitCount,
      transparencySections: transparencySectionCount,
      transparencyQas: transparencyQaCount,
      phrasebookGroups,
      crossReferences,
      eventSupportActivities: eventSupport.activities,
      eventSupportConditions: eventSupport.conditions,
    },
  };
}

function readJson(relativePath) {
  const absolutePath = resolve(PROJECT_ROOT, relativePath);
  return JSON.parse(readFileSync(absolutePath, 'utf8'));
}

const PHRASEBOOK_PATH = 'src/data/search/phrasebook.json';

function readSearchPhrasebook() {
  try {
    return { value: readJson(PHRASEBOOK_PATH) };
  } catch (error) {
    return {
      error: error.code === 'ENOENT'
        ? `${PHRASEBOOK_PATH}: file is missing.`
        : `${PHRASEBOOK_PATH}: invalid JSON (${error.message}).`,
    };
  }
}

export function validateCurrentProject() {
  const phrasebook = readSearchPhrasebook();
  const codeData = loadSplitCodeData(PROJECT_ROOT);
  const result = validateProjectData({
    codeData,
    treeData: readJson('src/data/treeData.json'),
    quizData: readJson('src/data/quizData.json'),
    transparencyData: loadTransparencyData(PROJECT_ROOT),
    iconSource: readFileSync(resolve(PROJECT_ROOT, 'src/components/AppIcons.jsx'), 'utf8'),
    searchPhrasebook: phrasebook.value,
    eventSupportRules: readJson('src/data/eventSupportRules.json'),
  });
  if (phrasebook.error) result.errors.push(phrasebook.error);
  return result;
}

function printNotes(warnings = []) {
  if (warnings.length === 0) return;
  console.log(`${warnings.length} note${warnings.length === 1 ? '' : 's'} (not errors):`);
  warnings.forEach((warning) => console.log(`- ${warning}`));
}

function printReport({ errors, warnings, stats }) {
  if (errors.length > 0) {
    console.error(`Data validation failed with ${errors.length} error${errors.length === 1 ? '' : 's'}:`);
    errors.forEach((error) => console.error(`- ${error}`));
    printNotes(warnings);
    return;
  }

  console.log('Data validation passed.');
  console.log(`${stats.chapters} chapters, ${stats.sections} sections, ${stats.qas} Q&As`);
  console.log(`${stats.trees} decision trees, ${stats.treeNodes} nodes`);
  console.log(`${stats.quizQuestions} quiz questions`);
  console.log(`${stats.phrasebookGroups} phrasebook groups`);
  console.log(
    `${stats.transparencyDocuments} Transparency document, `
    + `${stats.transparencyUnits} reader units, `
    + `${stats.transparencySections} sections, `
    + `${stats.transparencyQas} Q&As`,
  );
  console.log(`${stats.crossReferences} cross-references linked`);
  console.log(`Event support checker: ${stats.eventSupportActivities} activities, ${stats.eventSupportConditions} conditions`);
  printNotes(warnings);
}

const isDirectRun = process.argv[1]
  && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isDirectRun) {
  try {
    const result = validateCurrentProject();
    printReport(result);
    if (result.errors.length > 0) process.exitCode = 1;
  } catch (error) {
    console.error(`Data validation could not run: ${error.message}`);
    process.exitCode = 1;
  }
}
