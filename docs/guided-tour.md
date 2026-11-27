# How to use the Code App

The top-bar help button offers six short tours. Each starts with a task a visitor might come to the app to do. A visitor can pick one, try the real controls, and leave at any step.

## Feature map

| Area | What the visitor practises | Related features |
| --- | --- | --- |
| Search | Enter a query on the home page, then open a ranked result in the reader. The suggested query uses the current label of an official Q&A. | Sidebar search, result types and filters, definition lookup, keyboard shortcut. |
| Code reader | Find Collaborative Research, adjust text size, open a definition, bookmark the provision and open Cite/Link. Visitors can try the live embed and its Q&A and Code-wide version options. | Summary, full text, official Q&As, cross-references, glossary index, annex map, print, Copy Text, bookmarks and recent pages. |
| Decision Trees and event support | Answer an event-location question, return to the list of guides and choose a form of support in the event checker. | Full tree, previous answers, conditions and cited provisions, result summaries, live CVS lookup. The standalone CVS and e4ethics check opens on EthicalMedTech. |
| Transparency | Open the Disclosure Guidelines, then enter a reader unit from the publication overview. | Publication PDF, annex resources, scoped search and historical declarations. |
| Knowledge Quiz | Choose a question count, start a quiz, answer one question, submit it and read its explanation. | Chapter selection, hints, results and sharing. The visitor can continue the quiz afterwards. |
| TPPT Checker | Inspect a sample training agenda, parse it, review a session classification, calculate and read the time breakdown. | File import, eligibility questions and PDF export. The practice agenda is discarded on exit. |

The tours use the existing Home Hub and section navigation. Installing the app, sending a suggestion, opening an external website and downloading a report are available through their normal controls and are outside the guided exercises.

## Implementation plan

1. Put the launcher in the shared header. Show the full label through three gentle pulses, collapse it to a question mark, then alternate teal and purple slowly. Keep the accessible name and provide a static reduced-motion state.
2. Define one sequence per task in `src/components/tour/lessons.js`. Mark the actual controls in their owning components. Use the permanent provision ID to locate Collaborative Research in its current chapter.
3. In `GuidedTour.jsx`, scroll each target into view and position the spotlight and instruction card around it. Advance when the visitor performs the action. Offer Continue for reading steps and optional actions such as copying or bookmarking. Keep the target and tour controls reachable by keyboard, support Escape and restore focus to the launcher.
4. Keep practice separate where visitor work could be lost. Launch from an open quiz, event checker, training agenda or active decision tree in a separate tab. Use the real TPPT parser on a sample and keep autosave off for that practice instance.
5. Exercise each path on desktop and phone. Check the two glossary layouts, the expanded and collapsed launcher, reduced motion, keyboard exit, copying options and saved agenda restoration.

## Maintenance

Code and Q&A text come from the reader. A wording change or renumbering needs no matching tour edit. When redesigning an app control, keep its tour marker on the equivalent interactive element and run that lesson at both phone and desktop sizes. If a featured provision or tool is retired, select a replacement example in the lesson. The tour definitions hold the coaching text; they do not store a copy of the Code.
