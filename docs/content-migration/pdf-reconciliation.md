# PDF Reconciliation Log

## Policy

Approved on 22 July 2026:

- The September 2024 PDF governs substantive Code wording.
- Unmistakable typographical or printing errors in the PDF remain corrected in
  the app and are recorded in this log.
- Footnote differences are reviewed separately and are never changed by
  assumption.
- App-authored navigation metadata, including chapter summaries, is outside the
  verbatim comparison.
- Each split chapter is reviewed independently with the audit script, a second
  PDF text extractor, and direct visual inspection of the relevant pages.
- Only the chapter under review may be edited. Data, route, test, and production
  build checks follow every approved chapter change.

The immutable split manifest remains the proof of the original migration. It
must not be regenerated after approved content corrections.

## Revised Word Reconciliation — 2026-09-24

The app text was compared directly with `code-september-2024.docx`. The content
owner reviewed the short wording differences and approved these Word-aligned
changes:

| Location | Previous app text | Approved text |
| --- | --- | --- |
| Chapter 1 | `with the the requirements` | `with the requirements` |
| Chapter 2 | `Such In-Kind support` | `Such In Kind support` |
| Chapter 3 | `Chapter 3, Section 2` | `Chapter 3, Section2` |
| Annex VI | `it is a third party chooses` | `a third party chooses` |
| Annex VII | `3D rending software` | `3D rendering software` |

The content owner chose to retain the app wording for the other reviewed short
differences, including the punctuation corrections, `www.who.int`, defined-term
capitalization, and the Annex I sentence-ending full stop. Those are approved
app-versus-Word exceptions rather than unresolved discrepancies.
The PDF-to-DOCX builder records all 13 reviewed choices so the next rebuild
will produce the aligned Word working copy. The binary DOCX is intentionally
left unchanged in this text-only change so it can be merged through review
systems that do not accept binary patches.

## Scope

- File: `src/data/code/scope.json`
- PDF pages: 5-8
- Status: reviewed; no content change required
- Result: every source-backed field matches after layout normalization except
  the four unmistakable PDF errors below.

Intentional corrections retained in the app:

| PDF page | PDF text | App text | Reason |
| --- | --- | --- | --- |
| 7 | `sponsorhip` | `sponsorship` | Misspelling |
| 7 | `Healthcare Professionalsthe` | `Healthcare Professionals the` | Missing space |
| 8 | `from the date of the date of the change` | `from the date of the change` | Duplicated words |
| 8 | `Assembly..` | `Assembly.` | Duplicated punctuation |

## Administering The Code

- File: `src/data/code/admin.json`
- PDF pages: 9-13
- Status: reviewed; one punctuation correction applied
- Result: all normative text now matches after layout normalization.

Applied correction:

| PDF page | Previous app text | Corrected app text |
| --- | --- | --- |
| 9 | `MedTech Europe's` | `MedTech Europe’s` |

Structural exception retained:

- `Introductory Text` is an app-authored section label for the unheaded opening
  text printed on PDF page 9. It is retained because the app requires a section
  title for navigation and deep links; it is not part of the normative text.

## Introduction

- File: `src/data/code/intro.json`
- PDF pages: 13-17 (page 13 contains the first section heading)
- Status: reviewed; one punctuation and one substantive wording correction
  applied

Applied corrections:

| PDF page | Previous app text | Corrected app text |
| --- | --- | --- |
| 15 | `alliance's` | `alliance’s` |
| 17 | `Member Companies’ products` | `Member Companies’ Medical Technology or related services` |

Intentional correction retained in the app:

| PDF page | PDF text | App text | Reason |
| --- | --- | --- | --- |
| 16 | `MedicalTechnologies` | `Medical Technologies` | Missing space |

Audit maintenance:

- The Introduction comparison range now begins on PDF page 13 because
  `Promoting an Ethical Industry` is printed at the bottom of that page. This
  removes a false missing-heading result without weakening text comparison.

## Chapter 1: General Criteria For Event

- File: `src/data/code/ch1.json`
- PDF pages: 18-23
- Status: reviewed; one chapter-title correction applied

Applied correction:

| PDF pages | Previous app text | Corrected app text |
| --- | --- | --- |
| 18-23 | `General Criteria for Events` | `General Criteria for Event` |

Intentional corrections and structural labels retained in the app:

| PDF page | PDF text | App text | Reason |
| --- | --- | --- | --- |
| 22 | `CompanyMedical Technology` | `Company Medical Technology` | Missing space |
| 18 | No heading | `Introductory Text` | App section label required for navigation |

