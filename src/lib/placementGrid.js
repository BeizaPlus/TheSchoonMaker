import { snapPoint } from './sceneGrid.js';

/** Snap a zone center to its grid cell (for scoring). */
export function zoneToGridCell(zoneId, zones) {
  const z = zones?.[zoneId];
  if (!z) return null;
  return snapPoint(z.cx, z.cy);
}

export function isCorrectGridPlacement(iv, placement, zones) {
  const want = zoneToGridCell(iv.correct_zone, zones);
  if (!want || !placement) return false;
  return placement.col === want.col && placement.row === want.row;
}

/** Best-matching zone id for a grid cell (legend / hints). */
export function zoneIdForCell(cell, zones) {
  if (!cell) return null;
  for (const [zoneId, z] of Object.entries(zones || {})) {
    const zc = zoneToGridCell(zoneId, zones);
    if (zc && zc.col === cell.col && zc.row === cell.row) return zoneId;
  }
  return null;
}

export function normalizePlacement(placement) {
  if (!placement) return null;
  if (typeof placement === 'string') return { zoneId: placement };
  if (typeof placement.col === 'number') return placement;
  return null;
}
