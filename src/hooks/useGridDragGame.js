import { useEffect, useRef } from 'react';
import interact from 'interactjs';
import { cellFromDropSurface } from '../components/SceneGridOverlay.jsx';
import {
  cleanupDragGhosts,
  createDragGhost,
  dismissWrapFromDock,
  getStackLabel,
  isPointerOverPatient,
  moveDragGhost,
  setPatientDropHighlight,
  showPlacementFeedback,
  snapWrapHome,
} from '../lib/stackDragHelpers.js';

/**
 * Drag pills onto patient grid surface only — not the stacks panel.
 */
export function useGridDragGame({
  sceneRef,
  enabled,
  snapBackMs = 380,
  overlap = 0.15,
  onDrop,
  onMovePin,
  onReturnToDock,
  canStartDrag,
}) {
  const canStartDragRef = useRef(canStartDrag);
  canStartDragRef.current = canStartDrag;
  const onDropRef = useRef(onDrop);
  const onMovePinRef = useRef(onMovePin);
  const onReturnToDockRef = useRef(onReturnToDock);
  onDropRef.current = onDrop;
  onMovePinRef.current = onMovePin;
  onReturnToDockRef.current = onReturnToDock;
  const dragSessionRef = useRef(null);

  useEffect(() => {
    if (!enabled) return undefined;

    const scene = sceneRef.current;
    if (!scene) return undefined;

    cleanupDragGhosts();

    if (typeof interact.dynamicDrop === 'function') {
      interact.dynamicDrop(true);
    }

    const overlapMode =
      overlap === 'pointer' ? 'pointer' : typeof overlap === 'number' ? overlap : 0.15;

    const clearHover = () => {
      scene.querySelectorAll('.scene-grid-hover-cell').forEach((el) => el.remove());
    };

    const showHoverAt = (clientX, clientY) => {
      if (!isPointerOverPatient(scene, clientX, clientY)) {
        clearHover();
        return;
      }
      const surface = scene.querySelector('.scene-grid-overlay.drop-target');
      if (!surface) return;
      const cell = cellFromDropSurface(surface, clientX, clientY);
      if (!cell) {
        clearHover();
        return;
      }
      let hover = surface.querySelector('.scene-grid-hover-cell');
      if (!hover) {
        hover = document.createElement('div');
        hover.className = 'scene-grid-hover-cell zone-hover';
        surface.appendChild(hover);
      }
      const cols = Number(surface.dataset.cols) || 48;
      const rows = Number(surface.dataset.rows) || 32;
      hover.style.left = `${(cell.col / cols) * 100}%`;
      hover.style.top = `${(cell.row / rows) * 100}%`;
      hover.style.width = `${100 / cols}%`;
      hover.style.height = `${100 / rows}%`;
    };

    const finishDrag = (wrap, { dropped = false } = {}) => {
      const session = dragSessionRef.current;
      const pill = wrap?.querySelector('.drag-pill');
      if (pill) pill.classList.remove('dragging');
      scene.classList.remove('grid-drag-active');
      clearHover();
      setPatientDropHighlight(scene, false);
      cleanupDragGhosts();
      dragSessionRef.current = null;

      if (!dropped) {
        snapWrapHome(wrap, snapBackMs);
      }

      wrap?.setAttribute('data-dropped', dropped ? 'true' : 'false');
    };

    interact('.drag-pill-wrap').draggable({
      inertia: false,
      autoScroll: true,
      listeners: {
        start(event) {
          const wrap = event.target;
          const pill = wrap.querySelector('.drag-pill');
          if (!pill) return;
          const ivId = pill.dataset.ivId;
          if (canStartDragRef.current && !canStartDragRef.current(ivId)) {
            event.interaction.stop();
            return;
          }

          cleanupDragGhosts();
          pill.classList.add('dragging');
          wrap.classList.add('stack-drag-source');

          const label = getStackLabel(wrap);
          const ghost = createDragGhost(label);
          moveDragGhost(ghost, event.clientX, event.clientY);

          dragSessionRef.current = {
            wrap,
            pill,
            ghost,
            label,
            lastX: event.clientX,
            lastY: event.clientY,
          };

          scene.classList.add('grid-drag-active');
        },
        move(event) {
          const session = dragSessionRef.current;
          if (!session) return;
          session.lastX = event.clientX;
          session.lastY = event.clientY;
          moveDragGhost(session.ghost, event.clientX, event.clientY);
          const overPatient = isPointerOverPatient(scene, event.clientX, event.clientY);
          setPatientDropHighlight(scene, overPatient);
          if (overPatient) {
            showHoverAt(event.clientX, event.clientY);
          } else {
            clearHover();
          }
        },
        end(event) {
          const session = dragSessionRef.current;
          const wrap = event.target;
          if (!session || session.wrap !== wrap) {
            finishDrag(wrap, { dropped: false });
            return;
          }

          if (wrap.getAttribute('data-dropped') !== 'true') {
            finishDrag(wrap, { dropped: false });
          } else {
            finishDrag(wrap, { dropped: true });
          }

          wrap.classList.remove('stack-drag-source');
        },
      },
    });

    interact('.scene-grid-overlay.drop-target').dropzone({
      accept: '.drag-pill-wrap, .pin-grid',
      overlap: overlapMode,
      listeners: {
        drop(event) {
          const session = dragSessionRef.current;
          const surface = event.target;
          const wrap = event.relatedTarget;
          const pill = wrap?.querySelector?.('.drag-pill');
          const pinIv = wrap?.dataset?.ivId;
          const dragEvent = event.dragEvent || event;
          const clientX = dragEvent.clientX ?? session?.lastX;
          const clientY = dragEvent.clientY ?? session?.lastY;

          if (!isPointerOverPatient(scene, clientX, clientY)) {
            if (wrap) wrap.setAttribute('data-dropped', 'false');
            return;
          }

          const cell = cellFromDropSurface(surface, clientX, clientY);
          if (!cell) {
            if (wrap) wrap.setAttribute('data-dropped', 'false');
            return;
          }

          const placement = { col: cell.col, row: cell.row, cx: cell.cx, cy: cell.cy };

          if (pinIv && wrap.classList.contains('pin-grid')) {
            wrap.setAttribute('data-dropped', 'true');
            onMovePinRef.current(pinIv, placement, { wrap });
            return;
          }

          if (!pill || !session) return;

          const sr = surface.getBoundingClientRect();
          const cellLeft = sr.left + (cell.col / (Number(surface.dataset.cols) || 48)) * sr.width;
          const cellTop = sr.top + (cell.row / (Number(surface.dataset.rows) || 32)) * sr.height;
          const cellW = sr.width / (Number(surface.dataset.cols) || 48);
          const cellH = sr.height / (Number(surface.dataset.rows) || 32);
          const zr = {
            left: cellLeft,
            top: cellTop,
            width: cellW,
            height: cellH,
          };
          const wr = wrap.getBoundingClientRect();
          const tx = zr.left + zr.width / 2 - wr.left - wr.width / 2;
          const ty = zr.top + zr.height / 2 - wr.top - wr.height / 2;

          wrap.setAttribute('data-dropped', 'true');
          dismissWrapFromDock(wrap);
          wrap.style.transition = 'transform 0.28s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.28s ease';
          wrap.style.transform = `translate(${tx}px, ${ty}px)`;
          wrap.setAttribute('data-x', tx);
          wrap.setAttribute('data-y', ty);

          const ivId = pill.dataset.ivId;
          showPlacementFeedback(scene, session.label, clientX, clientY);
          onDropRef.current(ivId, placement, { wrap, pill, cell: surface, clientX, clientY });
        },
      },
    });

    interact('.pin-grid').draggable({
      inertia: false,
      listeners: {
        start(event) {
          event.target.classList.add('pin-dragging');
          scene.classList.add('grid-drag-active');
        },
        move(event) {
          const el = event.target;
          const x = (parseFloat(el.getAttribute('data-x')) || 0) + event.dx;
          const y = (parseFloat(el.getAttribute('data-y')) || 0) + event.dy;
          el.style.transform = `translate(calc(-50% + ${x}px), calc(-100% + ${y}px))`;
          el.setAttribute('data-x', x);
          el.setAttribute('data-y', y);
          const overPatient = isPointerOverPatient(scene, event.clientX, event.clientY);
          setPatientDropHighlight(scene, overPatient);
          if (overPatient) showHoverAt(event.clientX, event.clientY);
          else clearHover();
        },
        end(event) {
          const el = event.target;
          el.classList.remove('pin-dragging');
          scene.classList.remove('grid-drag-active');
          clearHover();
          setPatientDropHighlight(scene, false);
          if (event.relatedTarget && isPointerOverPatient(scene, event.clientX, event.clientY)) {
            el.style.transform = 'translate(-50%, -100%)';
          } else {
            el.style.transition = `transform ${snapBackMs}ms ease`;
            el.style.transform = 'translate(-50%, -100%)';
            setTimeout(() => {
              el.style.transition = '';
            }, snapBackMs + 20);
          }
          el.setAttribute('data-x', '0');
          el.setAttribute('data-y', '0');
          el.setAttribute('data-dropped', 'false');
        },
      },
    });

    return () => {
      interact('.drag-pill-wrap').unset();
      interact('.scene-grid-overlay.drop-target').unset();
      interact('.pin-grid').unset();
      scene.classList.remove('grid-drag-active');
      clearHover();
      setPatientDropHighlight(scene, false);
      cleanupDragGhosts();
      dragSessionRef.current = null;
    };
  }, [enabled, sceneRef, overlap, snapBackMs]);
}