Audit extraction notes:

- Section 2 legal text and the answer to Q9 span pages with two independently
  ordered columns. The PDF extractor inserts adjacent Q&A or section text into
  the comparison stream even though visual review and the second extractor
  confirm that the app fields match.
- `7. Virtual Events` is visually exact on page 22. The baseline audit labels it
  a punctuation difference while reporting zero token operations.

## Chapter 2: Third Party Organised Educational Events

- File: `src/data/code/ch2.json`
- PDF pages: 24-27
- Status: reviewed; four corrections applied

Applied corrections:

| PDF page | Previous app text | Corrected app text |
| --- | --- | --- |
| 24 | `Third Party Educational Events` | `Third Party Organised Educational Events` |
| 24 | `Member Company Medical Technology` | `Member Company products` |
| 25 | `(see the Glossary)¹.` | `(see the Glossary).¹` |
| 26 | `For the avoidance of doubt` | `For the avoidance of doubts` |

Intentional corrections and structural labels retained in the app:

| PDF page | PDF text | App text | Reason |
| --- | --- | --- | --- |
| 26 | `a larger Third Party Organised Educational Conferences` | `a larger Third Party Organised Educational Conference` | Singular article requires singular noun |
| 27 | `Such In Kkind support` | `Such In-Kind support` | Duplicated `K`, missing hyphen |
| 24 | No heading | `Introductory Text` | App section label required for navigation |

Audit extraction note:

- The section 2 footnote marker and final period are visually and independently
  confirmed as `(see the Glossary)².`. The baseline extractor reports a
  punctuation difference because of superscript ordering; the app already
  matches the rendered page.

## Chapter 3: Company Events

- File: `src/data/code/ch3.json`
- PDF pages: 28-32
- Status: reviewed; no content change required

Intentional correction retained in the app:

| PDF page | PDF text | App text | Reason |
| --- | --- | --- | --- |
| 32 | `Section2` | `Section 2` | Missing space |

Audit extraction notes:

- The section 2 and section 3 legal-text fields share pages with Q&A columns.
  The baseline extractor inserts Q21 or Q23 into otherwise matching text.
- Two sentence-opening `The` tokens are visibly capitalized and independently
  extracted with capitals. Their reported lowercase PDF forms are ordering or
  normalization artifacts, not content differences.

## Chapter 4: Grants And Charitable Donations

- File: `src/data/code/ch4.json`
- PDF pages: 33-40
- Status: reviewed; two footnote corrections and one duplicated-content removal
  applied

Applied corrections:

| PDF page | Previous app content | Corrected app content |
| --- | --- | --- |
| 37 | `(see the Glossary) ³.` | `(see the Glossary)³` |
| 37 | `3). For scope of application...` | `3) For scope of application...` |
| 38-39 | Q35 repeated three paragraphs that already appeared in the main Educational Grants section | Q35 now ends at `Code’s Disclosure Guidelines.` as printed in the Q&A column |

Intentional corrections retained in the app:

| PDF page | PDF text | App text | Reason |
| --- | --- | --- | --- |
| 34 | `Donations..` | `Donations.` | Duplicated punctuation |
| 35 | `Technoloy` | `Technology` | Misspelling |
| 37 | `Member Ccompanies` | `Member Companies` | Capitalization/typing error |
| 37 | `critera` | `criteria` | Misspelling |
| 38 | `Healthcare Organisation, , all` | `Healthcare Organisation, all` | Duplicated comma |
| 39 | `funded.If` | `funded. If` | Missing space |
| 39 | `brand-agnostic,”` | `brand-agnostic,` | Stray closing quotation mark |
| 39 | `Member CompanyMedical Technology` | `Member Company Medical Technology` | Missing space |
| 40 | `Member Ccompany-organised` | `Member Company-organised` | Capitalization/typing error |

Audit extraction notes:

- The chapter’s long legal-text fields share pages with Q25-Q36. The baseline
  extractor repeatedly inserts neighboring Q&A text into otherwise matching
  fields.
- Q29 is visually exact and its reported punctuation difference contains zero
  token operations.
- Q36’s `1.`, `2.`, and `3.` are generated by the existing semantic HTML
  ordered list. They are visible in the app even though the audit’s HTML text
  extraction does not emit generated list numbers.

## Chapter 5: Consulting Arrangements

- File: `src/data/code/ch5.json`
- PDF pages: 41-45
- Status: reviewed; no content change required

Intentional corrections retained in the app:

