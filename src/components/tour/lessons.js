import { CODE_CHAPTERS } from '../../data/codeData';

// Selectors point to the real controls; activating them runs their usual app handlers.
const mark = (name) => `[data-tour="${name}"]`;
const step = (target, title, instruction, event = 'click', action = '') => ({ target, title, instruction, event, action });
const open = (name, title, instruction) => step(mark(name), title, instruction);
const researchId = 'ch6-4-collaborative-research';
const research = `[data-tour-section="${researchId}"]`;
const chapter = CODE_CHAPTERS.find(item => item.sections.some(section => section.liveId === researchId));
const section = chapter?.sections.find(item => item.liveId === researchId);
const chapterTitle = chapter?.title || 'the highlighted chapter';
const sampleQuery = section?.qas?.[0]?.q.match(/^Q&A\s+\d+/i)?.[0] || 'collaborative research';

export const lessons = {
  search: {
    title: 'Find a provision or Q&A', icon: 'Search',
    steps: [
      step('form:has(#welcome-search)', 'Search in your own words', `Type “${sampleQuery}” and press Enter or Search on your keyboard. You can also search by topic or glossary term.`, 'submit'),
      step('[data-tour="search-result"]:not(:disabled)', 'Open a search result', 'Select the highlighted result. Its badge identifies a provision, Q&A or definition; the line beside it shows where it belongs.'),
    ],
    finish: 'Use search from the navigation menu on any page. On a keyboard, / focuses the search field.',
  },
  reader: {
    title: 'Read, bookmark and share', icon: 'BookOpen',
    steps: [
      open('home-code', 'Open the Code', 'Select The Code to browse its chapters, glossary and annexes.'),
      open('chapter-' + chapter?.id, 'Find Collaborative Research', `Select ${chapterTitle}. We’ll use Collaborative Research to try the reading tools.`),
      step('[title="Reading settings"]', 'Open reading settings', 'Select Aa. Here you can adjust the text size, spacing and line length. On phones this menu also holds the summary, full text, Q&A and print controls.'),
      step('#reader-settings-panel', 'Try a text size', 'Choose a font size. You can select your current size to keep it.', 'click', 'button[aria-label^="Font size:"]'),
      step('[title="Reading settings"]', 'Return to the chapter', 'Select Aa again to close the settings.'),
      step(research + ' [data-term]', 'Look up a defined term', 'Select the highlighted term in Collaborative Research to read its Code definition.'),
      step('[aria-labelledby="definition-popup-title"], [aria-labelledby="context-panel-title"]', 'Return to the provision', 'Read the definition, then use its close button. Wide screens can show definitions and references beside the text.', 'click', '[aria-label="Close definition"], [aria-label="Close side panel"]'),
      step(research + ' [data-tour="bookmark"]', 'Save a place', 'Select Bookmark to change whether this passage is saved in this browser, or continue without changing it.', 'optional'),
      step(research + ' [data-tour="cite"]', 'Open Cite/Link', 'Select Cite/Link for this section. Individual Q&As have their own citation controls too.'),
      step('[role="group"][aria-label="Copy reference"]', 'Share the wording', 'Choose a citation, link or live embed. An embed can include related Q&As and show the Code-wide version. You can also finish without copying.', 'optional', 'button'),
    ],
    finish: 'Copy Text gives you the wording as it stands today. Copy live embed keeps a passage current on a site that accepts HTML embeds.',
  },
  decisions: {
    title: 'Try an event decision guide', icon: 'GitBranch',
    steps: [
      open('home-trees', 'Find the decision guides', 'Open Decision Trees to work through a scenario.'),
      open('tree-dt-ch1-event-location', 'Check an event location', 'Open the event-location guide to see its first question.'),
      step('[data-tour="tree-options"]', 'Answer the first question', 'Choose either answer and see how the guide follows your choice.', 'click', 'button'),
      open('page-back', 'Explore another guide', 'Select All Decision Trees. You can revisit your answers or view the full tree when using a guide on your own.'),
      open('tree-event-support', 'Open the event support checker', 'Choose “Can we support this event?” to assess a particular kind of support.'),
      open('support-activity', 'Choose a form of support', 'Select the highlighted activity to see which facts the checker needs.'),
    ],
    finish: 'Continue the check to see the conditions and sources for your scenario. The CVS checker on the home page opens EthicalMedTech in a new tab.',
  },
  transparency: {
    title: 'Explore disclosure guidance', icon: 'Eye',
    steps: [
      open('home-transparency', 'Open Transparency', 'Select Transparency for disclosure guidance and the historical declarations search.'),
      open('pub-disclosure-guidelines', 'Open the Disclosure Guidelines', 'Select the publication to see its chapters and annexes.'),
      open('disclosure-unit', 'Read a chapter', 'Open the highlighted reader unit. The publication overview also links to the original PDF.'),
    ],
    finish: 'You can cite and bookmark passages here. Search in this area uses the Transparency publications.',
  },
  quiz: {
    title: 'Try the Knowledge Quiz', icon: 'BookOpen',
    steps: [
      open('home-quiz', 'Open the Knowledge Quiz', 'Select Knowledge Quiz to set up a practice session.'),
      step('#quiz-question-count', 'Choose the quiz length', 'Adjust the slider or keep its current value and continue. The chapter checkboxes above control the topics.', 'read'),
      open('quiz-start', 'Start the quiz', 'Start your session with the selected chapters and question count.'),
      step('[data-tour="quiz-options"]', 'Choose an answer', 'Read the question and select your answer.', 'click', '[data-tour="quiz-answer"]'),
      open('quiz-submit', 'Check your answer', 'Submit your answer to see the explanation.'),
      step(mark('quiz-feedback'), 'Read the explanation', 'See why the answer is correct. After the tour you can continue this quiz.', 'read'),
    ],
    finish: 'Continue the quiz at your own pace. The results page lets you review your answers and share the questions.',
  },
  tppt: {
    title: 'Check a training agenda', icon: 'Calculator',
    steps: [
      open('home-tppt', 'Open the TPPT Checker', 'Select the checker to practise with a sample agenda. Your own saved agenda is kept separately.'),
      step('#tppt-agenda-text', 'Inspect the sample agenda', 'Read or edit the sample, then continue. Outside this tour you can also import a PDF or Word file.', 'read'),
      open('tppt-parse', 'Create the session list', 'Select Parse Text to Sessions. The checker estimates the timing and type of each session.'),
      step('[aria-labelledby="tppt-parse-warning-title"]', 'Review the classification notice', 'Read the notice and choose Close. Session types need a human check.', 'click', 'button'),
      step('[aria-label^="Session type for"]', 'Review a session type', 'Check the highlighted classification. You can change it, or keep it and continue.', 'read'),
      open('tppt-calculate', 'Calculate the agenda breakdown', 'Run the calculation to compare hands-on and practical time against the thresholds.'),
      step(mark('tppt-totals'), 'Read the time breakdown', 'Compare total, hands-on and practical time for your sample. Finish when you’re ready to return to your own agenda.', 'read'),
    ],
    finish: 'The checker also asks about the venue, the event’s independence and its size. Closing this practice tour restores your saved agenda.',
  },
};
