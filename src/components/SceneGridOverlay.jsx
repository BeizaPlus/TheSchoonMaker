import { useCallback, useMemo } from 'react';
import { GRID_COLS, GRID_ROWS } from '../lib/sceneGrid.js';

function cellFromLocalPoint(localX, localY, cols, rows, frame) {
  const col = Math.max(0, Math.min(cols - 1, Math.floor(localX * cols)));
  const row = Math.max(0, Math.min(rows - 1, Math.floor(localY * rows)));
  const cx = frame.x + ((col + 0.5) / cols) * frame.w;
  const cy = frame.y + ((row + 0.5) / rows) * frame.h;
  return { col, row, cx, cy };
}

/**
 * Lightweight grid overlay — one surface div instead of thousands of cell buttons.
 * Cells are computed from click/drop coordinates.
 */
export default function SceneGridOverlay({
  frame = { x: 0, y: 0, w: 1, h: 1 },
  cols = GRID_COLS,
  rows = GRID_ROWS,
  visible = false,
  placeMode = false,
  dropTarget = false,
  occupiedCells = [],
  onPlace,
}) {
  const occupied = useMemo(
    () => new Set(occupiedCells.map((c) => `${c.col},${c.row}`)),
    [occupiedCells],
  );

  const frameStyle = useMemo(
    () => ({
      left: `${frame.x * 100}%`,
      top: `${frame.y * 100}%`,
      width: `${frame.w * 100}%`,
      height: `${frame.h * 100}%`,
      '--grid-cols': cols,
      '--grid-rows': rows,
    }),
    [frame.x, frame.y, frame.w, frame.h, cols, rows],
  );

  const handlePlaceClick = useCallback(
    (event) => {
      if (!placeMode || !onPlace) return;
      const rect = event.currentTarget.getBoundingClientRect();
      const localX = (event.clientX - rect.left) / rect.width;
      const localY = (event.clientY - rect.top) / rect.height;
      const cell = cellFromLocalPoint(localX, localY, cols, rows, frame);
      if (occupied.has(`${cell.col},${cell.row}`)) return;
      onPlace(cell);
    },
    [placeMode, onPlace, cols, rows, frame, occupied],
  );

  if (!visible && !placeMode && !dropTarget) {
    return null;
  }

  const className = [
    'scene-grid-overlay',
    visible ? 'visible' : '',
    placeMode ? 'placing' : '',
    dropTarget ? 'drop-target' : '',
    'scene-grid-overlay--surface',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={className}
      style={frameStyle}
      data-cols={cols}
      data-rows={rows}
      data-frame-x={frame.x}
      data-frame-y={frame.y}
      data-frame-w={frame.w}
      data-frame-h={frame.h}
      aria-hidden={!placeMode && !dropTarget}
      onClick={placeMode ? handlePlaceClick : undefined}
    />
  );
}

/** Resolve grid cell from pointer coords on a scene-grid-drop-surface element. */
export function cellFromDropSurface(surface, clientX, clientY) {
  if (!surface) return null;
  const cols = Number(surface.dataset.cols) || GRID_COLS;
  const rows = Number(surface.dataset.rows) || GRID_ROWS;
  const frame = {
    x: Number(surface.dataset.frameX) || 0,
    y: Number(surface.dataset.frameY) || 0,
    w: Number(surface.dataset.frameW) || 1,
    h: Number(surface.dataset.frameH) || 1,
  };
  const rect = surface.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  const localX = (clientX - rect.left) / rect.width;
  const localY = (clientY - rect.top) / rect.height;
  if (localX < 0 || localX > 1 || localY < 0 || localY > 1) return null;
  return cellFromLocalPoint(localX, localY, cols, rows, frame);
}
