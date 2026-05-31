import { STORAGE } from './storageKeys.js';

const CHECKPOINT_VERSION = 1;
const MAX_AGE_MS = 1000 * 60 * 60 * 24 * 14;

function emptyCheckpoint() {
  return null;
}

export function readPlayCheckpoint() {
  try {
    const raw = localStorage.getItem(STORAGE.activePlayCheckpoint);
    if (!raw) return emptyCheckpoint();
    const parsed = JSON.parse(raw);
    if (!parsed?.caseId || parsed.version !== CHECKPOINT_VERSION) return emptyCheckpoint();
    if (parsed.savedAt) {
      const age = Date.now() - new Date(parsed.savedAt).getTime();
      if (age > MAX_AGE_MS) {
        clearPlayCheckpoint();
        return emptyCheckpoint();
      }
    }
    return parsed;
  } catch {
    return emptyCheckpoint();
  }
}

export function writePlayCheckpoint(payload) {
  if (!payload?.caseId) return null;
  try {
    const next = {
      version: CHECKPOINT_VERSION,
      savedAt: new Date().toISOString(),
      ...payload,
    };
    localStorage.setItem(STORAGE.activePlayCheckpoint, JSON.stringify(next));
    return next;
  } catch {
    return null;
  }
}

export function clearPlayCheckpoint() {
  try {
    localStorage.removeItem(STORAGE.activePlayCheckpoint);
  } catch {
    /* ignore */
  }
}

export function hasPlayCheckpoint() {
  return Boolean(readPlayCheckpoint()?.caseId);
}

export function hydrateCheckpointTimer(checkpoint, timerTotal) {
  if (!checkpoint?.checkpoint) return null;
  const c = checkpoint.checkpoint;
  let timeLeft = typeof c.timeLeft === 'number' ? c.timeLeft : timerTotal;
  if (!c.timerPaused && checkpoint.savedAt) {
    const elapsedSec = Math.floor((Date.now() - new Date(checkpoint.savedAt).getTime()) / 1000);
    if (elapsedSec > 0) timeLeft = Math.max(0, timeLeft - elapsedSec);
  }
  return { ...c, timeLeft };
}

export function formatPlayCheckpointSummary(checkpoint, caseMeta = {}) {
  if (!checkpoint) return null;
  const c = checkpoint.checkpoint || {};
  const placed = c.placedCount ?? Object.keys(c.placed || {}).length;
  const total = c.total ?? '?';
  const title = caseMeta.title || checkpoint.caseTitle || `Case ${checkpoint.caseNumber || checkpoint.caseId}`;
  const minutes = Math.floor((c.timeLeft || 0) / 60);
  const seconds = (c.timeLeft || 0) % 60;
  const timerText =
    typeof c.timeLeft === 'number'
      ? `${minutes}:${String(seconds).padStart(2, '0')} left`
      : 'timer saved';
  const when = checkpoint.savedAt
    ? new Date(checkpoint.savedAt).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : '';
  return {
    title,
    placed,
    total,
    timerText,
    when,
    line: `${title} · ${placed}/${total} placed · ${timerText}`,
  };
}
