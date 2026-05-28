import { clampZone } from './zoneStudio.js';

export const GRID_COLS = 48;
export const GRID_ROWS = 32;

/** Snap normalized center (0–1) to grid cell center. */
export function snapPoint(cx, cy, cols = GRID_COLS, rows = GRID_ROWS) {
  const col = Math.max(0, Math.min(cols - 1, Math.round(cx * cols - 0.5)));
  const row = Math.max(0, Math.min(rows - 1, Math.round(cy * rows - 0.5)));
  return {
    cx: (col + 0.5) / cols,
    cy: (row + 0.5) / rows,
    col,
    row,
  };
}

/** Snap zone center and size to grid increments. */
export function snapZone(z, cols = GRID_COLS, rows = GRID_ROWS) {
  const center = snapPoint(z.cx, z.cy, cols, rows);
  const wCols = Math.max(1, Math.round(z.w * cols));
  const hRows = Math.max(1, Math.round(z.h * rows));
  return clampZone({
    ...z,
    cx: center.cx,
    cy: center.cy,
    w: wCols / cols,
    h: hRows / rows,
  });
}

/** Convert click position inside a rect to normalized coords (0–1). */
export function normFromEvent(event, rect) {
  const x = (event.clientX - rect.left) / rect.width;
  const y = (event.clientY - rect.top) / rect.height;
  return {
    cx: Math.max(0, Math.min(1, x)),
    cy: Math.max(0, Math.min(1, y)),
  };
}

/** Map normalized point into image frame sub-rect. */
export function toImageNorm(cx, cy, frame) {
  const f = frame || { x: 0, y: 0, w: 1, h: 1 };
  return {
    cx: f.x + cx * f.w,
    cy: f.y + cy * f.h,
  };
}

export function fromImageNorm(cx, cy, frame) {
  const f = frame || { x: 0, y: 0, w: 1, h: 1 };
  return {
    cx: (cx - f.x) / f.w,
    cy: (cy - f.y) / f.h,
  };
}
