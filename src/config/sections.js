/**
 * The decision tree that the Home Hub's Conference Vetting System check card and the sidebar open.
 */
export const CVS_CHECK_TREE_ID = 'dt-annex1-cvs-scope';

/**
 * Home Hub metadata registry.
 * Navigable sections also require App and route-controller wiring.
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
    color: '#000000',
    available: true,
  },
  {
    id: 'trees',
    title: 'Decision Trees',
    subtitle: 'Interactive compliance decision guides',
    description: 'Step through interactive decision trees to assess compliance scenarios based on the Code.',
    icon: 'GitBranch',
    color: '#e67e22',
    available: true,
  },
  {
    // Opens the decision tree CVS_CHECK_TREE_ID. It takes the event support checker's place
    // here and in the sidebar for now; the checker is listed with the decision trees.
    id: 'cvs-check',
    title: 'Conference Vetting System check',
    subtitle: 'Annex I and the Event’s CVS status',
    description: 'Check in a few questions whether support for a Third Party Organised Educational Event needs a CVS decision under Annex I, and look up the Event’s current status in CVS.',
    icon: 'CVSBadge',
    color: '#7654A1',
    available: true,
  },
  {
    id: 'quiz',
    title: 'Knowledge Quiz',
    subtitle: 'Test your understanding of the Code',
    description: 'Assess your compliance knowledge with interactive multiple-choice questions.',
    icon: 'BookOpen',
    color: '#ec4899', // A nice pink/rose color that stands out
    available: true,
  },
  {
    id: 'tppt',
    title: 'TPPT Checker',
    subtitle: 'Check TPPT Meeting Agendas',
    description: 'Support tool to help companies determine if an event qualifies as a Third Party Procedural Training meeting.',
    icon: 'Calculator',
    color: '#634488', // Standard Brand Purple
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
