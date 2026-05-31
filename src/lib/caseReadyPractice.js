import caseSpecific from '../data/caseSpecificPlaybooks.json' with { type: 'json' };
import { hasCaseSpecificPlaybook } from '../data/resolvePlaybook.js';

export function getReadyPracticeCount() {
  return Object.keys(caseSpecific.cases || {}).length;
}

export function getReadyPracticeDiagnosis(caseId) {
  const row = caseSpecific.cases?.[String(caseId)];
  return row?.diagnosis || null;
}

/** Sorted catalog rows that have CCS-specific stacks from the study guides. */
export function getReadyPracticeCases(catalogCases = []) {
  return catalogCases
    .filter((c) => hasCaseSpecificPlaybook(c.id))
    .sort((a, b) => Number(a.caseNumber || a.id) - Number(b.caseNumber || b.id));
}

export function getReadyPracticeIds(catalogCases = []) {
  return getReadyPracticeCases(catalogCases).map((c) => c.id);
}

/** Minimum intervention count for “stack testing” (largest authored stacks). */
export const STACK_TESTING_MIN_ORDERS = 7;

export function getCaseStackCount(caseId) {
  const row = caseSpecific.cases?.[String(caseId)];
  return row?.interventions?.length || 0;
}

/** Cases with the longest intervention stacks — for drag/stack testing. */
export function getStackTestingCases(catalogCases = []) {
  return catalogCases
    .filter((c) => getCaseStackCount(c.id) >= STACK_TESTING_MIN_ORDERS)
    .sort((a, b) => getCaseStackCount(b.id) - getCaseStackCount(a.id));
}

export function getStackTestingCount(catalogCases = []) {
  return getStackTestingCases(catalogCases).length;
}
