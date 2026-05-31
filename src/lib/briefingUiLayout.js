import { STORAGE } from './storageKeys.js';

/** Briefing chrome elements — position in studio, hide flags apply in player too. */
export const BRIEFING_UI_ELEMENTS = [
  { id: 'back', label: 'Back arrow' },
  { id: 'scene-dock', label: 'Life bar + monitor' },
  { id: 'case-hero', label: 'Case title block' },
  { id: 'case-picker', label: 'Cases dropdown' },
  { id: 'sidebar', label: 'Command sidebar' },
];

export function defaultBriefingUiLayout() {
  return {
    back: { x: null, y: null, hidden: false },
    'scene-dock': { x: null, y: null, hidden: false },
    'case-hero': { x: null, y: null, hidden: false },
    'case-picker': { x: null, y: null, hidden: false },
    sidebar: { x: null, y: null, hidden: false },
  };
}

export function readBriefingUiLayout() {
  try {
    const raw = localStorage.getItem(STORAGE.briefingUiLayout);
    if (!raw) return defaultBriefingUiLayout();
    const parsed = JSON.parse(raw);
    return { ...defaultBriefingUiLayout(), ...parsed };
  } catch {
    return defaultBriefingUiLayout();
  }
}

export function writeBriefingUiLayout(layout) {
  try {
    localStorage.setItem(STORAGE.briefingUiLayout, JSON.stringify(layout));
  } catch {
    /* ignore */
  }
}

export function briefingUiPositionStyle(entry) {
  if (!entry || (entry.x == null && entry.y == null)) return undefined;
  const style = { position: 'fixed' };
  if (entry.x != null) style.left = `${entry.x}px`;
  if (entry.y != null) style.top = `${entry.y}px`;
  if (entry.x != null || entry.y != null) {
    style.right = 'auto';
    style.bottom = 'auto';
  }
  return style;
}
