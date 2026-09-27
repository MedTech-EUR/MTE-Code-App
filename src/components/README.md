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

`DecisionTree.jsx` shows a tree from `src/data/treeData.json`. A result that sets
`cvsCheck` also shows `TreeCvsCheck.jsx`: the checker's CVS search (`CvsEventLookup.jsx`)
and what the Event's live status means for that result, in the tree's own `cvsCheck` texts.
“When are CVS assessments required?” uses it.

For more details on how these components interact with the rest of the application, see the [Project Map](../../AGENTS.md#project-map).