| PDF page | PDF text | App text | Reason |
| --- | --- | --- | --- |
| 43 | `Medical Technology,.` | `Medical Technology.` | Duplicated punctuation |
| 45 | `scope of the Consultancy Arrangement Member Companies...` | `scope of the Consultancy Arrangement. Member Companies...` | Missing sentence-ending full stop |

Audit extraction note:

- The running footer on pages 42-45 says `CHAPTER 4: CONSULTING ARRANGEMENTS`,
  while the chapter divider and Code structure identify this as Chapter 5.
  Running headers and footers are not app content and are excluded from the
  field comparison.

## Chapter 6: Research

- File: `src/data/code/ch6.json`
- PDF pages: 46-50
- Status: reviewed; five corrections applied

Applied corrections:

| PDF page | Previous app text | Corrected app text |
| --- | --- | --- |
| 47 | `Member Companyinitiated research` | `Member Company-initiated research` |
| 48 | `postmarket third party evaluation` | `post-market third party evaluation` |
| 50 | `study initiator and sponsor` | `study [initiator and] sponsor` |
| 50 | `Member company` | `Member Company` |
| 50 | `is clear expressed` | `is clearly expressed` |

Intentional corrections retained in the app:

| PDF page | PDF text | App text | Reason |
| --- | --- | --- | --- |
| 47 | `www.who.org` | `www.who.int` | The current official World Health Organization domain is `who.int` (verified 2026-07-22) |
| 48 | `ethicalrequirements` | `ethical requirements` | Missing space |
| 49 | `asFaculty` | `as Faculty` | Missing space |
| 49 | `(“Glossary’)` | `(“Glossary”)` | Mismatched quotation marks |
| 49 | `yhird party-initiated` | `third party-initiated` | Misspelling |
| 49 | `Member companies` | `Member Companies` | Defined-term capitalization |
| 49 | `i.e a fee-for-service agreement` | `i.e. a fee-for-service agreement` | Missing punctuation |
| 49 | `research.Member Companies` | `research. Member Companies` | Missing space |
| 50 | `publication .` | `publication.` | Space before punctuation |

Audit extraction notes:

- The left legal-text and right Q&A columns on pages 47 and 49 are interleaved
  by the baseline extractor. This accounts for Q37 and Q38 text appearing in
  the corresponding legal-text differences.
- The reported trailing `3` for section 2 is the following section number, not
  part of the section 2 text; both the rendered page and independent extraction
  confirm the boundary.
- The section 3 punctuation result contains no token operation. Its content is
  visually exact apart from the separately documented Q38 printing errors.

## Chapter 7: Royalties

- File: `src/data/code/ch7.json`
- PDF pages: 51-52
- Status: reviewed; no content change required

Audit extraction note:

- The chapter has one unheaded content section. Its empty app section title is
  intentional because page 52 begins directly with the legal text. The baseline
  audit reports the empty title as requiring review, while the legal-text body
  is exact after layout normalization.

## Chapter 8: Educational Items And Promotional Items

- File: `src/data/code/ch8.json`
- PDF pages: 53-55
- Status: reviewed; one title correction and eight list-label punctuation
  corrections applied

Applied corrections:

| PDF page | Previous app text | Corrected app text |
| --- | --- | --- |
| 53 | `Educational and Promotional Items` | `Educational Items and Promotional Items` |
| 54 | List labels `a` through `h` | List labels `a.` through `h.` |

Intentional corrections retained in the app:

| PDF page | PDF text | App text | Reason |
| --- | --- | --- | --- |
| 54 | `b.No educational items` | `b. No educational items` | Missing space |
| 54 | `Chapter 8.Educational Items` | `Chapter 8. Educational Items` | Missing space |
| 54 | `Promotionl Items` | `Promotional Items` | Misspelling |

Audit extraction notes:

- Like Chapter 7, this chapter has one unheaded content section; its empty app
  section title is intentional.
- The legal text and Q41-Q43 share two columns on page 54. The extractor inserts
  Q41 and its answer into the otherwise matching legal-text stream.

## Chapter 9: Demonstration Products And Samples

- File: `src/data/code/ch9.json`
- PDF pages: 56-58
- Status: reviewed; one substantive footnote correction applied

Applied correction:

| PDF page | Previous app footnote | Corrected app footnote |
| --- | --- | --- |
| 57 | `For the placement of capital equipment, please refer to Chapter 3, Section 4: Sales, Promotional and Other Business Meetings.` | `Please note MedTech Europe has issued the “MedTech Europe Guidance on Placement of Capital Equipment”. It can be found in the Members Area or upon request to the Secretariat (only available to Members).` |

