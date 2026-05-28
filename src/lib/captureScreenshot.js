import { toPng } from 'html-to-image';

import { STORAGE } from './storageKeys.js';

const ATTEMPT_KEY = STORAGE.captureAttempt;

export function nextAttemptNumber(caseNumber) {
  const key = `${ATTEMPT_KEY}_${caseNumber}`;
  try {
    const prev = Number(localStorage.getItem(key) || '0');
    const next = prev + 1;
    localStorage.setItem(key, String(next));
    return next;
  } catch {
    return 1;
  }
}

export function peekAttemptNumber(caseNumber) {
  try {
    return Number(localStorage.getItem(`${ATTEMPT_KEY}_${caseNumber}`) || '0') + 1;
  } catch {
    return 1;
  }
}

export async function captureElementPng(el, options = {}) {
  if (!el) throw new Error('Nothing to capture');
  return toPng(el, {
    cacheBust: true,
    pixelRatio: Math.min(2, window.devicePixelRatio || 1),
    filter: (node) => {
      if (node?.classList?.contains('scene-grid-overlay')) return false;
      if (node?.classList?.contains('studio-toolbar')) return false;
      return true;
    },
    ...options,
  });
}

export async function saveScreenshotToServer({
  element,
  caseNumber,
  attempt,
  meta = {},
}) {
  const dataUrl = await captureElementPng(element);
  const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
  const resp = await fetch('/api/capture-screenshot', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      imageBase64: base64,
      caseNumber: String(caseNumber),
      attempt: Number(attempt),
      meta,
    }),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error || `Save failed (${resp.status})`);
  }
  return resp.json();
}
