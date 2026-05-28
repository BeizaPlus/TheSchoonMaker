import { STORAGE } from '../lib/storageKeys.js';
import { getBranding } from './gameData.js';

const STORAGE_KEY = STORAGE.progress;

function defaultProgress() {
  return {
    cases: {},
    queue: [],
    queueIndex: 0,
    lastMode: 'browse',
  };
}

export function readProgress() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return { ...defaultProgress(), ...raw, cases: raw?.cases || {} };
  } catch {
    return defaultProgress();
  }
}

export function writeProgress(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* storage full */
  }
}

export function getCaseRecord(caseId) {
  return readProgress().cases[caseId] || null;
}

export function recordCaseComplete(caseId, { accuracy, attempts, seconds }) {
  const p = readProgress();
  const prev = p.cases[caseId] || {
    plays: 0,
    bestAccuracy: 0,
    completed: false,
    lastPlayed: null,
  };
  const next = {
    plays: prev.plays + 1,
    bestAccuracy: Math.max(prev.bestAccuracy, accuracy),
    completed: prev.completed || accuracy >= (getBranding()?.completionThreshold ?? 99),
    lastPlayed: new Date().toISOString(),
    lastAttempts: attempts,
    lastSeconds: seconds,
  };
  p.cases[caseId] = next;
  writeProgress(p);
  return next;
}

export function getCompletionStats(totalCases) {
  const p = readProgress();
  const completed = Object.values(p.cases).filter((c) => c.completed).length;
  const played = Object.keys(p.cases).length;
  return {
    completed,
    played,
    total: totalCases,
    pct: totalCases ? Math.round((completed / totalCases) * 100) : 0,
  };
}

export function shuffleIds(ids) {
  const arr = [...ids];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function pickRandomId(ids) {
  if (!ids.length) return null;
  return ids[Math.floor(Math.random() * ids.length)];
}

/** Start or restart full-library shuffle queue. Returns first case id. */
export function startShuffleQueue(allIds) {
  const p = readProgress();
  p.queue = shuffleIds(allIds);
  p.queueIndex = 0;
  p.lastMode = 'shuffle';
  writeProgress(p);
  return p.queue[0] || null;
}

/** Next id in shuffle queue (wraps). */
export function nextInQueue() {
  const p = readProgress();
  if (!p.queue.length) return null;
  p.queueIndex = (p.queueIndex + 1) % p.queue.length;
  writeProgress(p);
  return p.queue[p.queueIndex];
}

export function currentQueueId() {
  const p = readProgress();
  if (!p.queue.length) return null;
  return p.queue[p.queueIndex];
}

export function setLastMode(mode) {
  const p = readProgress();
  p.lastMode = mode;
  writeProgress(p);
}

export function clearProgress() {
  writeProgress(defaultProgress());
}

/** Most recently played case id, if any. */
export function getLastPlayedCaseId() {
  const p = readProgress();
  let bestId = null;
  let bestTime = 0;
  for (const [id, rec] of Object.entries(p.cases)) {
    if (!rec?.lastPlayed) continue;
    const t = new Date(rec.lastPlayed).getTime();
    if (t > bestTime) {
      bestTime = t;
      bestId = id;
    }
  }
  return bestId;
}
