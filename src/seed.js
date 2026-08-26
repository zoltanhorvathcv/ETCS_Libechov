import { makeEmptyData, makeInstitution } from './model.js';

// Počáteční sada institucí dle zadání (CER, PRIME, SERAF, RFC, EUG, EULYNX,
// UIC, RISC, RNE) – bez skupin/vazeb, ty si doplní uživatelé appky sami.
const STARTER_INSTITUTIONS = [
  ['CER', 'Community of European Railway and Infrastructure Companies'],
  ['PRIME', 'Platform of Rail Infrastructure Managers in Europe'],
  ['SERAF', 'Single European Railway Area Forum'],
  ['RFC', 'Rail Freight Corridors'],
  ['EUG', 'European Users Group'],
  ['EULYNX', 'EULYNX'],
  ['UIC', 'International Union of Railways'],
  ['RISC', 'Rail Interoperability and Safety Committee'],
  ['RNE', 'RailNetEurope'],
  ['ERA', 'European Union Agency for Railways'],
  ['GRB', 'Group of Representative Bodies'],
  ['EC', 'European Commission'],
];

export function makeSeedData() {
  const data = makeEmptyData();
  data.institutions = STARTER_INSTITUTIONS.map(([code, name]) => makeInstitution(code, name));
  return data;
}
