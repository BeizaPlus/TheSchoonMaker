import { useEffect, useRef } from 'react';
import interact from 'interactjs';
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
 * interact.js drag/drop — pickup from dock stacks, drop on patient zones only.
 */
export function useDragGame({
  sceneRef,
  enabled,
  placed,
  overlap = 0.35,
  snapBackMs = 380,
  onDrop,
  onReturnToDock,
  canStartDrag,
}) {
  const canStartDragRef = useRef(canStartDrag);
  canStartDragRef.current = canStartDrag;
  const onDropRef = useRef(onDrop);
  const onReturnToDockRef = useRef(onReturnToDock);
  onDropRef.current = onDrop;
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
      overlap === 'pointer' ? 'pointer' : typeof overlap === 'number' ? overlap : 0.35;

    const finishDrag = (wrap, { dropped = false, clientX, clientY } = {}) => {
      const session = dragSessionRef.current;
      const pill = wrap?.querySelector('.drag-pill');
      if (pill) pill.classList.remove('dragging');
      scene.querySelectorAll('.drop-zone').forEach((z) => {
        z.classList.remove('zone-lit', 'zone-hover');
      });
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

          scene.querySelectorAll('.drop-zone:not(.zone-done)').forEach((z) => {
            z.classList.add('zone-lit');
          });
        },
        move(event) {
          const session = dragSessionRef.current;
          if (!session) return;
          session.lastX = event.clientX;
          session.lastY = event.clientY;
          moveDragGhost(session.ghost, event.clientX, event.clientY);
          setPatientDropHighlight(scene, isPointerOverPatient(scene, event.clientX, event.clientY));
        },
        end(event) {
          const session = dragSessionRef.current;
          const wrap = event.target;
          if (!session || session.wrap !== wrap) {
            finishDrag(wrap, { dropped: false });
            return;
          }

          if (wrap.getAttribute('data-dropped') !== 'true') {
            finishDrag(wrap, {
              dropped: false,
              clientX: session.lastX,
              clientY: session.lastY,
            });
          } else {
            finishDrag(wrap, { dropped: true, clientX: session.lastX, clientY: session.lastY });
          }

          wrap.classList.remove('stack-drag-source');
        },
      },
    });

    interact('.drop-zone').dropzone({
      accept: '.drag-pill-wrap',
      overlap: overlapMode,
      listeners: {
        dragenter(event) {
          const session = dragSessionRef.current;
          if (!session) return;
          if (!isPointerOverPatient(scene, session.lastX, session.lastY)) return;
          if (!event.relatedTarget?.querySelector?.('.drag-pill')) return;
          event.target.classList.add('zone-hover');
          setPatientDropHighlight(scene, true);
        },
        dragleave(event) {
          event.target.classList.remove('zone-hover');
          const session = dragSessionRef.current;
          if (!session) return;
          setPatientDropHighlight(
            scene,
            isPointerOverPatient(scene, session.lastX, session.lastY),
          );
        },
        drop(event) {
          const session = dragSessionRef.current;
          const zone = event.target;
          const wrap = event.relatedTarget;
          const pill = wrap?.querySelector('.drag-pill');
          if (!pill || !session) return;

          const dragEvent = event.dragEvent || event;
          const clientX = dragEvent.clientX ?? session.lastX;
          const clientY = dragEvent.clientY ?? session.lastY;

          if (!isPointerOverPatient(scene, clientX, clientY)) {
            zone.classList.remove('zone-hover', 'zone-lit');
            wrap.setAttribute('data-dropped', 'false');
            return;
          }

          zone.classList.remove('zone-hover', 'zone-lit');
          wrap.setAttribute('data-dropped', 'true');

          const zoneId = zone.dataset.zoneId;
          const ivId = pill.dataset.ivId;

          dismissWrapFromDock(wrap);

          showPlacementFeedback(scene, session.label, clientX, clientY);
          onDropRef.current(ivId, zoneId, { wrap, zone, pill, clientX, clientY });
        },
      },
    });

    return () => {
      interact('.drag-pill-wrap').unset();
      interact('.drop-zone').unset();
      setPatientDropHighlight(scene, false);
      cleanupDragGhosts();
      dragSessionRef.current = null;
    };
  }, [enabled, sceneRef, overlap, snapBackMs, placed]);
}
