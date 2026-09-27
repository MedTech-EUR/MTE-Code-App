# Event support checker (“Can we support this event?”)

Route: `/event-support`, from the Home Hub and the sidebar’s Decision Trees group.

The checker takes one thing a company plans to provide — an Educational Grant, a booth, a
payment to an HCP, a meal, an item, a donation and so on — asks only the questions that can
change the answer, checks a third-party Event’s live status in the Conference Vetting System
(CVS) when it matters, and gives the Code’s position with its reasons, conditions and sources.
It then compares other ways to support the same Event, keeping the facts already given.

It is a guide to the Code, not company approval. Its answers say so.

## How it decides

| File | Role |
| --- | --- |
| `src/data/eventSupportRules.json` | All wording (questions, conditions, reasons, outcomes), the Annex I and Annex VI tables with their verbatim cell text, the sources, and the CVS status labels. |
| `src/utils/eventSupportQuestions.js` | Which questions to ask, in order. A question is asked only when its answer can change the result, and the list stops once the answers show that the Code does not apply or that the support is not permitted. |
| `src/utils/eventSupportRules.js` | The evaluator: applies the rules to the answers, the Event’s CVS status and the conditions; lists the conditions that apply; updates answers when one changes. It returns message and source IDs, never text. |
| `src/utils/eventSupportCvs.js` | Reads a CVS status label and applies the national-audience precaution (below). |
| `src/utils/eventSupportText.js`, `src/hooks/useCheckerText.js` | Turn the checker’s plain-text wording into HTML in which glossary terms and references such as “Chapter 4, Section 3”, “Annex I” or “Q&A 20” are linked. |
| `src/components/EventSupportContent.jsx` and siblings | The steps, the answer, the side panel, the agenda import (`EventSupportAgenda.jsx`) and the CVS lookup (`CvsEventLookup.jsx`). |

To correct wording, edit the JSON only. Every “Chapter N, Section N”, “Annex N” and “Q&A N”
in it is checked by `npm run validate:data`, which fails when one names nothing and notes one
that falls back to its chapter. The validator also checks the structure: every source must be
an existing Code section or an `ethicalmedtech.eu` guidance page, condition IDs must not clash
with question IDs, and the Annex I and Annex VI tables must be complete.

For a content review, `docs/event-support-wording-and-logic.docx` holds all the checker’s wording,
each text labelled with where it lives, and a plain-language account of when each question and
message appears (rules version 2026-09-26.2, exported on 27 September 2026). It is a snapshot:
carry the reviewers’ approved changes into the JSON, or into the components for the screen texts
it marks, as with the Code’s Word copy.

Answers stay in memory while the checker is open: there is no account, no saved assessment and
no local CVS database. Facts about the Event (its type, format, location, audience, and the
procedure-training answers) are kept when another activity is chosen; answers that belong to
one proposal are cleared.

### Definitions and references

The checker uses the Code’s defined terms, capitalised as the Code does, so the glossary links
them. Terms and references open in the side panel from 1280px, as in the reader, and in the
definition dialog below that. Anything that would open the Code opens it in a new tab, because
leaving the page would lose the answers. The answer’s Sources list uses the same previews.

## Coverage

| Activity | Event types | Main sources |
| --- | --- | --- |
| Educational Grant for general running, HCP attendance or Faculty | Conference, procedure training | Annex I; Chapter 4 and its Q&As; Chapter 1 |
| Booth space, advertising or a satellite symposium | Conference | Annex I; Chapter 2, Section 1; Q&A 15, 16, 29 |
| Speaker at the company’s satellite symposium or booth | Conference | Annex I; Annex VI; Chapter 3, Section 3; Q&A 17; Chapter 5 |
| Company employees attending | Conference, procedure training | Annex I; Q&A 16 |
| An HCP’s costs as a Delegate | Conference, procedure training, Company Events | Annex I; Annex VI; Annex VII; Chapters 2 and 3 |
| An HCP’s fee or expenses for speaking or services | Conference, procedure training, Company Events | Annex I; Annex VI; Chapters 3 and 5 |
| Support for an Event organised by individual HCPs | Conference, procedure training | Q&A 14 and 20 |
| A meal at a meeting, including during a congress | — | Chapter 1, Sections 4 and 6; Chapter 3, Section 3 |
| Educational or promotional items | — | Chapter 8 |
| Demonstration Products and Samples | — | Chapter 9 |
| Proctorships and Preceptorships | — | Q&A 19; Glossary; Chapter 5 |
| Charitable Donations and fundraisers | — | Chapter 4, Sections 1 and 2; Q&A 26 and 28 |
| Research and royalties | — | Points to Chapters 6 and 7 |

