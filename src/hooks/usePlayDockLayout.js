import { useCallback, useEffect, useRef, useState } from 'react';
import {
  clampDockLayout,
  defaultPlayDockLayout,
  readPlayDockLayout,
  writePlayDockLayout,
} from '../lib/playDockLayout.js';

export function usePlayDockLayout() {
  const [layout, setLayout] = useState(() => readPlayDockLayout());
  const dragRef = useRef({ mode: null, startX: 0, startY: 0, startLayout: null });

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
    if (!dragRef.current.mode) return undefined;

    const onMove = (event) => {
      const { mode, startX, startY, startLayout } = dragRef.current;
      if (!mode || !startLayout) return;
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

    const onUp = () => {
      dragRef.current.mode = null;
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [persist]);

  const startDrag = useCallback(
    (mode, event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.currentTarget.setPointerCapture?.(event.pointerId);
      dragRef.current = {
        mode,
        startX: event.clientX,
        startY: event.clientY,
        startLayout: { ...layout },
      };
    },
    [layout],
  );

  const resetLayout = useCallback(() => {
    persist(defaultPlayDockLayout());
  }, [persist]);

  return { layout, persist, startDrag, resetLayout };
}
