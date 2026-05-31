import { STORAGE } from './storageKeys.js';

const DEFAULTS = {
  monitorVolume: 0.38,
  sfxVolume: 0.55,
  monitorMuted: false,
  monitorEnabled: true,
};

export function readAudioPrefs() {
  if (typeof window === 'undefined') return { ...DEFAULTS };
  try {
    const raw = localStorage.getItem(STORAGE.audioPrefs);
    if (!raw) return { ...DEFAULTS };
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function writeAudioPrefs(prefs) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE.audioPrefs, JSON.stringify(prefs));
  } catch {
    /* ignore */
  }
}

export function patchAudioPrefs(patch) {
  const next = { ...readAudioPrefs(), ...patch };
  writeAudioPrefs(next);
  return next;
}
