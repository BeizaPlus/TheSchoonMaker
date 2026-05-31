/** Derive patient life % from vitals, case progress, and mistakes. */
export function computePatientLife({
  vitals = {},
  doneCount = 0,
  total = 0,
  misses = 0,
  timeLeft = null,
  timerTotal = null,
} = {}) {
  let score = 88;

  const spo2 = vitals.spo2 ?? 98;
  const sbp = vitals.sbp ?? 120;
  const hr = vitals.hr ?? 88;
  const lactate = vitals.lactate ?? 1.4;
  const temp = vitals.temp ?? 37;

  if (spo2 < 92) score -= 28;
  else if (spo2 < 95) score -= 12;
  if (sbp < 95) score -= 22;
  else if (sbp < 100) score -= 10;
  if (hr > 120) score -= 14;
  else if (hr > 110) score -= 7;
  if (lactate >= 4) score -= 16;
  else if (lactate >= 2) score -= 8;
  if (temp >= 39) score -= 8;
  else if (temp >= 38.5) score -= 4;

  if (total > 0) {
    score += (doneCount / total) * 20;
  }

  score -= Math.max(0, misses) * 7;

  if (
    typeof timeLeft === 'number' &&
    typeof timerTotal === 'number' &&
    timerTotal > 0 &&
    timeLeft <= Math.max(30, timerTotal * 0.12)
  ) {
    score -= 10;
  }

  return Math.max(8, Math.min(100, Math.round(score)));
}

export function patientLifeState(lifePct) {
  if (lifePct > 70) return 'stable';
  if (lifePct > 40) return 'guarded';
  return 'critical';
}
