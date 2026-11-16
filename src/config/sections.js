import { CVS_CHECK_URL } from '../../moved-pages.js';

/**
 * The CVS checker, on ethicalmedtech.eu (the page there also covers e4ethics): the Home Hub card and the sidebar entry open
 * it in a new tab. It was a decision tree of this app until November 2026.
 */
export { CVS_CHECK_URL };

/**
 * Home Hub metadata registry.
 * Navigable sections also require App and route-controller wiring.
 *
 * Accents stay within the brand palette: teal for the reading sections, amber for the decision
 * trees, purple for the tools. `color` fills icons and borders; `textColor` is given where that
 * fill is below the 4.5:1 AA contrast minimum for text on white.
 */
export const SECTIONS = [
  {
    id: 'code',
    title: 'The Code',
    subtitle: 'MedTech Europe Code of Ethical Business Practice',
    description: 'Browse chapters, sections, Q&As, and the full legal text of the MedTech Europe Code.',
    icon: 'FileText',
    color: '#0099A7',
    textColor: '#007A86', // brand teal is too light for small text
    available: true,
  },
  {
    id: 'transparency',
    title: 'Transparency',
    subtitle: 'Disclosure guidance and transparency resources',
    description: 'Read the Disclosure Guidelines and access MedTech Europe transparency resources.',
    icon: 'Eye',
    color: '#00727D', // a deeper shade of the brand teal, so it reads apart from The Code
    available: true,
  },
  {
    id: 'trees',
    title: 'Decision Trees',
    subtitle: 'Interactive compliance decision guides',
    description: 'Step through interactive decision trees to assess compliance scenarios based on the Code.',
    icon: 'GitBranch',
    color: '#D97706', // amber: decision trees
    textColor: '#B45309', // the amber fill is too light for small text
    available: true,
  },
  {
    // A card with `href` opens another site in a new tab instead of a section of this app.
    // The event support checker is listed with the decision trees.
    id: 'cvs-check',
    title: 'CVS checker',
    subtitle: 'On ethicalmedtech.eu',
    description: 'Check in a few questions whether support for a Third Party Organised Educational Event needs a CVS decision under Annex I, and look up the Event’s current status in CVS.',
    icon: 'CVSBadge',
    color: '#D97706', // kept amber: it was a decision tree here, and readers know it by this colour
    textColor: '#B45309',
    href: CVS_CHECK_URL,
    available: true,
  },
  {
    id: 'quiz',
    title: 'Knowledge Quiz',
    subtitle: 'Test your understanding of the Code',
    description: 'Assess your compliance knowledge with interactive multiple-choice questions.',
    icon: 'BookOpen',
    color: '#7654A1', // brand purple
    available: true,
  },
  {
    id: 'tppt',
    title: 'TPPT Checker',
    subtitle: 'Check TPPT Meeting Agendas',
    description: 'Support tool to help companies determine if an event qualifies as a Third Party Procedural Training meeting.',
    icon: 'Calculator',
    color: '#634488', // the deeper brand purple
    available: true,
  },
  // Future sections:
  // {
  //   id: 'materials',
  //   title: 'Materials',
  //   subtitle: 'Supplementary compliance resources',
  //   description: '...',
  //   icon: 'Gift',
  //   color: '#8b5cf6',
  //   available: false,
  // },
];

/**
 * Tools listed on the Decision Trees page with the trees, though they are not trees. Each card
 * opens the tool's own section.
 */
export const TREE_PAGE_TOOLS = [
  {
    id: 'event-support',
    category: 'events',
    title: 'Can we support this event?',
    description: 'Check a planned grant, sponsorship, payment or other support for an Event, with its conditions and a live CVS check where one is needed.',
  },
];