The corrected app footnote also includes the PDF’s `4)` label. The refreshed
audit classifies the complete footnote as exact after layout normalization.

Intentional correction retained in the app:

| PDF page | PDF text | App text | Reason |
| --- | --- | --- | --- |
| 57 | `Medica;l Technology` | `Medical Technology` | Stray semicolon inside the word |

## Chapter 10: Third Party Intermediaries

- File: `src/data/code/ch10.json`
- PDF pages: 59-61
- Status: reviewed; one capitalization correction applied

Applied correction:

| PDF page | Previous app text | Corrected app text |
| --- | --- | --- |
| 61 | `Member companies` | `Member Companies` |

Intentional corrections retained in the app:

| PDF page | PDF text | App text | Reason |
| --- | --- | --- | --- |
| 60 | `arrangements ; and` | `arrangements; and` | Space before punctuation |
| 61 | `where applicable applicable, exercise` | `where applicable, exercise` | Duplicated word |

Audit extraction note:

- The chapter has one unheaded content section. Its empty app section title is
  intentional because page 60 begins directly with the legal text.

## Part 2: Complaint Handling And Dispute Resolution

- File: `src/data/code/part2.json`
- PDF pages: 62-66
- Status: reviewed; substantive omissions restored and non-PDF headings removed

Applied corrections:

| PDF page | Previous app content | Corrected app content |
| --- | --- | --- |
| 63 | First use of `MedTech Europe Member Company` omitted the defined-term parenthetical | Restored `(together “Member Companies” or individually “Member Company”)` |
| 63 | Footnote 5 appeared after the sentence punctuation | Restored the PDF marker order as `Panel⁵.` |
| 63 | `2.3 Processing of complaints` | `2.3. Processing of complaints` |
| 64 | App-only heading `2.4 Exceptions and Referrals` | Replaced with the complete PDF clause beginning `2.4. Notwithstanding any provisions...` |
| 64 | Section 2.4 items iii, v and vi were shortened | Restored the omitted referral, Compliance Panel decision, and waiver-petition clauses verbatim from the PDF |
| 64 | `under CVS.` | Restored `under the Conference Vetting System, whether or not it was actually assessed.` |
| 65 | Section 3.1 item v was shortened | Restored the court and criminal-proceedings notification clause |
| 65 | Section 3.2 items i and ii and both nested mediation items were shortened | Restored the omitted national-code, responsible-body, timeframe, referral, and final-decision wording verbatim from the PDF |
| 65-66 | App-only heading `4.1 Principles and Range of Sanctions` and shortened sanction text | Restored the complete PDF 4.1 clause and both references to membership of the Member Association and/or MedTech Europe |
| 66 | App-only heading `4.2 Transparency and Reporting` and shortened final paragraph | Restored the complete PDF 4.2 clause and the omitted explanatory parenthetical |

Intentional correction retained in the app:

| PDF page | PDF text | App text | Reason |
| --- | --- | --- | --- |
| 64 | `laid down in in this section` | `laid down in this section` | Duplicated word |

Audit and rendering notes:

- The app uses semantic ordered lists for the two sets of lower-Roman items.
  Their numerals are visibly generated by the browser, while the audit's HTML
  text extraction does not emit generated list markers.
- Footnote 5 is independently exact. The baseline body extractor additionally
  inserts the footnote text into the surrounding section comparison because it
  appears on the same page.
- After the corrections, section 4 is exact after layout normalization and no
  omitted substantive Part 2 clause remains in the audit.
- The revised chapter was rendered in the running app. The restored long
  clauses wrap correctly, the lists and footnote display correctly, and the
  tested desktop page has no horizontal overflow.

## Glossary And Definitions

- File: `src/data/code/glossary.json`
- PDF pages: 67-71 (definitions appear on pages 68-71)
- Status: reviewed; all 38 definitions reconciled term by term

Applied corrections:

