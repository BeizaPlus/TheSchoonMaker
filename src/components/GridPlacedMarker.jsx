import { GRID_COLS, GRID_ROWS } from '../lib/sceneGrid.js';

/** Rectangular grid cell marker (not a circle). */
export default function GridPlacedMarker({
  item,
  frame = { x: 0, y: 0, w: 1, h: 1 },
  cols = GRID_COLS,
  rows = GRID_ROWS,
  selected = false,
  onClick,
  onDoubleClick,
}) {
  const cellW = (frame.w / cols) * 100;
  const cellH = (frame.h / rows) * 100;
  const left = item.cx * 100;
  const top = item.cy * 100;

  return (
    <button
      type="button"
      className={`grid-placed-marker ${selected ? 'selected' : ''}`}
      style={{
        left: `${left}%`,
        top: `${top}%`,
        width: `${cellW}%`,
        height: `${cellH}%`,
      }}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      title={item.label}
    >
      <span className="grid-placed-marker-label">{item.label}</span>
    </button>
  );
}
