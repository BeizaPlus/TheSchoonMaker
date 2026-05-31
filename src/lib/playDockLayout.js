import { STORAGE } from './storageKeys.js';

const MIN_W = 260;
const MIN_H = 280;
const MIN_CLINICAL = 100;
const MIN_STACKS = 120;

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

export function defaultPlayDockLayout() {
  if (typeof window === 'undefined') {
    return { x: 12, y: 52, width: 360, height: 520, clinicalPx: 200 };
  }
  const compact = window.innerWidth <= 900;
  const width = compact
    ? Math.min(window.innerWidth - 16, 640)
    : clamp(Math.round(window.innerWidth * 0.34), 300, 440);
  const height = compact
    ? clamp(Math.round(window.innerHeight * 0.52), 320, 560)
    : clamp(Math.round(window.innerHeight * 0.78), 360, 860);
  const x = compact ? 8 : Math.max(12, window.innerWidth - width - 18);
  const y = compact ? Math.max(44, window.innerHeight - height - 52) : 52;
  const clinicalPx = clamp(Math.round(height * 0.38), MIN_CLINICAL, height - MIN_STACKS - 80);
  return { x, y, width, height, clinicalPx };
}

export function readPlayDockLayout() {
  try {
    const raw = localStorage.getItem(STORAGE.playDockLayout);
    if (!raw) return defaultPlayDockLayout();
    const parsed = JSON.parse(raw);
    const base = defaultPlayDockLayout();
    return {
      x: Number(parsed.x) || base.x,
      y: Number(parsed.y) || base.y,
      width: clamp(Number(parsed.width) || base.width, MIN_W, window.innerWidth - 8),
      height: clamp(Number(parsed.height) || base.height, MIN_H, window.innerHeight - 44),
      clinicalPx: Number(parsed.clinicalPx) || base.clinicalPx,
    };
  } catch {
    return defaultPlayDockLayout();
  }
}

export function writePlayDockLayout(layout) {
  try {
    localStorage.setItem(STORAGE.playDockLayout, JSON.stringify(layout));
  } catch {
    /* ignore */
  }
}

export function clampDockLayout(layout) {
  const maxW = Math.max(MIN_W, window.innerWidth - 8);
  const maxH = Math.max(MIN_H, window.innerHeight - 44);
  const width = clamp(layout.width, MIN_W, maxW);
  const height = clamp(layout.height, MIN_H, maxH);
  const x = clamp(layout.x, 8, Math.max(8, window.innerWidth - width - 8));
  const y = clamp(layout.y, 44, Math.max(44, window.innerHeight - height - 8));
  const clinicalPx = clamp(
    layout.clinicalPx,
    MIN_CLINICAL,
    height - MIN_STACKS - 72,
  );
  return { x, y, width, height, clinicalPx };
}

export { MIN_W, MIN_H, MIN_CLINICAL, MIN_STACKS };
