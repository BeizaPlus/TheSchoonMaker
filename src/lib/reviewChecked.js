export function reviewCheckedStorageKey(caseId) {
  return `review_checked_case_${caseId}`;
}

export function readReviewChecked(caseId) {
  if (caseId == null || caseId === '') return [];
  try {
    const raw = localStorage.getItem(reviewCheckedStorageKey(caseId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((n) => Number.isFinite(n)).map((n) => Math.round(n));
  } catch {
    return [];
  }
}

export function writeReviewChecked(caseId, seqList) {
  if (caseId == null || caseId === '') return;
  try {
    localStorage.setItem(reviewCheckedStorageKey(caseId), JSON.stringify(seqList));
  } catch {
    /* ignore */
  }
}

export function clearReviewChecked(caseId) {
  if (caseId == null || caseId === '') return;
  try {
    localStorage.removeItem(reviewCheckedStorageKey(caseId));
  } catch {
    /* ignore */
  }
}

export function toggleReviewCheckedSeq(caseId, seq, current) {
  const set = new Set(current);
  if (set.has(seq)) set.delete(seq);
  else set.add(seq);
  const next = [...set].sort((a, b) => a - b);
  writeReviewChecked(caseId, next);
  return next;
}
