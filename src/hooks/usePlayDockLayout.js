import { useCallback, useEffect, useState } from 'react';
import {
  clampDockLayout,
  defaultPlayDockLayout,
  readPlayDockLayout,
  writePlayDockLayout,
} from '../lib/playDockLayout.js';

export function usePlayDockLayout() {
  const [layout, setLayout] = useState(() => readPlayDockLayout());
  const [activeDrag, setActiveDrag] = useState(null);

  const persist = useCallback((next) => {
    const clamped = clampDockLayout(next);
    setLayout(clamped);
    writePlayDockLayout(clamped);
    return clamped;
  }, []);

  useEffect(() => {
    const onResize = () => {
      setLayout((prev) => clampDockLayout(prev));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (!activeDrag) return undefined;

    const onMove = (event) => {
      const { mode, startX, startY, startLayout } = activeDrag;
      const dx = event.clientX - startX;
      const dy = event.clientY - startY;

      if (mode === 'move') {
        persist({
          ...startLayout,
          x: startLayout.x + dx,
          y: startLayout.y + dy,
        });
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
      setActiveDrag({
        mode,
        startX: event.clientX,
        startY: event.clientY,
        startLayout: { ...layout },
      });
    },
    [layout],
  );

  const resetLayout = useCallback(() => {
    persist(defaultPlayDockLayout());
  }, [persist]);

  return { layout, persist, startDrag, resetLayout, isDragging: Boolean(activeDrag) };
}
