# Components

This directory contains the React components that build the UI of The Code App. It includes layout components (Header, Sidebar), section-specific content managers, and interactive features like decision trees and glossary popups.

`DocumentReader.jsx` is the shared long-form reader used by `MainContent.jsx` for
the Code and by `TransparencyContent.jsx` for standalone Transparency
publications. `TransparencyLandingPage.jsx` provides the publication/document
overview levels. `CsvTemplatePreview.jsx` renders the local Annex I CSV as a
clearly labelled convenience preview; it must not be treated as normative
Disclosure Guidelines content. Transparency passes the `transparency-reader`
root class to `DocumentReader`; keep standalone-publication table defaults scoped
to that class so they cannot override the Code annexes' Tailwind-authored tables.
Both readers receive the same Code glossary map and definition-popup handler;
glossary instrumentation applies to legal text and official Q&A questions and
answers. It may wrap existing visible words but must never change
standalone-publication wording. The Knowledge Quiz remains outside this reader
behavior.

`EventSupportContent.jsx` is the “Can we support this event?” checker. Its wording
comes from `src/data/eventSupportRules.json` and passes through the same glossary and
cross-reference linking as the reader; terms and references open in the side panel
from 1280px and in `DefinitionPopup` below that, and the Code opens in a new tab so the
checker's answers are kept. See [`docs/event-support.md`](../../docs/event-support.md).

`DecisionTree.jsx` shows a tree from `src/data/treeData.json`; `TreeResultCard.jsx` is its
answer card. A result that sets `cvsCheck` is shown by `TreeCvsCheck.jsx` instead: the card
starts with the result's outcome and changes with the live CVS status of the Event found with
the checker's search below it (`CvsEventLookup.jsx`), turning Compliant (green) or
Non-Compliant (red) with a final decision; what the status means, in the tree's own `cvsCheck`
texts, is added under the card's text. The Conference Vetting System check
(`dt-annex1-cvs-scope`), which the Home Hub and the sidebar open, uses it.

`TreeLandingPage.jsx` also lists the tools in `TREE_PAGE_TOOLS` (`src/config/sections.js`),
such as the event support checker, as cards among the trees; each opens its own section.

For more details on how these components interact with the rest of the application, see the [Project Map](../../AGENTS.md#project-map).
