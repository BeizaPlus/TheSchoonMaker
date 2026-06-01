import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { STORAGE } from '../lib/storageKeys.js';
import {
  clampDockLayout,
  defaultBriefingDockLayout,
  defaultPlayDockLayout,
  getPlayDockBounds,
  readPlayDockLayout,
  writePlayDockLayout,
} from '../lib/playDockLayout.js';

export function usePlayDockLayout(options = {}) {
  const storageKey = options.storageKey || STORAGE.playDockLayout;
  const boundsRef = options.boundsRef;
  const getDefault =
    options.getDefault ||
    (storageKey === STORAGE.briefingDockLayout
      ? () => defaultBriefingDockLayout(boundsRef?.current)
      : () => defaultPlayDockLayout(boundsRef?.current));

  const [layout, setLayout] = useState(() => readPlayDockLayout(storageKey, boundsRef?.current));
  const [activeDrag, setActiveDrag] = useState(null);

  const getBounds = useCallback(
    () => getPlayDockBounds(boundsRef?.current),
    [boundsRef],
  );

  const reclamp = useCallback(
    (prev) => clampDockLayout(prev, getBounds()),
    [getBounds],
  );

  const persist = useCallback(
    (next) => {
      const clamped = clampDockLayout(next, getBounds());
      setLayout(clamped);
      writePlayDockLayout(clamped, storageKey);
      return clamped;
    },
    [storageKey, getBounds],
  );

  useLayoutEffect(() => {
    setLayout((prev) => reclamp(prev));
  }, [reclamp]);

  useEffect(() => {
    const el = boundsRef?.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;

    const observer = new ResizeObserver(() => {
      setLayout((prev) => reclamp(prev));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [boundsRef, reclamp]);

  useEffect(() => {
    const onResize = () => {
      setLayout((prev) => reclamp(prev));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [reclamp]);

  useEffect(() => {
    if (!activeDrag) return undefined;

    const onMove = (event) => {
      const { mode, startX, startY, startLayout, pointerOffsetX, pointerOffsetY } = activeDrag;
      const dx = event.clientX - startX;
      const dy = event.clientY - startY;
      const boundsEl = boundsRef?.current;
      const rect = boundsEl?.getBoundingClientRect?.();

      if (mode === 'move') {
        if (rect) {
          persist({
            ...startLayout,
            x: event.clientX - rect.left - pointerOffsetX,
            y: event.clientY - rect.top - pointerOffsetY,
          });
        } else {
          persist({
            ...startLayout,
            x: startLayout.x + dx,
            y: startLayout.y + dy,
          });
        }
        return;
      }
      if (mode === 'resize-e') {
        persist({ ...startLayout, width: startLayout.width + dx });
        return;
      }
      if (mode === 'resize-s') {
        persist({ ...startLayout, height: startLayout.height + dy });
        return;
      }
      if (mode === 'resize-se') {
        persist({
          ...startLayout,
          width: startLayout.width + dx,
          height: startLayout.height + dy,
        });
        return;
      }
      if (mode === 'split') {
        persist({
          ...startLayout,
          clinicalPx: startLayout.clinicalPx + dy,
        });
      }
    };

    const onUp = () => setActiveDrag(null);

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [activeDrag, persist]);

  const startDrag = useCallback(
    (mode, event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      event.currentTarget.setPointerCapture?.(event.pointerId);
      const boundsEl = boundsRef?.current;
      const rect = boundsEl?.getBoundingClientRect?.();
      setActiveDrag({
        mode,
        startX: event.clientX,
        startY: event.clientY,
        startLayout: { ...layout },
        pointerOffsetX: rect ? event.clientX - rect.left - layout.x : 0,
        pointerOffsetY: rect ? event.clientY - rect.top - layout.y : 0,
      });
    },
    [layout, boundsRef],
  );

  const resetLayout = useCallback(() => {
    persist(getDefault());
  }, [getDefault, persist]);

  const dockToSide = useCallback(
    (side = 'right') => {
      const b = getBounds();
      const x = side === 'left' ? b.minX : Math.max(b.minX, b.maxX - layout.width);
      persist({
        ...layout,
        x,
        y: b.minY,
      });
    },
    [getBounds, layout, persist],
  );

  return { layout, persist, startDrag, resetLayout, dockToSide, isDragging: Boolean(activeDrag) };
}
