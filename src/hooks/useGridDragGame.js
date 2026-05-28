import { useEffect, useRef } from 'react';
import interact from 'interactjs';

/**
 * Drag pills onto invisible grid cells; optional reposition of placed pins.
 */
export function useGridDragGame({
  sceneRef,
  enabled,
  snapBackMs = 380,
  overlap = 0.15,
  onDrop,
  onMovePin,
  onReturnToDock,
}) {
  const onDropRef = useRef(onDrop);
  const onMovePinRef = useRef(onMovePin);
  const onReturnToDockRef = useRef(onReturnToDock);
  onDropRef.current = onDrop;
  onMovePinRef.current = onMovePin;
  onReturnToDockRef.current = onReturnToDock;

  useEffect(() => {
    if (!enabled) return undefined;

    const scene = sceneRef.current;
    if (!scene) return undefined;

    if (typeof interact.dynamicDrop === 'function') {
      interact.dynamicDrop(true);
    }

    const overlapMode =
      overlap === 'pointer' ? 'pointer' : typeof overlap === 'number' ? overlap : 0.15;

    interact('.drag-pill-wrap').draggable({
      inertia: { resistance: 10, minSpeed: 100, endSpeed: 50 },
      autoScroll: true,
      listeners: {
        start(event) {
          const pill = event.target.querySelector('.drag-pill');
          if (!pill) return;
          pill.classList.add('dragging');
          scene.classList.add('grid-drag-active');
        },
        move(event) {
          const wrap = event.target;
          const x = (parseFloat(wrap.getAttribute('data-x')) || 0) + event.dx;
          const y = (parseFloat(wrap.getAttribute('data-y')) || 0) + event.dy;
          wrap.style.transform = `translate(${x}px, ${y}px)`;
          wrap.setAttribute('data-x', x);
          wrap.setAttribute('data-y', y);
        },
        end(event) {
          const wrap = event.target;
          const pill = wrap.querySelector('.drag-pill');
          if (pill) pill.classList.remove('dragging');
          scene.classList.remove('grid-drag-active');
          scene.querySelectorAll('.scene-grid-cell').forEach((c) => {
            c.classList.remove('zone-hover');
          });
          if (!event.relatedTarget && wrap.getAttribute('data-dropped') !== 'true') {
            wrap.style.transition = `transform ${snapBackMs}ms cubic-bezier(0.34, 1.56, 0.64, 1)`;
            wrap.style.transform = 'translate(0, 0)';
            wrap.setAttribute('data-x', '0');
            wrap.setAttribute('data-y', '0');
            setTimeout(() => {
              wrap.style.transition = '';
            }, snapBackMs + 20);
          }
          wrap.setAttribute('data-dropped', 'false');
        },
      },
    });

    interact('.scene-grid-cell').dropzone({
      accept: '.drag-pill-wrap, .pin-grid',
      overlap: overlapMode,
      listeners: {
        dragenter(event) {
          event.target.classList.add('zone-hover');
        },
        dragleave(event) {
          event.target.classList.remove('zone-hover');
        },
        drop(event) {
          const cell = event.target;
          const wrap = event.relatedTarget;
          const pill = wrap?.querySelector?.('.drag-pill');
          const pinIv = wrap?.dataset?.ivId;

          const col = Number(cell.dataset.col);
          const row = Number(cell.dataset.row);
          const cx = Number(cell.dataset.cx);
          const cy = Number(cell.dataset.cy);
          if (Number.isNaN(col) || Number.isNaN(row)) return;

          const placement = { col, row, cx, cy };

          if (pinIv && wrap.classList.contains('pin-grid')) {
            wrap.setAttribute('data-dropped', 'true');
            onMovePinRef.current(pinIv, placement, { wrap });
            return;
          }

          if (!pill) return;

          const zr = cell.getBoundingClientRect();
          const wr = wrap.getBoundingClientRect();
          const dx = parseFloat(wrap.getAttribute('data-x')) || 0;
          const dy = parseFloat(wrap.getAttribute('data-y')) || 0;
          const tx = zr.left + zr.width / 2 - wr.left - wr.width / 2 + dx;
          const ty = zr.top + zr.height / 2 - wr.top - wr.height / 2 + dy;

          wrap.setAttribute('data-dropped', 'true');
          wrap.style.transition = 'transform 0.28s cubic-bezier(0.34, 1.56, 0.64, 1)';
          wrap.style.transform = `translate(${tx}px, ${ty}px)`;
          wrap.setAttribute('data-x', tx);
          wrap.setAttribute('data-y', ty);

          const ivId = pill.dataset.ivId;
          onDropRef.current(ivId, placement, { wrap, pill, cell });
        },
      },
    });

    interact('.dock-return-zone').dropzone({
      accept: '.drag-pill-wrap, .pin-grid',
      overlap: 'pointer',
      listeners: {
        drop(event) {
          const wrap = event.relatedTarget;
          const pill = wrap?.querySelector?.('.drag-pill');
          const ivId = pill?.dataset?.ivId || wrap?.dataset?.ivId;
          if (!ivId) return;
          wrap.setAttribute('data-dropped', 'true');
          onReturnToDockRef.current?.(ivId, { wrap, pill });
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
        },
        end(event) {
          const el = event.target;
          el.classList.remove('pin-dragging');
          scene.classList.remove('grid-drag-active');
          if (event.relatedTarget) {
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
      interact('.scene-grid-cell').unset();
      interact('.pin-grid').unset();
      interact('.dock-return-zone').unset();
      scene.classList.remove('grid-drag-active');
    };
  }, [enabled, sceneRef, overlap, snapBackMs]);
}