| PDF page | Previous app content | Corrected app content |
| --- | --- | --- |
| 68 | `Code` preceded `Company Events` and `Conference Vetting System (CVS)` | Restored the PDF order: Company Events, Conference Vetting System (CVS), Code |
| 68 | `Demonstration Products (Demos)` preceded `Disclosure Guidelines` | Restored the PDF order: Disclosure Guidelines, Demonstration Products (Demos) |
| 70 | `Product and Procedure Training and Education Event` preceded `Professional Conference Organiser (PCO)` | Restored the PDF order: Professional Conference Organiser (PCO), Product and Procedure Training and Education Event |
| 71 | `Third Party Organised Educational Conferences` preceded `Third Party Organised Educational Events` | Restored the PDF order: Third Party Organised Educational Events, Third Party Organised Educational Conferences |
| 68-71 | 33 definitions opened with app-capitalized `Means`; Clinical Research and PCO opened with app-capitalized `A` | Restored the PDF's lowercase `means` and `a` openings |
| 68-71 | Straight apostrophes and quotation marks in visible definition text | Restored the PDF's typographic apostrophes and quotation marks |
| 70 | The three Product and Procedure training items were flattened into one sentence with two added semicolons | Restored the three items as a semantic HTML list with the PDF punctuation |

Intentional corrections retained in the app:

| PDF page | PDF text | App text | Reason |
| --- | --- | --- | --- |
| 69 | `provide services..` | `provide services.` | Duplicated punctuation |
| 70 | `Medical Technology . Engaging` | `Medical Technology. Engaging` | Space before punctuation |
| 71 | `a Members Company’s medical technologies` | `a Member Company’s medical technologies` | Erroneous plural in the singular possessive defined term |

Audit and rendering notes:

- An independent definition-aware comparator matched all 38 app terms to all
  38 PDF terms in the same order. Its only remaining token operations are the
  two intentional PDF typo corrections on pages 69 and 71; punctuation-spacing
  normalization accounts for the page 70 correction.
- The baseline audit reports 99.9475% similarity for the complete glossary
  body. It retains a `substantive_review_required` label because one of the two
  documented exceptions changes `Members` to `Member`, not because content is
  missing.
- The revised glossary was rendered in the running app. The semantic list,
  definition order and typography display correctly, and the tested desktop
  page has no horizontal overflow.
- No chapter ID, section ID, route or link target changed.

## Annex I: CVS Scope

- File: `src/data/code/annex1.json`
- PDF page: 72
- Status: reviewed; shortened table labels restored without changing any
  decision cell

Applied corrections:

| Area | Previous app content | Corrected app content |
| --- | --- | --- |
| Table heading | Omitted | Restored `PRIOR CVS SUBMISSION` |
| Geographic column groups | `Taking place inside/outside the MedTech Europe Geographic Area` | Restored `IN MEDTECH EUROPE GEOGRAPHIC AREA` and `OUTSIDE MEDTECH EUROPE GEOGRAPHIC AREA` |
| Four event headers | Shortened descriptions using `MTE Area` and `MTE HCPs` | Restored the complete PDF descriptions and footnote markers 1, 2 and 3 |
| Educational Grants rows | `General running of conference`, `Funds to support HCP attendance`, and `Funds to support Faculty` | Restored all three complete PDF row labels and the full group label |
| Commercial Activities | `Booths / Advertising` and source text in title case | Restored `Booths/advertising` and source-uppercase `COMMERCIAL ACTIVITIES` |
| Direct Sponsorship rows | Shortened group and row labels | Restored the complete geographic-area group label and both `Direct sponsorship of HCPs...` row labels |
| Footnote 1 | `The MedTech Europe Geographic Area includes...` | `MedTech Europe Geographic Area includes...` |

All CVS outcomes, permissions, prohibitions and internal-review requirements
were already consistent with the PDF and were left unchanged.

Intentional corrections retained in the app:

| PDF location | PDF text | App text | Reason |
| --- | --- | --- | --- |
| National event header | `local HCPs only)` with no opening parenthesis | `local HCPs only` | Unmatched closing parenthesis |
| Footnote 4 | Definition ends at `within this category` | Definition ends at `within this category.` | Missing sentence-ending full stop |

Audit and rendering notes:

- The table body now has 99.8794% audit similarity and one remaining operation:
  the documented unmatched parenthesis. The footnotes have 99.7972% similarity
  and one remaining operation: the documented final period.
- `Annex I: CVS Scope` is retained as the concise app navigation title. The
  complete canonical PDF heading is exact in the section title. `Footnotes` is
  an app section label needed for navigation; the PDF has no standalone
  footnotes heading.
- The corrected six-column table and its row spans were rendered in the running
  app. It scrolls horizontally inside its existing container, while the page
  itself has no horizontal overflow.
- No chapter ID, section ID, route or link target changed.

## Annex II: Calculating The Value Of In Kind Educational Grants

- File: `src/data/code/annex2.json`
- PDF pages: 73-74
- Status: reviewed; two punctuation/hyphenation corrections applied

Applied corrections:

