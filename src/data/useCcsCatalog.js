import catalog from './ccsCatalog.json';
import { toGameCase } from './gameData.js';
import { applySessionToCase } from '../lib/caseNarrative.js';
import { readAudienceProfile } from '../lib/audienceProfile.js';

function withSession(gameCase) {
  const session = readAudienceProfile();
  if (!session) return gameCase;
  return applySessionToCase(gameCase, session);
}

export function getCatalog() {
  return catalog;
}

export function getCategories() {
  return catalog.categories;
}

export function getCaseById(id) {
  const raw = catalog.cases.find((c) => c.id === id);
  return raw ? withSession(toGameCase(raw, catalog)) : null;
}

export function getCasesInCategory(categoryId) {
  const cat = catalog.categories.find((c) => c.id === categoryId);
  if (!cat) return [];
  return cat.caseIds
    .map((id) => catalog.cases.find((c) => c.id === id))
    .filter(Boolean)
    .map((c) => withSession(toGameCase(c, catalog)));
}

export function getAllGameCases() {
  return catalog.cases.map((c) => withSession(toGameCase(c, catalog)));
}
