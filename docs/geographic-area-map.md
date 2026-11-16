# Map of Annex III: data notes

How the interactive map in **Annex III** (`/code/annex3`) is made, where its content comes from, and what it simplifies. The component is `src/components/GeographicAreaMap.jsx`.

## What readers see

- **Closed**, the map shows what the published figure shows: the MedTech Europe Geographic Area in teal, and in the lighter colour the land the figure draws that way (the Western Balkans, South Africa with Lesotho and Eswatini).
- **Selecting a country**, on the map or in the "Country" list above it, lifts the country off the map and opens a card with: the Annex III list it belongs to, its National Associations, and links to their Codes on ethicalmedtech.eu. "Whole map", the card's close button, the Escape key or a click beside the country go back.
- **"Countries covered by Mecomed"** is one entry of Annex III and opens as one area, with Mecomed's Code and the Annex's own note on the Disclosure Guidelines.
- **Print** uses the published figure, not the interactive map. So does the page when the map cannot load.

The map shows above the section's text, in place of the figure. The figure stays in the Code's text (`src/data/code/annex3.json`), first in the section, marked `data-reader-embed="geographic-area-map"`; `src/config/readerEmbeds.js` connects that name to the component.

## Where the content comes from

| What | Source | Kept in step by |
|---|---|---|
| The areas and their names | The two country lists of Annex III. Repeated in `src/data/geographicArea/areas.json`, because each area needs a shape | `npm run validate:data`: an entry added to, removed from or renamed in the Code's lists is an error until `areas.json` and the drawing follow |
| The Mecomed note | Annex III's footnote, word for word (`note` in `areas.json`) | `npm run validate:data` |
| National Associations and their Codes | The country cards of ethicalmedtech.eu, "MedTech Europe National Associations' Codes" (`/resources/medtech-codes/`), edited in that site's CMS and published by it as `/data/national-associations.json` | The map reads the published list when it is shown. `src/data/geographicArea/nationalAssociations.json` is this app's copy, for offline use and until the request answers: refresh it with `npm run sync:national-associations` |
| The drawing | `src/data/geographicArea/map.json`, made by `npm run build:geographic-area-map` | `npm run validate:data`: one shape per area |

A country matches its ethicalmedtech.eu card by name ("The Netherlands" and "Netherlands" are the same). The Mecomed area matches the card that lists the association "Mecomed", whatever the card is called (today "Middle East & North Africa").

`npm run validate:data` also prints two notes, which are not errors:

- Countries in "Countries with National Associations" for which ethicalmedtech.eu lists no Code (on 16 November 2026: Bulgaria, Croatia, Estonia, Israel, Latvia, Lithuania). Their card says so; it names no association.
- Countries ethicalmedtech.eu lists that Annex III does not (Russia). They are not on the map.

## When Annex III changes

1. Edit the Code's text as usual.
2. `npm run validate:data` says which entries differ. Make the same change in `areas.json`. A new country needs its Eurostat country code as `id` (Greece is `EL`, the United Kingdom `UK`).
3. `npm run build:geographic-area-map`, then `npm run validate:data` again.
4. If a new edition of the Code brings a new figure, replace the file in `public/code-assets/` and compare the drawing with it (below).

## The drawing

- **Redrawn from the published figure.** The figure (`public/code-assets/annex-iii-map-september-2024.png`, the bitmap of PDF page 75) is a picture, so it cannot be clicked. The drawing uses the figure's own frame: Mercator, 874 × 886 units, at the figure's scale and position, so one unit is one pixel of the figure and the two can be laid over each other. With the boundaries fitted over the figure, every country was sorted by the colour the figure gives it; the result is in the lists at the top of `scripts/build-geographic-area-map.mjs`.
- **The countries covered by Mecomed are not listed in the Code.** The shape drawn for them is what the figure shades: Africa except South Africa, Lesotho and Eswatini, with Madagascar; Bahrain, Iran, Iraq, Jordan, Kuwait, Lebanon, Oman, Pakistan, Palestine, Qatar, Saudi Arabia, Syria, the United Arab Emirates and Yemen. The map never names these countries: the area is one click target, called "Countries covered by Mecomed" as in Annex III.
- **Boundaries:** Eurostat GISCO, countries 2024, at 1:20 million for the map and 1:3 million for a country's own drawing, shown when it is opened. © EuroGeographics for the administrative boundaries. The files are downloaded to `.cache/geographic-area/` (not in Git); `-- --refresh` downloads them again.

### Differences from the published figure

- The figure's base map is coarse. The drawing has **Malta** and **Liechtenstein**, which the figure is too coarse to show although Annex III lists them; each also gets a ring, so it can be seen and clicked.
- **Andorra, Monaco, San Marino and the Vatican City** are drawn in the lighter colour, so they are not coloured as part of France, Spain or Italy. The figure does not show them.
- **Kashmir:** the figure's shape for Pakistan includes the part of Jammu and Kashmir that Pakistan administers. The boundary files hold Jammu and Kashmir as a separate disputed area covering both sides, so the drawing shows Pakistan without it.
- **Small island states off Africa** (Cabo Verde, the Comoros, Mauritius, São Tomé and Príncipe, the Seychelles) are not in the figure and are not drawn.
- **Not drawn, as in the figure:** the French overseas regions, the Canary Islands, Madeira, the Azores, Svalbard, the Faroes and the Crown Dependencies.
- Islands smaller than about a third of a unit are left out, and coastlines are simplified.
