import { STORAGE } from './storageKeys.js';

const THEME_KEY = STORAGE.theme;
const DARK_RESTORE_KEY = 'schoonmaker_theme_dark_restore_v1';

export function readTheme() {
  try {
    if (!localStorage.getItem(DARK_RESTORE_KEY)) {
      localStorage.setItem(DARK_RESTORE_KEY, '1');
      const raw = localStorage.getItem(THEME_KEY);
      if (!raw || raw === 'light') {
        localStorage.setItem(THEME_KEY, 'dark');
        return 'dark';
      }
    }
    const raw = localStorage.getItem(THEME_KEY);
    if (raw === 'light' || raw === 'dark') return raw;
  } catch {
    /* ignore */
  }
  return 'dark';
}

export function writeTheme(theme) {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* ignore */
  }
  applyTheme(theme);
}

export function applyTheme(theme) {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', theme);
}
