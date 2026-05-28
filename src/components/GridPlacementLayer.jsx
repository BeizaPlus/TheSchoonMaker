import SceneGridOverlay from './SceneGridOverlay.jsx';
import GridPlacedMarker from './GridPlacedMarker.jsx';
import { GRID_COLS, GRID_ROWS } from '../lib/sceneGrid.js';
import { itemAtCell } from '../lib/gridPlacement.js';

/**
 * Invisible grid + rectangular placed items.
 * Click cell (place mode): add item. Click item: select. Click cell with selection: move. Double-click item: remove.
 */
export default function GridPlacementLayer({
  items = [],
  frame = { x: 0, y: 0, w: 1, h: 1 },
  cols = GRID_COLS,
  rows = GRID_ROWS,
  visible = false,
  placeMode = false,
  selectedId = null,
  onPlaceCell,
  onSelect,
  onMove,
  onRemove,
  onItemClick,
}) {
  const handleCell = (cell) => {
    if (selectedId && onMove) {
      const occupied = itemAtCell(items, cell.col, cell.row);
      if (!occupied || occupied.id === selectedId) {
        onMove(selectedId, cell);
      }
      return;
    }
    if (!placeMode || !onPlaceCell) return;
    if (itemAtCell(items, cell.col, cell.row)) return;
    onPlaceCell(cell);
  };

  return (
    <>
      <SceneGridOverlay
        frame={frame}
        cols={cols}
        rows={rows}
        visible={visible}
        placeMode={placeMode || Boolean(selectedId)}
        occupiedCells={items.map((it) => ({ col: it.col, row: it.row }))}
        onPlace={handleCell}
      />
      {items.map((item) => (
        <GridPlacedMarker
          key={item.id}
          item={item}
          frame={frame}
          cols={cols}
          rows={rows}
          selected={item.id === selectedId}
          onClick={(e) => {
            e.stopPropagation();
            if (onItemClick) {
              onItemClick(item);
              return;
            }
            onSelect?.(item.id === selectedId ? null : item.id);
          }}
          onDoubleClick={(e) => {
            e.stopPropagation();
            onRemove?.(item.id);
            if (selectedId === item.id) onSelect?.(null);
          }}
        />
      ))}
    </>
  );
}
