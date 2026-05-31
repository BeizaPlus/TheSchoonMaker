import { STORAGE } from './storageKeys.js';

export function defaultUiPrefs() {
  return {
    timedMode: 'timed',
  };
}

export function readUiPrefs() {
  try {
    const raw = localStorage.getItem(STORAGE.uiPrefs);
    if (!raw) return defaultUiPrefs();
    const parsed = JSON.parse(raw);
    return {
      ...defaultUiPrefs(),
      ...parsed,
      timedMode: parsed?.timedMode === 'untimed' ? 'untimed' : 'timed',
    };
  } catch {
    return defaultUiPrefs();
  }
}

export function writeUiPrefs(prefs) {
  try {
    localStorage.setItem(STORAGE.uiPrefs, JSON.stringify({ ...readUiPrefs(), ...prefs }));
  } catch {
    /* ignore */
  }
}

export function isTimedMode(prefs = readUiPrefs()) {
  return prefs.timedMode !== 'untimed';
}

export function getCaseInterventions(caseData) {
  return Array.isArray(caseData?.interventions) ? caseData.interventions : [];
}

export function getCaseOrderTotal(caseData) {
  return getCaseInterventions(caseData).length;
}
