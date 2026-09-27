import test from 'node:test';
import assert from 'node:assert/strict';

import { validateProjectData } from '../scripts/validate-data.mjs';

function makeValidFixture() {
  return {
    codeData: {
      chapters: [{
        id: 'intro',
        part: 'intro',
        title: 'Introduction',
        icon: 'Info',
        sections: [{
          title: 'Purpose',
          legalText: 'Reference text',
          qas: [{ q: 'A question?', a: 'An answer.' }],
        }],
      }],
    },
    treeData: {
      trees: [{
        id: 'dt-example',
        title: 'Example tree',
        relatedChapter: 'intro',
        relatedSection: 'intro-purpose',
        nodes: [
          { id: 'start', type: 'question', text: 'Continue?', options: [{ label: 'Yes', next: 'result' }] },
          { id: 'result', type: 'result', text: 'Done', outcome: 'compliant' },
        ],
      }],
    },
    quizData: [{
      id: 'q1',
      chapterId: 'intro',
      question: 'Which option is correct?',
      options: [
        { id: 'a', text: 'Correct', isCorrect: true },
        { id: 'b', text: 'Incorrect', isCorrect: false },
      ],
    }],
    transparencyData: [{
      id: 'disclosure-guidelines',
      title: 'Disclosure Guidelines',
      icon: 'Eye',
      unitIds: ['dg-preamble'],
      resources: [{
        id: 'declaration-csv-template',
        filename: 'declaration-csv-template.csv',
      }],
      units: [{
        id: 'dg-preamble',
        documentId: 'disclosure-guidelines',
        type: 'preamble',
        title: 'Preamble',
        icon: 'FileText',
        sourcePages: [2],
        sections: [{
          title: '',
          legalText: '<p>Download <a href="resource:declaration-csv-template">this link</a>.</p>',
          sourcePages: [2],
          qas: [{
            label: 'Q&A 1',
            q: 'Q: A disclosure question?',
            a: 'A disclosure answer.',
            sourcePages: [2],
          }],
        }],
      }],
    }],
    iconSource: 'const lucideIconMap = { Eye, FileText, Info };',
    searchPhrasebook: {
      groups: [
        { same: ['agreement', 'contract'] },
        { from: ['doctor'], to: ['physician'] },
      ],
    },
  };
}

test('accepts a structurally valid project fixture', () => {
  const result = validateProjectData(makeValidFixture());
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.stats, {
    chapters: 1,
    sections: 1,
    qas: 1,
    trees: 1,
    treeNodes: 2,
    quizQuestions: 1,
    transparencyDocuments: 1,
    transparencyUnits: 1,
    transparencySections: 1,
    transparencyQas: 1,
    phrasebookGroups: 2,
    crossReferences: 0,
    eventSupportActivities: 0,
    eventSupportConditions: 0,
  });
  assert.deepEqual(result.warnings, []);
});

test('links cross-references and reports ones that lead nowhere', () => {
  const fixture = makeValidFixture();
  fixture.codeData.chapters.push({
    id: 'ch1',
    part: 'part1',
    title: 'Events',
    icon: '1',
    sections: [{ title: '1. Venues', legalText: '<p>Venue rules.</p>', qas: [] }],
  });
  fixture.codeData.chapters[0].sections[0].legalText = '<p>See Chapter 1, Section 2 and Chapter 9.</p>';
  fixture.treeData.trees[0].nodes[1].reference = 'Chapter 7 — Missing';

  const result = validateProjectData(fixture);
  assert.equal(result.stats.crossReferences, 1);
  assert.ok(result.errors.some((error) => error.includes('"Chapter 9" does not match anything')));
  assert.ok(result.errors.some((error) => error.includes('reference "Chapter 7 — Missing" does not match')));
  // Chapter 1 exists but has no section 2: not an error, but a note.
  assert.ok(result.warnings.some((warning) => warning.includes('Chapter 1 has no section 2')));
});

test('reports a broken tree target with its location', () => {
  const fixture = makeValidFixture();
  fixture.treeData.trees[0].nodes[0].options[0].next = 'missing-node';

  const result = validateProjectData(fixture);
  assert.ok(result.errors.some((error) => error.includes('target node "missing-node" does not exist')));
});

test('checks a tree’s CVS check texts and the results that use them', () => {
  const fixture = makeValidFixture();
  const tree = fixture.treeData.trees[0];
  tree.nodes[1].cvsCheck = 'required';
  assert.ok(validateProjectData(fixture).errors.some((error) => error.includes('cvsCheck "required" has no texts')));

  tree.cvsCheck = {
    title: 'Check the Event in CVS',
    required: {
      intro: 'Find the Event.',
      otherStatus: 'Unknown status {status}.',
      statuses: [
        { labels: ['Compliant'], text: 'Met.', tone: 'positive' },
        { labels: ['Under Review', 'compliant'], text: 'Wait.', tone: 'bright' },
      ],
    },
    guess: {},
  };
  const errors = validateProjectData(fixture).errors;
  assert.ok(errors.some((error) => error.includes('unknown mode "guess"')));
  assert.ok(errors.some((error) => error.includes('status "compliant" is listed twice')));
  assert.ok(errors.some((error) => error.includes('unsupported tone "bright"')));
  assert.ok(!errors.some((error) => error.includes('has no texts')));
});

