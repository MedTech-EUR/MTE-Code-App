// National Associations and their Codes, for the map of Annex III (GeographicAreaMap.jsx).
//
// The list is kept in one place: the country cards of ethicalmedtech.eu's "National
// Associations' Codes" page, edited in that site's CMS. That site publishes the cards as data
// (NATIONAL_ASSOCIATIONS_URL). This app carries a copy (data/geographicArea/
// nationalAssociations.json, refreshed with `npm run sync:national-associations`) so the map
// works at once and offline, and reads the current list when a visitor opens the map.

export const NATIONAL_ASSOCIATIONS_URL = 'https://www.ethicalmedtech.eu/data/national-associations.json';

const isText = (value) => typeof value === 'string' && value.trim() !== '';

// Only web addresses become links: the list is read from another site.
const isWebAddress = (value) => {
  if (!isText(value)) return false;
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
};

// The countries of the published list, or null when the data is not in the expected form.
// Entries that are not usable (no name, a link that is not a web address) are left out.
export function readAssociationsList(data) {
  if (!data || !Array.isArray(data.countries)) return null;
  const countries = data.countries
    .filter((entry) => entry && isText(entry.country) && Array.isArray(entry.associations))
    .map((entry) => ({
      country: entry.country.trim(),
      url: isWebAddress(entry.url) ? entry.url : null,
      associations: entry.associations
        .filter((association) => association && isText(association.name))
        .map((association) => ({
          name: association.name.trim(),
          website: isWebAddress(association.website) ? association.website : null,
          codes: (Array.isArray(association.codes) ? association.codes : [])
            .filter((code) => code && isText(code.label) && isWebAddress(code.url))
            .map((code) => ({ label: code.label.trim(), url: code.url })),
        })),
    }))
    .filter((entry) => entry.associations.length > 0);
  return countries.length > 0 ? countries : null;
}

// "The Netherlands" and "Netherlands" are the same country.
const countryKey = (name) => name.trim().toLowerCase().replace(/^the\s+/, '').replace(/\*+$/, '');

// The list's entry for an area of Annex III. A country matches by its name; an area that names
// its association instead (data/geographicArea/areas.json, "association") matches the entry
// that lists that association, whatever the entry is called.
export function findAreaAssociations(area, countries) {
  if (!area || !Array.isArray(countries)) return null;
  if (area.association) {
    const wanted = area.association.toLowerCase();
    return countries.find((entry) => entry.associations.some((a) => a.name.toLowerCase() === wanted)) || null;
  }
  const key = countryKey(area.name);
  return countries.find((entry) => countryKey(entry.country) === key) || null;
}
