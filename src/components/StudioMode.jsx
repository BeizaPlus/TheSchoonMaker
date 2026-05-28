import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import interact from 'interactjs';
import PatientScene from './PatientScene.jsx';
import SceneGridOverlay from './SceneGridOverlay.jsx';
import GridPlacementLayer from './GridPlacementLayer.jsx';
import {
  createGridItem,
  moveGridItem,
} from '../lib/gridPlacement.js';
import { getZoneColors, getPatientScene } from '../data/gameData.js';
import {
  clampZone,
  clearStudioZones,
  formatGameConfigSnippet,
  formatZonesJson,
  getBaseZones,
  syncZoneFromElement,
  writeStudioZones,
} from '../lib/zoneStudio.js';
import { GRID_COLS, GRID_ROWS, snapPoint, snapZone } from '../lib/sceneGrid.js';
import { nextAttemptNumber, peekAttemptNumber, saveScreenshotToServer } from '../lib/captureScreenshot.js';

export default function StudioMode({ onExit }) {
  const sceneRef = useRef(null);
  const captureRef = useRef(null);
  const zoneColors = getZoneColors();
  const [zones, setZones] = useState(() => getBaseZones());
  const [selectedId, setSelectedId] = useState('zone-monitor');
  const [copied, setCopied] = useState('');
  const [applied, setApplied] = useState(false);
  const [renameId, setRenameId] = useState('');
  const [renameLabel, setRenameLabel] = useState('');
  const [rating, setRating] = useState('');
  const [caseNumber, setCaseNumber] = useState('4');
  const [showGrid, setShowGrid] = useState(true);
  const [captureBusy, setCaptureBusy] = useState(false);
  const [gridMarkers, setGridMarkers] = useState([]);
  const [selectedMarkerId, setSelectedMarkerId] = useState(null);
  const [stackPlaceMode, setStackPlaceMode] = useState(true);

  const nextAttempt = useMemo(() => peekAttemptNumber(caseNumber), [caseNumber]);

  const jsonOut = useMemo(() => formatZonesJson(zones), [zones]);
  const snippetOut = useMemo(() => formatGameConfigSnippet(zones), [zones]);
  const zoneEntries = Object.entries(zones);

  useEffect(() => {
    if (!zones[selectedId]) {
      const first = Object.keys(zones)[0];
      if (first) setSelectedId(first);
    }
  }, [zones, selectedId]);

  useEffect(() => {
    const selected = zones[selectedId];
    if (!selected) return;
    setRenameId(selectedId);
    setRenameLabel(selected.label || selectedId);
    setRating(typeof selected.rating === 'number' ? String(selected.rating) : '');
  }, [selectedId, zones]);

  const applyTransform = (el, x, y) => {
    el.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px)`;
    el.setAttribute('data-x', String(x));
    el.setAttribute('data-y', String(y));
  };

  const commitZoneEl = useCallback((el) => {
    const scene = sceneRef.current;
    const zoneId = el?.dataset?.zoneId;
    if (!scene || !zoneId) return;
    const raw = syncZoneFromElement(el, scene);
    const next = snapZone(raw);
    el.style.left = `${next.cx * 100}%`;
    el.style.top = `${next.cy * 100}%`;
    el.style.width = `${next.w * 100}%`;
    el.style.height = `${next.h * 100}%`;
    el.style.transform = 'translate(-50%, -50%)';
    el.setAttribute('data-x', '0');
    el.setAttribute('data-y', '0');
    setZones((prev) => ({
      ...prev,
      [zoneId]: { ...prev[zoneId], ...next, label: prev[zoneId]?.label || next.label },
    }));
  }, []);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return undefined;

    interact('.studio-zone')
      .draggable({
        inertia: true,
        modifiers: [interact.modifiers.restrictRect({ restriction: 'parent', endOnly: true })],
        listeners: {
          move(event) {
            const t = event.target;
            const x = (parseFloat(t.getAttribute('data-x')) || 0) + event.dx;
            const y = (parseFloat(t.getAttribute('data-y')) || 0) + event.dy;
            applyTransform(t, x, y);
          },
          end(event) {
            commitZoneEl(event.target);
          },
        },
      })
      .resizable({
        edges: { left: true, right: true, bottom: true, top: true },
        modifiers: [
          interact.modifiers.restrictSize({ min: { width: 48, height: 36 } }),
          interact.modifiers.restrictEdges({ outer: 'parent' }),
        ],
        listeners: {
          move(event) {
            const t = event.target;
            const x = (parseFloat(t.getAttribute('data-x')) || 0) + event.deltaRect.left;
            const y = (parseFloat(t.getAttribute('data-y')) || 0) + event.deltaRect.top;
            Object.assign(t.style, {
              width: `${event.rect.width}px`,
              height: `${event.rect.height}px`,
            });
            applyTransform(t, x, y);
          },
          end(event) {
            commitZoneEl(event.target);
          },
        },
      });

    return () => {
      interact('.studio-zone').unset();
    };
  }, [commitZoneEl]);

  const nudge = (zoneId, dx, dy, dw = 0, dh = 0) => {
    setZones((prev) => {
      const z = prev[zoneId];
      if (!z) return prev;
      return {
        ...prev,
        [zoneId]: snapZone(
          clampZone({
            ...z,
            cx: z.cx + dx,
            cy: z.cy + dy,
            w: z.w + dw,
            h: z.h + dh,
          }),
        ),
      };
    });
  };

  const gridStepX = 1 / GRID_COLS;
  const gridStepY = 1 / GRID_ROWS;

  const placeZoneOnGrid = useCallback(
    ({ cx, cy }) => {
      const snapped = snapPoint(cx, cy);
      setZones((prev) => {
        const z = prev[selectedId];
        if (!z) return prev;
        return {
          ...prev,
          [selectedId]: snapZone({ ...z, cx: snapped.cx, cy: snapped.cy }),
        };
      });
    },
    [selectedId],
  );

  const placeGridMarker = useCallback((cell) => {
    const item = createGridItem({ ...cell, label: `Stack ${gridMarkers.length + 1}` });
    setGridMarkers((prev) => [...prev, item]);
  }, [gridMarkers.length]);

  const moveGridMarker = useCallback((id, cell) => {
    setGridMarkers((prev) => moveGridItem(prev, id, cell));
    setSelectedMarkerId(null);
  }, []);

  const removeGridMarker = useCallback((id) => {
    setGridMarkers((prev) => prev.filter((it) => it.id !== id));
  }, []);

  const captureScreenshot = async () => {
    const el = captureRef.current;
    if (!el || captureBusy) return;
    setCaptureBusy(true);
    try {
      const attempt = nextAttemptNumber(caseNumber);
      const result = await saveScreenshotToServer({
        element: el,
        caseNumber,
        attempt,
        meta: {
          mode: 'zone-studio',
          careUnit: 'ER',
          zones,
          gridMarkers,
          grid: { cols: GRID_COLS, rows: GRID_ROWS },
        },
      });
      setCopied(`Saved → captures/${result.relative}`);
      setTimeout(() => setCopied(''), 4000);
    } catch (e) {
      setCopied(e.message || 'Screenshot failed — is the API running?');
      setTimeout(() => setCopied(''), 4000);
    } finally {
      setCaptureBusy(false);
    }
  };

  const copyText = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(''), 2000);
    } catch {
      setCopied('Copy failed — select JSON manually');
    }
  };

  const applyLocal = () => {
    writeStudioZones(zones);
    setApplied(true);
    setTimeout(() => setApplied(false), 2000);
  };

  const resetZones = () => {
    clearStudioZones();
    setZones(getBaseZones());
  };

  const normalizeId = (id) =>
    String(id || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-_\s]/g, '')
      .replace(/\s+/g, '-')
      .replace(/^-+|-+$/g, '');

  const addZone = () => {
    setZones((prev) => {
      let n = 1;
      let id = `zone-custom-${n}`;
      while (prev[id]) {
        n += 1;
        id = `zone-custom-${n}`;
      }
      const next = {
        ...prev,
        [id]: clampZone({ cx: 0.5, cy: 0.5, w: 0.14, h: 0.1, label: `Custom ${n}`, rating: 3 }),
      };
      setSelectedId(id);
      return next;
    });
  };

  const duplicateZone = () => {
    const source = zones[selectedId];
    if (!source) return;
    setZones((prev) => {
      let n = 1;
      let id = `${selectedId}-copy-${n}`;
      while (prev[id]) {
        n += 1;
        id = `${selectedId}-copy-${n}`;
      }
      const clone = clampZone({
        ...source,
        cx: source.cx + 0.02,
        cy: source.cy + 0.02,
        label: `${source.label} copy`,
      });
      const next = { ...prev, [id]: clone };
      setSelectedId(id);
      return next;
    });
  };

  const removeZone = () => {
    if (!zones[selectedId]) return;
    setZones((prev) => {
      const next = { ...prev };
      delete next[selectedId];
      return next;
    });
  };

  const renameZone = () => {
    const target = zones[selectedId];
    if (!target) return;
    const nextId = normalizeId(renameId || selectedId);
    if (!nextId) {
      setCopied('Zone ID cannot be empty');
      return;
    }
    setZones((prev) => {
      const out = { ...prev };
      const nextLabel = (renameLabel || nextId).trim();
      if (nextId !== selectedId) {
        if (out[nextId]) {
          setCopied(`Zone ID "${nextId}" already exists`);
          return prev;
        }
        delete out[selectedId];
      }
      out[nextId] = {
        ...target,
        label: nextLabel,
        ...(rating === '' ? {} : { rating: Number(rating) }),
      };
      setSelectedId(nextId);
      setCopied('Zone renamed');
      setTimeout(() => setCopied(''), 2000);
      return out;
    });
  };

  const saveJsonFile = () => {
    const blob = new Blob([jsonOut], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'zone-studio.json';
    a.click();
    URL.revokeObjectURL(url);
    setCopied('Saved zone-studio.json');
    setTimeout(() => setCopied(''), 2000);
  };

  const applyRating = () => {
    const target = zones[selectedId];
    if (!target) return;
    setZones((prev) => ({
      ...prev,
      [selectedId]: {
        ...target,
        ...(rating === '' ? {} : { rating: Number(rating) }),
      },
    }));
    setCopied('Rating saved');
    setTimeout(() => setCopied(''), 1200);
  };

  const selected = zones[selectedId];

  return (
    <div className="studio-mode">
      <header className="studio-top">
        <div>
          <p className="studio-kicker">Zone studio</p>
          <h1>Drag & resize drop zones · copy JSON feedback</h1>
        </div>
        <div className="studio-top-actions">
          <button type="button" className="btn-ghost" onClick={resetZones}>
            Reset to defaults
          </button>
          <button type="button" className="btn-primary" onClick={applyLocal}>
            Apply locally (test in play)
          </button>
          <button type="button" className="btn-ghost" onClick={addZone}>
            + Add zone
          </button>
          <button type="button" className="btn-ghost" onClick={duplicateZone}>
            Duplicate zone
          </button>
          <button
            type="button"
            className="btn-ghost btn-screenshot"
            onClick={captureScreenshot}
            disabled={captureBusy}
          >
            {captureBusy ? 'Saving…' : '📷 Screenshot'}
          </button>
          <button type="button" className="btn-ghost" onClick={onExit}>
            Exit studio
          </button>
        </div>
      </header>

      <div className="studio-layout">
        <div className="studio-scene-wrap">
          <div className="studio-scene-bar">
            <label>
              Case #
              <input
                type="number"
                min={1}
                value={caseNumber}
                onChange={(e) => setCaseNumber(e.target.value)}
              />
            </label>
            <span className="attempt-pill">Next save → attempt {nextAttempt}</span>
            <button
              type="button"
              className={showGrid ? 'btn-primary' : 'btn-ghost'}
              onClick={() => setShowGrid((v) => !v)}
            >
              {showGrid ? 'Grid on' : 'Grid off'}
            </button>
            <button
              type="button"
              className={stackPlaceMode ? 'btn-primary' : 'btn-ghost'}
              onClick={() => setStackPlaceMode((v) => !v)}
            >
              {stackPlaceMode ? 'Place stacks' : 'Move zones'}
            </button>
          </div>
          <div className="studio-scene-capture" ref={captureRef}>
            <div className="studio-scene" ref={sceneRef}>
              <PatientScene scene={getPatientScene()} />
              {!stackPlaceMode && (
                <SceneGridOverlay
                  visible={showGrid}
                  placeMode
                  onPlace={(cell) => {
                    if (selectedId && zones[selectedId]) placeZoneOnGrid(cell);
                  }}
                />
              )}
              {stackPlaceMode && (
                <GridPlacementLayer
                  items={gridMarkers}
                  visible={showGrid}
                  placeMode
                  selectedId={selectedMarkerId}
                  onPlaceCell={placeGridMarker}
                  onSelect={setSelectedMarkerId}
                  onMove={moveGridMarker}
                  onRemove={removeGridMarker}
                />
              )}
            {zoneEntries.map(([zoneId, z]) => {
              const color = zoneColors[zoneId] || '#e8b84b';
              const active = zoneId === selectedId;
              return (
                <div
                  key={zoneId}
                  className={`studio-zone drop-zone zone-lit ${active ? 'studio-zone-active' : ''}`}
                  data-zone-id={zoneId}
                  data-zone-label={z.label}
                  data-x="0"
                  data-y="0"
                  style={{
                    left: `${z.cx * 100}%`,
                    top: `${z.cy * 100}%`,
                    width: `${z.w * 100}%`,
                    height: `${z.h * 100}%`,
                    ['--zone-color']: color,
                  }}
                  onMouseDown={() => setSelectedId(zoneId)}
                >
                  <span className="zone-label">{z.label}</span>
                  <span className="studio-zone-id">{zoneId}</span>
                </div>
              );
            })}
            </div>
          </div>
          <p className="studio-hint">
            Grid {GRID_COLS}×{GRID_ROWS} — Place stacks: click cell · select stack · click cell to move ·
            double-click remove. Move zones: turn off Place stacks, click cell. Zones snap on drag release.
          </p>
        </div>

        <aside className="studio-panel">
          <p className="sect-label">Selected zone</p>
          <p className="studio-selected-name">{selected?.label || selectedId}</p>
          <div className="studio-rename">
            <input
              value={renameId}
              onChange={(e) => setRenameId(e.target.value)}
              placeholder="zone-id"
            />
            <input
              value={renameLabel}
              onChange={(e) => setRenameLabel(e.target.value)}
              placeholder="Zone label"
            />
            <div className="studio-rating-row">
              <label htmlFor="studio-rating">Rating</label>
              <select
                id="studio-rating"
                value={rating}
                onChange={(e) => setRating(e.target.value)}
              >
                <option value="">Unrated</option>
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
                <option value="4">4</option>
                <option value="5">5</option>
              </select>
              <button type="button" className="btn-ghost" onClick={applyRating}>
                Save rating
              </button>
            </div>
            <div className="studio-rename-actions">
              <button type="button" className="btn-ghost" onClick={renameZone}>
                Rename zone
              </button>
              <button type="button" className="btn-ghost" onClick={removeZone}>
                Remove
              </button>
            </div>
          </div>
          <div className="studio-nudge-grid">
            <button type="button" onClick={() => nudge(selectedId, 0, -gridStepY)}>
              ↑
            </button>
            <button type="button" onClick={() => nudge(selectedId, -gridStepX, 0)}>
              ←
            </button>
            <button type="button" onClick={() => nudge(selectedId, gridStepX, 0)}>
              →
            </button>
            <button type="button" onClick={() => nudge(selectedId, 0, gridStepY)}>
              ↓
            </button>
            <button type="button" onClick={() => nudge(selectedId, 0, 0, gridStepX, 0)}>
              W+
            </button>
            <button type="button" onClick={() => nudge(selectedId, 0, 0, -gridStepX, 0)}>
              W−
            </button>
            <button type="button" onClick={() => nudge(selectedId, 0, 0, 0, gridStepY)}>
              H+
            </button>
            <button type="button" onClick={() => nudge(selectedId, 0, 0, 0, -gridStepY)}>
              H−
            </button>
          </div>

          <p className="sect-label">Zone list</p>
          <div className="studio-zone-list">
            {zoneEntries.map(([id, z]) => (
              <button
                key={id}
                type="button"
                className={id === selectedId ? 'studio-zone-chip active' : 'studio-zone-chip'}
                onClick={() => setSelectedId(id)}
              >
                <span className="studio-chip-dot" style={{ background: zoneColors[id] }} />
                {z.label}
                {typeof z.rating === 'number' && <span className="studio-rating-pill">★ {z.rating}</span>}
              </button>
            ))}
          </div>

          <p className="sect-label">JSON for gameConfig.json</p>
          <textarea className="studio-json" readOnly value={jsonOut} rows={14} />
          <div className="studio-copy-row">
            <button type="button" className="btn-primary" onClick={() => copyText(jsonOut, 'Zones JSON copied')}>
              Copy zones JSON
            </button>
            <button type="button" className="btn-ghost" onClick={() => copyText(snippetOut, 'Config snippet copied')}>
              Copy config snippet
            </button>
            <button type="button" className="btn-ghost" onClick={saveJsonFile}>
              Save JSON file
            </button>
          </div>
          {(copied || applied) && <p className="studio-feedback">{applied ? 'Applied — open Play to test' : copied}</p>}

          <p className="studio-note">
            Paste copied JSON into <code>src/data/gameConfig.json</code> under <code>zones</code>, or use
            Apply locally to preview without editing files.
          </p>
        </aside>
      </div>
    </div>
  );
}
