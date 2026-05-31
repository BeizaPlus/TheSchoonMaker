export const DEFAULT_TIMER_SECONDS = 150;

export function normalizeTimerSeconds(value, fallback = DEFAULT_TIMER_SECONDS) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(3600, Math.max(60, Math.round(n)));
}

export function difficultyTimerMultiplier(difficulty) {
  if (difficulty === 'easy') return 1.35;
  if (difficulty === 'hard') return 0.75;
  return 1;
}

export function getSessionTimerSeconds(profile, difficulty, layoutDefault = DEFAULT_TIMER_SECONDS) {
  const base = normalizeTimerSeconds(profile?.timerSeconds, layoutDefault);
  return Math.round(base * difficultyTimerMultiplier(difficulty));
}

export function formatTimerLabel(totalSeconds) {
  const safe = Math.max(0, Math.round(totalSeconds));
  const mm = Math.floor(safe / 60);
  const ss = String(safe % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

export function timerMinutesFromSeconds(seconds) {
  return Math.max(1, Math.round((normalizeTimerSeconds(seconds) / 60) * 10) / 10);
}
