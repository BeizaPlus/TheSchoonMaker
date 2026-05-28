import { GRID_COLS, GRID_ROWS } from '../lib/sceneGrid.js';

/**
 * Invisible grid for click-to-place. Covers image frame (or full scene).
 * Add class "visible" on parent to show grid lines while authoring.
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
  const occupied = new Set(occupiedCells.map((c) => `${c.col},${c.row}`));
  const cells = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const left = frame.x + (col / cols) * frame.w;
      const top = frame.y + (row / rows) * frame.h;
      const width = frame.w / cols;
      const height = frame.h / rows;
      const isOccupied = occupied.has(`${col},${row}`);
      const cx = left + width / 2;
      const cy = top + height / 2;
      cells.push(
        <button
          key={`${col}-${row}`}
          type="button"
          className={`scene-grid-cell ${isOccupied ? 'occupied' : ''}`}
          tabIndex={placeMode ? 0 : -1}
          aria-label={`Grid ${col + 1}, ${row + 1}`}
          data-col={col}
          data-row={row}
          data-cx={cx}
          data-cy={cy}
          style={{
            left: `${left * 100}%`,
            top: `${top * 100}%`,
            width: `${width * 100}%`,
            height: `${height * 100}%`,
          }}
          onClick={(e) => {
            if (!placeMode || !onPlace) return;
            e.stopPropagation();
            onPlace({ col, row, cx, cy });
          }}
        />
      );
    }
  }

  return (
    <div
      className={`scene-grid-overlay ${visible ? 'visible' : ''} ${placeMode ? 'placing' : ''} ${dropTarget ? 'drop-target' : ''}`}
      aria-hidden={!placeMode && !dropTarget}
    >
      {cells}
    </div>
  );
}
