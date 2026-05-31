import { useEffect, useRef } from 'react';
import interact from 'interactjs';

/**
 * interact.js drag/drop for pill → zone (config-driven, no hardcoded zones).
 */
export function useDragGame({
  sceneRef,
  enabled,
  placed,
  overlap = 0.35,
  snapBackMs = 380,
  onDrop,
  onReturnToDock,
}) {
  const onDropRef = useRef(onDrop);
  const onReturnToDockRef = useRef(onReturnToDock);
  onDropRef.current = onDrop;
  onReturnToDockRef.current = onReturnToDock;

  useEffect(() => {
    if (!enabled) return undefined;

    const scene = sceneRef.current;
    if (!scene) return undefined;

    // Some interact builds don't expose dynamicDrop; guard to prevent Play crash.
    if (typeof interact.dynamicDrop === 'function') {
      interact.dynamicDrop(true);
    }

    interact('.drag-pill-wrap').draggable({
      inertia:
        typeof document !== 'undefined' && document.documentElement.dataset.perf === 'low'
          ? false
          : { resistance: 10, minSpeed: 100, endSpeed: 50 },
      autoScroll: true,
      listeners: {
        start(event) {
          const pill = event.target.querySelector('.drag-pill');
          if (!pill) return;
          pill.classList.add('dragging');
          scene.querySelectorAll('.drop-zone:not(.zone-done)').forEach((z) => {
            z.classList.add('zone-lit');
          });
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
          scene.querySelectorAll('.drop-zone').forEach((z) => {
            z.classList.remove('zone-lit', 'zone-hover');
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

    const overlapMode =
      overlap === 'pointer' ? 'pointer' : typeof overlap === 'number' ? overlap : 0.35;

    interact('.drop-zone').dropzone({
      accept: '.drag-pill-wrap',
      overlap: overlapMode,
      listeners: {
        dragenter(event) {
          if (!event.relatedTarget?.querySelector?.('.drag-pill')) return;
          event.target.classList.add('zone-hover');
        },
        dragleave(event) {
          event.target.classList.remove('zone-hover');
        },
        drop(event) {
          const zone = event.target;
          const wrap = event.relatedTarget;
          const pill = wrap?.querySelector('.drag-pill');
          if (!pill) return;

          zone.classList.remove('zone-hover', 'zone-lit');
          wrap.setAttribute('data-dropped', 'true');

          const zoneId = zone.dataset.zoneId;
          const ivId = pill.dataset.ivId;
          const zr = zone.getBoundingClientRect();
          const wr = wrap.getBoundingClientRect();
          const dx = parseFloat(wrap.getAttribute('data-x')) || 0;
          const dy = parseFloat(wrap.getAttribute('data-y')) || 0;
          const tx =
            zr.left + zr.width / 2 - wr.left - wr.width / 2 + dx;
          const ty =
            zr.top + zr.height / 2 - wr.top - wr.height / 2 + dy;

          wrap.style.transition = 'transform 0.28s cubic-bezier(0.34, 1.56, 0.64, 1)';
          wrap.style.transform = `translate(${tx}px, ${ty}px)`;
          wrap.setAttribute('data-x', tx);
          wrap.setAttribute('data-y', ty);

          onDropRef.current(ivId, zoneId, { wrap, zone, pill });
        },
      },
    });

    interact('.dock-return-zone').dropzone({
      accept: '.drag-pill-wrap',
      overlap: 'pointer',
      listeners: {
        drop(event) {
          const wrap = event.relatedTarget;
          const pill = wrap?.querySelector('.drag-pill');
          if (!pill) return;
          const ivId = pill.dataset.ivId;
          wrap.setAttribute('data-dropped', 'true');
          onReturnToDockRef.current?.(ivId, { wrap, pill });
        },
      },
    });

    return () => {
      interact('.drag-pill-wrap').unset();
      interact('.drop-zone').unset();
      interact('.dock-return-zone').unset();
    };
  }, [enabled, sceneRef, overlap, snapBackMs, placed]);
}
