/** CCS exam prep — high-acuity case pool scoring. */

const HIGH_ACUITY_RE =
  /\b(chest pain|shock|trauma|altered|unconscious|seizure|stroke|infarct|pulmonary embol|sepsis|arrest|hemorrh|ectopic|torsion|anaphyl|sob|shortness of breath|hypotension|overdose|meningitis|sa?h)\b/i;

const CATEGORY_BOOST = /cardiopulmonary|trauma|critical|emergency/i;

export function scoreCaseAcuity(entry = {}) {
  let score = 0;
  const blob = `${entry.title || ''} ${entry.chief_complaint || ''} ${entry.category || ''}`;
  if (HIGH_ACUITY_RE.test(blob)) score += 3;
  if (CATEGORY_BOOST.test(entry.category || '')) score += 2;
  const vitals = entry.vitals || entry.flowVitals || {};
  if (Number(vitals.sbp) > 0 && Number(vitals.sbp) < 95) score += 2;
  if (Number(vitals.spo2) > 0 && Number(vitals.spo2) < 92) score += 2;
  if (Number(vitals.hr) > 120) score += 1;
  if (Number(vitals.lactate) >= 2) score += 2;
  return score;
}

export function getHighAcuityCaseIds(cases = [], minScore = 4) {
  const ids = cases.filter((c) => scoreCaseAcuity(c) >= minScore).map((c) => c.id);
  if (ids.length >= 12) return ids;
  // Fallback: ensure a usable exam pool
  return cases
    .filter((c) => HIGH_ACUITY_RE.test(`${c.title} ${c.category}`))
    .map((c) => c.id);
}

export function applyExamPrepDefaults() {
  return {
    studyMode: 'exam_high_acuity',
    level: 'advanced',
    condition: 'exam',
    playRole: 'doctor',
    difficulty: 'hard',
  };
}