| PDF page | Previous app text | Corrected app text |
| --- | --- | --- |
| 73 | `please refer to the table below:` | `please refer to the table below.` |
| 73 | `Goods (whether third party or Member Company produced)` | `Goods (whether third party or Member Company-produced)` |

Intentional correction retained in the app:

| PDF page | PDF text | App text | Reason |
| --- | --- | --- | --- |
| 73 | `the payment is made directlyby the Member Company` | `the payment is made directly by the Member Company` | Missing space |

Audit and rendering notes:

- The three substantive content sections other than the documented missing
  space are now exact after layout normalization. All valuation categories and
  valuation methods match the PDF.
- `Annex II: ...` is retained as the app's concise navigation title; the PDF
  prints `ANNEX II` without the app separator. `Exclusions` is an app section
  label for the final unheaded PDF list.
- Both corrected strings were verified in the running app, the table renders
  intact, and the tested desktop page has no horizontal overflow.
- No chapter ID, section ID, route or link target changed.

## Annex III: The Geographical Area Where The Code Applies As The Minimum Standard

- File: `src/data/code/annex3.json`
- PDF page: 75
- Status: reviewed; canonical text reconciled and the PDF-native map restored

Applied corrections:

| Area | Previous app content | Corrected app content |
| --- | --- | --- |
| Annex title | `Annex III: Geographic Scope` | Restored the complete PDF title after the app's `Annex III:` navigation prefix |
| Introduction | Added interpretation stating that coverage is determined by HCP/HCO location | Restored `The MedTech Europe Geographic Area currently includes` |
| National Associations | Alphabetical app list with `Netherlands` and `United Kingdom` | Restored all 31 PDF entries in page order, including `The Netherlands`, `The United Kingdom`, and `Countries covered by Mecomed*` |
| EEA countries | Four countries displayed with additional app explanation | Restored the exact PDF heading and the four listed countries |
| Mecomed material | Intentional text-based substitute for the PDF map, including an Africa/Middle East/Central Asia expansion and a South Africa/SAMED note | Replaced in the normative body with only the PDF-listed Mecomed entry and Disclosure Guidelines footnote; the reason for the previous adaptation is retained here |
| Map | Omitted because an earlier attempt could not reproduce it as a suitable SVG | Restored the exact bitmap embedded in PDF page 75, without redrawing, tracing or reinterpretation |

Audit and rendering notes:

- The complete Annex III body now has 100% audit similarity and zero token
  operations. The title differs only by the colon used throughout the app to
  separate an annex number from its navigation label.
- The previous territory grouping was manually authored because the PDF map
  could not be reproduced as a suitable SVG. It was an intentional textual
  accessibility substitute, not accidental content drift. It has now been
  superseded by the source document's own embedded bitmap rather than by a new
  geographic interpretation.
- The restored asset is
  `public/code-assets/annex-iii-map-september-2024.png`: an `874 x 886` RGBA
  image decoded directly from the only embedded image on PDF page 75. Its file
  SHA-256 is
  `08D9D3893F9269C422A8892DD4A90A3CA09D7BD24E4189BC375C38C2C4A67FE7`;
  its decoded-pixel SHA-256 is
  `E344D6595A962E55E37597C456ECA8B1F3EEEACFC50708A6D10BED7A6146B2F3`.
- The map is separate from the canonical text. No visible caption was added,
  because that would introduce wording not present in the normative source;
  the image instead has concise alternative text and follows the complete
  canonical country lists.
- The revised title, 31 National Association entries, four EEA entries, map and
  Mecomed footnote were rendered in the running app. The map renders at
  `560 x 568` on the checked desktop viewport and `352 x 357` at a `390px`
  mobile viewport, remains outside both semantic lists, and causes no
  page-level horizontal overflow.
- The Code print layout was checked from the running app. Annex III prints in
  full across three Letter pages, with the complete map kept together and the
  footnote present. Print-only overflow and animation rules prevent clipped or
  transparent chapter content without affecting the screen layout.
- The production build copies the PNG without changing its SHA-256, and the
  generated Workbox service worker explicitly precaches the asset for offline
  use.
- No chapter ID, section ID, route or link target changed.

Later change (16 November 2026): interactive map

- On screen, the reader now shows an interactive redrawing of the map above the
  section's text (`docs/geographic-area-map.md`). The exact bitmap described
  above is unchanged and stays in the normative body: it is what prints, and
  what shows where the interactive map cannot load.
