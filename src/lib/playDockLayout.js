import { STORAGE } from './storageKeys.js';

const MIN_W = 260;
const MIN_H = 280;
const MIN_CLINICAL = 100;
const MIN_STACKS = 120;
const DOCK_PAD = 8;
const DOCK_TOP = 44;
const DOCK_BOTTOM = 52;

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

/** Play viewport for the floating command dock (`.game` root). */
export function getPlayDockBounds(containerEl) {
  if (typeof window === 'undefined') {
    return { minX: DOCK_PAD, minY: DOCK_TOP, maxX: 800, maxY: 600, width: 800, height: 600 };
  }
  const rect = containerEl?.getBoundingClientRect?.();
  const width = rect?.width > 0 ? rect.width : window.innerWidth;
  const height = rect?.height > 0 ? rect.height : window.innerHeight;
  return {
    minX: DOCK_PAD,
    minY: DOCK_TOP,
    maxX: width - DOCK_PAD,
    maxY: height - DOCK_BOTTOM,
    width,
    height,
  };
}

export function defaultPlayDockLayout(boundsEl) {
  if (typeof window === 'undefined') {
    return { x: 12, y: 52, width: 360, height: 520, clinicalPx: 200 };
  }
  const b = getPlayDockBounds(boundsEl);
  const compact = b.width <= 900;
  const availW = b.maxX - b.minX;
  const availH = b.maxY - b.minY;
  const width = compact
    ? Math.min(availW, 640)
    : clamp(Math.round(b.width * 0.34), 300, Math.min(440, availW));
  const height = compact
    ? clamp(Math.round(availH * 0.52), 320, availH)
    : clamp(Math.round(availH * 0.78), 360, Math.min(860, availH));
  const x = compact ? b.minX : Math.max(b.minX, b.maxX - width);
  const y = compact ? Math.max(b.minY, b.maxY - height) : b.minY;
  const clinicalPx = clamp(Math.round(height * 0.38), MIN_CLINICAL, height - MIN_STACKS - 80);
  return clampDockLayout({ x, y, width, height, clinicalPx }, b);
}

export function defaultBriefingDockLayout(boundsEl) {
  const base = defaultPlayDockLayout(boundsEl);
  if (typeof window === 'undefined') return base;
  const b = getPlayDockBounds(boundsEl);
  return clampDockLayout(
    {
      ...base,
      x: Math.max(b.minX, b.maxX - base.width),
      y: b.minY,
      height: clamp(Math.round((b.maxY - b.minY) * 0.72), 360, Math.min(780, b.maxY - b.minY)),
    },
    b,
  );
}

export function readPlayDockLayout(storageKey = STORAGE.playDockLayout, boundsEl) {
  const fallback =
    storageKey === STORAGE.briefingDockLayout
      ? defaultBriefingDockLayout(boundsEl)
      : defaultPlayDockLayout(boundsEl);
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return clampDockLayout(
      {
        x: Number(parsed.x) || fallback.x,
        y: Number(parsed.y) || fallback.y,
        width: Number(parsed.width) || fallback.width,
        height: Number(parsed.height) || fallback.height,
        clinicalPx: Number(parsed.clinicalPx) || fallback.clinicalPx,
      },
      getPlayDockBounds(boundsEl),
    );
  } catch {
    return fallback;
  }
}

export function writePlayDockLayout(layout, storageKey = STORAGE.playDockLayout) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(layout));
  } catch {
    /* ignore */
  }
}

export function clampDockLayout(layout, bounds) {
  const b = bounds || getPlayDockBounds();
  const availW = Math.max(MIN_W, b.maxX - b.minX);
  const availH = Math.max(MIN_H, b.maxY - b.minY);
  const width = clamp(layout.width, MIN_W, availW);
  const height = clamp(layout.height, MIN_H, availH);
  const x = clamp(layout.x, b.minX, Math.max(b.minX, b.maxX - width));
  const y = clamp(layout.y, b.minY, Math.max(b.minY, b.maxY - height));
  const clinicalPx = clamp(layout.clinicalPx, MIN_CLINICAL, height - MIN_STACKS - 72);
  return { x, y, width, height, clinicalPx };
}

export { MIN_W, MIN_H, MIN_CLINICAL, MIN_STACKS, DOCK_PAD, DOCK_TOP, DOCK_BOTTOM };