test('reports quiz questions without exactly one correct option', () => {
  const fixture = makeValidFixture();
  fixture.quizData[0].options[1].isCorrect = true;

  const result = validateProjectData(fixture);
  assert.ok(result.errors.some((error) => error.includes('expected exactly one correct option, found 2')));
});

test('reports chapter icons that are not in the AppIcon registry maps', () => {
  const fixture = makeValidFixture();
  fixture.codeData.chapters[0].icon = 'UnknownIcon';

  const result = validateProjectData(fixture);
  assert.ok(result.errors.some((error) => error.includes('icon "UnknownIcon" is not registered')));
});

test('allows an untitled single-body Transparency section without duplicating its unit heading', () => {
  const fixture = makeValidFixture();
  fixture.transparencyData[0].units[0].sections[0].title = '';

  assert.deepEqual(validateProjectData(fixture).errors, []);
});

test('reports invalid Disclosure namespaces, source pages, and Q&A prefixes', () => {
  const fixture = makeValidFixture();
  const unit = fixture.transparencyData[0].units[0];
  unit.id = 'preamble';
  fixture.transparencyData[0].unitIds = ['preamble'];
  unit.sourcePages = [0, 2.5];
  unit.sections[0].qas[0].q = 'A disclosure question?';
  unit.sections[0].qas[0].a = 'A: A disclosure answer.';

  const errors = validateProjectData(fixture).errors;
  assert.ok(errors.some((error) => error.includes('must start with "dg-"')));
  assert.ok(errors.some((error) => error.includes('sourcePages must contain positive page numbers')));
  assert.ok(errors.some((error) => error.includes('retain its leading "Q:"')));
  assert.ok(errors.some((error) => error.includes('must omit "A:"')));
});

test('reports duplicate section routes and unresolved local resources', () => {
  const fixture = makeValidFixture();
  const sections = fixture.transparencyData[0].units[0].sections;
  sections[0].title = 'Repeated';
  sections.push({
    title: 'Repeated',
    legalText: '<a href="resource:not-declared">download</a>',
    sourcePages: [2],
    qas: [],
  });

  const errors = validateProjectData(fixture).errors;
  assert.ok(errors.some((error) => error.includes('duplicate generated section ID')));
  assert.ok(errors.some((error) => error.includes('resource "not-declared" is not declared')));
});

test('reports phrasebook structural errors comprehensively', () => {
  const fixture = makeValidFixture();
  fixture.searchPhrasebook = {
    groups: [
      { same: ['doctor'], from: ['surgeon'], to: ['physician'] }, // mixing same with from/to
      { same: ['UPPERCASE', 'contract'] }, // uppercase phrase
      { same: ['has digit5', 'contract'] }, // digit in phrase
      { from: ['five word phrase that is too long'], to: ['physician'] }, // 5-word phrase
      { from: ['doctor'], to: [] }, // empty to
      { from: ['lawyer'], to: ['attorney'] },
      { from: ['lawyer'], to: ['counselor'] }, // lawyer appears as from in two groups
      { from: ['judge'], to: ['judge', 'magistrate'] }, // judge in both from and to
    ],
  };

  const errors = validateProjectData(fixture).errors;
  const reports = (location, message) => errors.some(
    (error) => error.startsWith(`phrasebook.json ${location}`) && error.includes(message),
  );

  assert.ok(reports('groups[0]:', 'cannot mix "same" with "from"'));
  assert.ok(reports('groups[1] same[0]:', 'must be lowercase letters'));
  assert.ok(reports('groups[2] same[0]:', 'must be lowercase letters'));
  assert.ok(reports('groups[2]:', '"contract" appears in more than one "same" group'));
  assert.ok(reports('groups[3] from[0]:', 'must be 1 to 4 words'));
  assert.ok(reports('groups[4]:', '"to" must be a non-empty array'));
  assert.ok(reports('groups[6]:', '"lawyer" also appears in groups[5]'));
  assert.ok(reports('groups[7]:', '"judge" also appears in "to"'));
});

test('reports phrasebook top-level structural errors', () => {
  const fixture = makeValidFixture();
  fixture.searchPhrasebook = {
    groups: [
      { same: ['agreement', 'contract'] },
    ],
    extra: 'key',
  };

  const errors = validateProjectData(fixture).errors;
  assert.ok(errors.some((e) => e.includes('must have exactly one key "groups"')));
});

test('rejects corpus-independent duplicate sources and phrases made only of stopwords', () => {
  const fixture = makeValidFixture();
  fixture.searchPhrasebook = {
    groups: [
      { from: ['follow-up'], to: ['review'] },
      { from: ['follow up'], to: ['check'] },
      { same: ['at no', 'by the'] },
      { same: ['well-being', 'well being'] },
    ],
  };
  const errors = validateProjectData(fixture).errors;
  assert.ok(errors.some((error) => error.includes('source phrase "follow up"')
    && error.includes('after normalization')));
  assert.ok(errors.some((error) => error.includes('same[0]') && error.includes('not only stopwords')));
  assert.ok(errors.some((error) => error.includes('same[1]') && error.includes('not only stopwords')));
  assert.ok(errors.some((error) => error.includes('duplicate phrase "well being"')));
});

test('does not report phrasebook errors when searchPhrasebook is undefined', () => {
  const fixture = makeValidFixture();
  fixture.searchPhrasebook = undefined;

  const result = validateProjectData(fixture);
  assert.deepEqual(result.stats.phrasebookGroups, 0);
  assert.ok(!result.errors.some((e) => e.includes('phrasebook')));
});