- The `<figure>` moved from between the EEA list and the footnote to the start
  of the section, before `The MedTech Europe Geographic Area currently
  includes`, and gained the attribute `data-reader-embed="geographic-area-map"`.
  No wording changed: `npm run verify:code-docx` reports the same findings
  before and after.
- The redrawing was fitted over the bitmap and shades the same countries. Its
  known differences from the bitmap are listed in `docs/geographic-area-map.md`,
  "Differences from the published figure".

## Annex IV: Verification Of The Use Of Funds

- File: `src/data/code/annex4.json`
- PDF page: 76
- Status: reviewed; three shortened headings and one ordered-list presentation
  corrected

Applied corrections:

| Area | Previous app content | Corrected app content |
| --- | --- | --- |
| Annex title | `Verification of the Use of Funds` | Restored the PDF capitalization `Verification Of The Use Of Funds` |
| Attendance grant | `Grant to support HCP attendance` | Restored the full Healthcare Professionals/Third Party Organised Educational Event heading |
| Organisation grant | `Grant to support organisation costs` | Restored the complete costs-related heading |
| Scholarship/Fellowship grant | `Scholarship or Fellowship` | Restored `Grant provided in a form of a Scholarship or Fellowship:` |
| Failure responses | App-generated numbered items `1` and `2`; second response lacked its final period | Restored an unordered semantic list and the final period |

Intentional correction retained in the app:

| PDF page | PDF text | App text | Reason |
| --- | --- | --- | --- |
| 76 | `the Member Company.` immediately before two response bullets | `the Member Company:` | A colon correctly introduces the following list |

Audit and rendering notes:

- The verification-process prose and all three document groups are now exact
  after layout normalization. The failure-response body differs only by the
  documented colon and by browser-generated unordered-list bullets.
- `Verification Process`, `Verification Documents` and `Failure to Comply` are
  app section labels used for navigation; the PDF presents this material as a
  continuous page without those headings.
- The longer canonical headings exposed cramped text in the previous
  three-column card grid. The grid now uses one column on mobile and two at
  desktop widths. The corrected cards and failure list were rendered in the
  running app and the page has no horizontal overflow.
- No chapter ID, section ID, route or link target changed.

## Annex V: Methodology Note Example

- File: `src/data/code/annex5.json`
- PDF page: 77
- Status: reviewed; list hierarchy and disclaimer corrected

Applied corrections:

| Area | Previous app content | Corrected app content |
| --- | --- | --- |
| Top-level structure | Every line was presented with the same bullet marker | Restored the PDF's six dash-prefixed items, four unmarked lines and nested bullet groups |
| Consent management | `Consent collection`, withdrawal, request and partial-consent items were siblings of `Consent management` | Restored all four as children of `Consent management` |
| Disclaimer | `requirements set out in the Disclosure Guidelines, Section 2.4 Methodology` | `requirements set out in Section 2.4 Methodology` |

Audit and rendering notes:

- The complete Annex V body is now exact after layout normalization.
- `Structure` is visibly present in the PDF and was retained. Its earlier audit
  deletion was a field-boundary extraction artifact, not app-only wording.
- The title differs only by the app's annex-number separator colon.
- The dash/plain/bullet hierarchy, nested consent items and complete disclaimer
  were rendered in the running app. Each item has one marker and the page has
  no horizontal overflow.
- No chapter ID, section ID, route or link target changed.

## Annex VI: Direct Support To HCP Participation In Events

- File: `src/data/code/annex6.json`
- PDF page: 78
- Status: reviewed; flattened support matrix rebuilt to preserve the PDF table
  hierarchy and complete wording

Applied corrections:

| Area | Previous app content | Corrected app content |
| --- | --- | --- |
| Annex title | `Annex VI: Direct Support for HCP Attendance` | Restored `Annex VI: Direct support to HCP participation in Events` |
| Matrix structure | Four-column table that repeated event groups inside setting labels | Restored the PDF's five effective columns, merged `Setting` header, row groups and row spans |
| Procedure Training row | Short note `See Q&A 18 for criteria` | Restored `*The criteria for a Third Party Organised Procedure Training meeting can be found in Q&A 18` |
| Company Events | Repeated `Company Events:` in both subtype labels | Restored one shared `Company Events` group with the two canonical event subtypes |
| Outcomes | Allowed/not-allowed outcomes were present in a flattened layout | Preserved every outcome while restoring its canonical row and column association |

Intentional PDF typo corrections retained in the app:

