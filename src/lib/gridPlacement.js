import { GRID_COLS, GRID_ROWS, snapPoint } from './sceneGrid.js';

export function cellKey(col, row) {
  return `${col},${row}`;
}

export function itemAtCell(items, col, row) {
  return items.find((it) => it.col === col && it.row === row);
}

export function createGridItem({ col, row, cx, cy, label, meta = {}, unit }) {
  const snapped = snapPoint(cx, cy);
  return {
    id: `g-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    col: snapped.col,
    row: snapped.row,
    cx: snapped.cx,
    cy: snapped.cy,
    label,
    meta,
    ...(unit != null ? { unit } : {}),
  };
}

export function moveGridItem(items, id, cell) {
  const snapped = snapPoint(cell.cx, cell.cy);
  const existing = itemAtCell(items, snapped.col, snapped.row);
  if (existing && existing.id !== id) return items;
  return items.map((it) =>
    it.id === id
      ? { ...it, col: snapped.col, row: snapped.row, cx: snapped.cx, cy: snapped.cy }
      : it,
  );
}

export function readGridItems(storageKey) {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeGridItems(storageKey, items) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(items));
  } catch {
    /* ignore */
  }
}

export { GRID_COLS, GRID_ROWS };
