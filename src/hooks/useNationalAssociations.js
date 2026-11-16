import { useEffect, useState } from 'react';
import copy from '../data/geographicArea/nationalAssociations.json';
import { NATIONAL_ASSOCIATIONS_URL, readAssociationsList } from '../utils/nationalAssociations';

// The published list is read once per visit, the first time the map is shown.
let published = null;

const readPublished = () => {
  published ??= fetch(NATIONAL_ASSOCIATIONS_URL)
    .then((response) => (response.ok ? response.json() : null))
    .then(readAssociationsList)
    .catch(() => null);
  return published;
};

// The countries with their National Associations and Codes: this app's copy at first, then the
// list as ethicalmedtech.eu publishes it now. Offline, or if that list cannot be read, the copy stays.
export function useNationalAssociations() {
  const [countries, setCountries] = useState(copy.countries);

  useEffect(() => {
    let current = true;
    readPublished().then((list) => {
      if (current && list) setCountries(list);
    });
    return () => {
      current = false;
    };
  }, []);

  return countries;
}