| PDF page | PDF text | App text | Reason |
| --- | --- | --- | --- |
| 78 | `a thirdpParty chooses` | `a third party chooses` | Obvious joined-word and capitalization typo |
| 78 | `third pParty vs.` | `third party vs.` | Obvious capitalization typo |
| 78 | `a Third Third Party Organised Educational Event` | `a Third Party Organised Educational Event` | Obvious duplicated word |

Audit and rendering notes:

- The Description section is exact after layout normalization. Guidance differs
  only by the two documented typo corrections, and the matrix differs only by
  the documented duplicated `Third` correction.
- The title differs from the PDF only by the app's annex-number separator colon
  and title-case convention for `Annex`.
- The running app renders all ten rows and five effective columns. The existing
  table container scrolls horizontally (`584px` viewport over a `1050px` table)
  without creating page-level overflow; both the event hierarchy and outcome
  columns were inspected at opposite scroll positions.
- No chapter ID, section ID, route or link target changed.

## Annex VII: The Criteria Applicable To Third Party Organised Procedure Trainings

- File: `src/data/code/annex7.json`
- PDF pages: 79-80
- Status: reviewed; full title, examples heading and criteria punctuation
  restored

Applied corrections:

| Area | Previous app content | Corrected app content |
| --- | --- | --- |
| Annex title | `Annex VII: Criteria for Third Party Organised Procedure Trainings` | Restored `Annex VII: The Criteria Applicable to Third Party Organised Procedure Trainings` |
| Support callout | Added heading `Support Mechanisms` | Removed the app-only heading while retaining the complete canonical support text |
| Practical-session introduction | `Examples of practical sessions:` | Restored `The following will be considered as examples of practical sessions:` |
| Criteria labels | Card badges and headings omitted punctuation, for example `1` and `Programme` | Restored `1. Programme:`, `2. Venue:`, `3. Stand-alone event:` and `4. Size:` |

Audit and rendering notes:

- Both Annex VII legal-text bodies are exact after layout normalization. No
  source spelling was silently corrected; for example, `3D rending software`
  remains exactly as printed in the PDF.
- The chapter title differs only by the app's annex-number separator colon and
  title-case convention for `Annex`.
- The report still flags `Criteria for TPPT Determination` because its fuzzy
  section-title matcher anchors against words in the preceding subtitle. The
  heading was independently confirmed in the PDF text extraction and rendered
  page image and therefore remains unchanged.
- The long title, restored examples heading and all four criteria cards were
  inspected in the running app at a `1280px` viewport. They wrap cleanly and
  the page has no horizontal overflow.
- No chapter ID, section ID, route or link target changed.

## Final Whole-Code Audit

- Audit date: 22 July 2026
- Authoritative PDF SHA-256:
  `9ED658D0C9F858E35576C3905CC4423DF934DB894786F4C12D9A130E0602A148`
- Corrected split-files SHA-256:
  `7CDB58249FAF41A7A7BDBFE6FE7E7089BE496914F2DFDA942AC5B9CEF1C7CB1D`
  (updated after the Annex III image markup and app-only Version History
  metadata were added; the visible canonical text and audit classifications
  are unchanged)
- Frozen pre-correction monolith SHA-256:
  `CAA166803AC1EE0CD2B19E0BB1998C6688C53DA8B3FA66F5F3CF75CBA2283EAC`
- Scope: 241 source-backed fields across all 22 PDF-backed chapters. The
  app-only Version History chapter is intentionally excluded.

Final result:

- 179 fields are exact after layout normalization.
- All 62 remaining fields were classified by exact audit path, with a set
  equality assertion confirming zero unclassified and zero stale paths.

| Residual classification | Fields |
| --- | ---: |
| Intentional PDF typo or printing-error corrections | 23 |
| PDF extraction or field-boundary artifacts | 11 |
| App navigation labels or annex-title conventions | 18 |
| Semantic HTML-generated list or layout markers | 4 |
| Documented correction combined with an extraction or HTML artifact | 6 |

- Each residual is explained in its chapter section above. No residual is an
  unreviewed substantive discrepancy.

Safeguards:

- The classifications are documentation only. They are not embedded as audit
  suppressions, so a future content change will still produce a fresh strict
  comparison result instead of inheriting an exemption.
- Every chapter was also checked with an independent PDF text extractor and
  direct inspection of the rendered source pages.
- A read-only audit rerun after the CMS workflow verification reproduced the
  same 179 exact fields and 62 documented residual classifications. Opening and
  inspecting the local CMS did not change the canonical chapter content.
- `npm run check` passes data validation, all 19 tests, TypeScript checking and
  the production build. The route tests round-trip every live chapter and
  section link and confirm that known section IDs remain stable.
