import caseSpecific from '../data/caseSpecificPlaybooks.json' with { type: 'json' };
import {
  getCaseOrderCount,
  getCaseSpecificPlaybookIds,
  hasCaseSpecificPlaybook,
} from '../data/resolvePlaybook.js';

export function getReadyPracticeCount() {
  return getCaseSpecificPlaybookIds().length;
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

/** @deprecated use getCaseOrderCount(catalogCase) */
export function getCaseStackCount(caseId, catalogCase = null) {
  if (catalogCase) return getCaseOrderCount(catalogCase);
  return 0;
}

export { getCaseOrderCount };

/** Cases with the longest intervention stacks — for drag/stack testing. */
export function getStackTestingCases(catalogCases = []) {
  return catalogCases
    .filter((c) => getCaseOrderCount(c) >= STACK_TESTING_MIN_ORDERS)
    .sort((a, b) => getCaseOrderCount(b) - getCaseOrderCount(a));
}

export function getStackTestingCount(catalogCases = []) {
  return getStackTestingCases(catalogCases).length;
}

export function getStackTestingOrderRange(catalogCases = []) {
  const counts = getStackTestingCases(catalogCases).map((c) => getCaseOrderCount(c));
  if (!counts.length) return `${STACK_TESTING_MIN_ORDERS}+`;
  return `${Math.min(...counts)}–${Math.max(...counts)}`;
}

export function getMaxCaseOrderCount(catalogCases = []) {
  if (!catalogCases.length) return 0;
  return Math.max(...catalogCases.map((c) => getCaseOrderCount(c)));
}
