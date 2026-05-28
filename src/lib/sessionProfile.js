import { STORAGE } from './storageKeys.js';

export const PLAY_ROLES = ['doctor', 'patient'];
export const DIFFICULTIES = ['easy', 'standard', 'hard'];

export function readSessionProfile() {
  try {
    const raw = localStorage.getItem(STORAGE.audienceProfile);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const playRole = PLAY_ROLES.includes(parsed.playRole) ? parsed.playRole : 'doctor';
    const difficulty = DIFFICULTIES.includes(parsed.difficulty) ? parsed.difficulty : 'standard';
    return { ...parsed, playRole, difficulty };
  } catch {
    return null;
  }
}

export function getTimerMultiplier(difficulty = 'standard') {
  if (difficulty === 'easy') return 1.35;
  if (difficulty === 'hard') return 0.75;
  return 1;
}

export function getCompletionThresholdAdjust(difficulty = 'standard', base = 99) {
  if (difficulty === 'easy') return Math.max(85, base - 10);
  if (difficulty === 'hard') return Math.min(100, base + 1);
  return base;
}