Every activity also checks the Code’s scope (Member Companies and their affiliates; the
MedTech Europe Geographic Area of Annex III, which includes the countries covered by Mecomed),
local rules and, where one acts for the company, a Third Party Intermediary (Chapter 10).

Guidance used alongside the Code, and cited as guidance in the answers:

- [CVS guidance on Third Party Procedure Trainings](https://www.ethicalmedtech.eu/conference-vetting-system/third-party-procedure-training/):
  cross-border and international trainings are submitted to CVS; streaming and live surgery
  count as practical only when hands-on sessions follow immediately.
- [MedTech Europe Virtual Events Guidance](https://www.ethicalmedtech.eu/wp-content/uploads/2020/10/20201006_guidance_virtual_events.pdf)
  (Code Committee, 6 October 2020): Virtual Events are not subject to CVS, and HCPs’ attendance
  at them may not be supported directly.
- [CVS 2.0 training, January 2025](https://www.ethicalmedtech.eu/wp-content/uploads/2025/01/CVS-2.0-Training_Slides_deck-v3.0-incl-2025-features-to-upload.pdf):
  the CVS audience questions concern passive Delegates, not Faculty; “Pre-cleared” covers the
  location and venue only; Events in Mecomed countries follow Mecomed’s guidelines; Events are
  submitted at least 50 days ahead; since 1 January 2024 companies check procedure-training
  criteria themselves.

## CVS

A CVS decision is binding on all Member Companies (Administering the Code, Section 1):

- **Compliant:** support that needs a CVS decision may go ahead, subject to the other
  conditions; the Event’s own criteria (programme, venue, social programme) count as met.
- **Not Compliant** or **Not Pre-cleared:** the company may not support the Event. Company
  attendance still needs the internal review of Q&A 16.
- **Not assessed – Late Submission** or **Insufficient information:** support that needs a CVS
  decision cannot be provided.
- **Pending** statuses (To be reviewed, Under Review, Waiting for information, Under Correction
  Notice, Under Appeal) and **Pre-Cleared:** the decision is still needed. A grant agreement can
  make it a pre-condition (Q&A 32).
- Any other label is shown as unrecognised.

Case, spacing and the kind of dash are ignored when labels are compared; nothing else is.

### The national-audience precaution

Requested for this checker and kept separate from the Code’s rules: when the company says a
third-party Event’s Delegates are all local (a national Event, outside CVS scope), the answer
warns unless the Event’s CVS record has one of these whole statuses:

- `Not assessed - Out of scope`
- `Not assessed - National event`

A search with no match, a failed lookup or no lookup gives the warning “CVS scope not
confirmed”. The live CVS status list (checked on 26 September 2026) contains
“Not assessed - Out Of Scope” but no “National event” label; the second label is kept as
requested.

### Live lookup

The browser calls the app’s own Worker, which queries the public CVS site; nothing entered in
the checker is sent.

- `POST /api/cvs/search` with `{ "name": "Heart", "country": "Belgium", "from": "", "to": "" }`
  (dates as `YYYY-MM-DD`) returns `results` (EMT ID, name, dates, city, country, the search
  card’s status and the detail URL), `mayBeLimited` at CVS’s 50-result limit, and `retrievedAt`.
- `GET /api/cvs/events/EMT-26-11175` returns the detail page’s “Overall status of event”.
- Responses are `Cache-Control: no-store`; errors are `{ error: { code, message } }` and never
  assign a status. Foreign origins are refused.

`cvs-parser.js` holds every selector and label, inspected on 26 September 2026; `cvs-adapter.js`
handles the session, a 20-second budget, a 5 MiB page limit and input validation. One search is
one GET and one POST; a selection is one GET; there are no retries, crawls or caches. The checker
fetches the selected Event’s status again before showing or printing an answer, and a late
response cannot replace a newer selection.

The requests to CVS carry no Cloudflare `cf` cache options. With `cf.cacheTtl`, Cloudflare caches
the page and drops its `Set-Cookie`, so the search POST arrives without a session and CVS
redirects it to its login page. `wrangler dev` ignores `cf`, so only `tests/cvs.test.mjs` catches it.

MedTech Europe owns the CVS data, which is public; IQVIA runs the CVS site as its supplier.
Reading the site’s HTML is a stopgap until a CVS API is available: a change to the CVS site stops
the lookup (the parser fails visibly rather than guessing). Production traffic limits should still
be agreed with IQVIA before relying on it in production.

The decision tree “When are CVS assessments required?” uses the same lookup under the results
that depend on CVS (`src/components/TreeCvsCheck.jsx`). Its texts, keyed by the CVS 2.0 status
labels, are the tree’s `cvsCheck` in `src/data/treeData.json`; `tests/annex1Tree.test.mjs` checks
that the tree gives Annex I’s answer for every cell and has a text for every CVS 2.0 status.

Run the Worker locally with `npm run dev:worker` and open `http://127.0.0.1:8787/event-support`
(Vite alone, `npm run dev`, proxies `/api/cvs` to that Worker). For a narrow live check:

```powershell
node scripts/check-cvs-live.mjs --name "Heart" --country Belgium --select 1
```

## Tests

`tests/eventSupport.test.mjs` covers all 32 Annex I cells and 16 Annex VI cells, scope and
geography, Virtual and hybrid Events, CVS statuses and their effects, the precaution, grants,
procedure training, payments, the other activities, conditions and answer changes. It also walks
every path through the questions (with at most one “I don’t know” per path) and checks that each
answer is consistent and fully worded: nothing is permitted while a question is unanswered, and
every message, source and question it uses exists. `tests/cvs.test.mjs` runs the CVS parser, adapter
and API in the Workers runtime against fixtures, without calling CVS.

## Interpretations to confirm

These follow from the Code but are worth a content owner’s confirmation:

1. Events in Mecomed countries: the Code applies and permissions are assessed normally; support
   that would need CVS elsewhere is marked for internal review of Mecomed’s vetting.
2. A Not Compliant decision rules out supporting the Event even where Annex I needs no CVS
   decision for that support (for example a national Event that CVS assessed anyway).
3. In Kind support to an Event organised by individual HCPs follows the Annex I row for
   general-running grants for CVS.
4. A booth at a Virtual Event with no HCPs from the Area gets the internal review Annex I asks for
   at Events outside the Area.
5. An attendance grant for an Event outside the Area that funds no HCPs from the Area, paid to a
   Healthcare Organisation in the Area, is within the Code but needs no CVS decision.
6. Direct support of HCPs from the Area at a procedure training outside the Area needs CVS, as an
   international training.
7. At a Company Event held around a third-party Event, no support is given to Delegates, meals
   included; a lunch or dinner at a business or scientific meeting is assessed as a meal under
   Chapter 3, Section 3.
8. At a Sales, Promotional and Other Business Meeting, Delegates’ reasonable meals are allowed;
   travel and accommodation only for demonstrations of non-portable equipment.

## Manual checks before release

1. Open `/event-support` directly and reload; use Home, the sidebar and Back/Forward.
2. Walk a grant for an international conference: find the Event in CVS, select it, check that
   the Event’s criteria show “Covered by CVS”, and print the summary.
3. Answer “only local Delegates” for an Event with a CVS record and check the warning; try a
   search with no match.
4. Check direct sponsorship at a conference (not permitted, whatever CVS says) and a satellite
   speaker with registration, travel and meals.
5. Import a procedure-training agenda, correct a duration and check every criterion.
6. Select an underlined term and a reference at 1366px (side panel) and at 390px (dialog); open
   the Code from them and check that the checker keeps its answers.
