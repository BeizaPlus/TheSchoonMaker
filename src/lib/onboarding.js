import { STORAGE } from './storageKeys.js';
import { readAudienceProfile, writeAudienceProfile } from './audienceProfile.js';
import { DEFAULT_TIMER_SECONDS, normalizeTimerSeconds } from './caseTimer.js';

export function hasCompletedOnboarding() {
  try {
    if (localStorage.getItem(STORAGE.onboardingComplete) === '1') return true;
    return Boolean(readAudienceProfile());
  } catch {
    return false;
  }
}

export function markOnboardingComplete() {
  try {
    localStorage.setItem(STORAGE.onboardingComplete, '1');
  } catch {
    /* ignore */
  }
}

/** One-click defaults for physicians — full catalog, clinical mode, no layperson filters. */
export function applyPhysicianProfile(timerMinutes = 2.5) {
  const profile = {
    level: 'advanced',
    condition: 'diabetes',
    playRole: 'doctor',
    difficulty: 'standard',
    timerSeconds: normalizeTimerSeconds(Math.round(timerMinutes * 60), DEFAULT_TIMER_SECONDS),
  };
  writeAudienceProfile(profile);
  markOnboardingComplete();
  return profile;
}
