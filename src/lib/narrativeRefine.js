import { STORAGE } from './storageKeys.js';

function caseKey(caseId) {
  return String(caseId || '').padStart(3, '0');
}

function slotKey(playRole, difficulty) {
  return `${playRole || 'doctor'}:${difficulty || 'standard'}`;
}

function readAll() {
  try {
    const raw = localStorage.getItem(STORAGE.refinedNarratives);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeAll(data) {
  try {
    localStorage.setItem(STORAGE.refinedNarratives, JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

export function listRefinedEntries(caseId, playRole, difficulty) {
  const row = readAll()[caseKey(caseId)];
  if (!row?.entries?.length) return [];
  const sk = slotKey(playRole, difficulty);
  return row.entries.filter((e) => slotKey(e.playRole, e.difficulty) === sk);
}

export function getActiveRefinedNarrative(caseId, playRole, difficulty) {
  const id = caseKey(caseId);
  const row = readAll()[id];
  if (!row?.entries?.length) return null;
  const sk = slotKey(playRole, difficulty);
  const activeId = row.active?.[sk];
  const entry = row.entries.find((e) => e.id === activeId);
  if (entry) return entry;
  return row.entries.find((e) => slotKey(e.playRole, e.difficulty) === sk) || null;
}

export function setActiveRefinedEntry(caseId, playRole, difficulty, entryId) {
  const all = readAll();
  const id = caseKey(caseId);
  const row = all[id] || { entries: [], active: {} };
  row.active = { ...(row.active || {}), [slotKey(playRole, difficulty)]: entryId };
  all[id] = row;
  writeAll(all);
}

export function saveRefinedEntry(caseId, entry) {
  const all = readAll();
  const id = caseKey(caseId);
  const row = all[id] || { entries: [], active: {} };
  const next = {
    id: entry.id || `ref-${Date.now()}`,
    label: entry.label || `Refined ${row.entries.length + 1}`,
    createdAt: entry.createdAt || new Date().toISOString(),
    playRole: entry.playRole || 'doctor',
    difficulty: entry.difficulty || 'standard',
    intro: entry.intro || '',
    hpi: entry.hpi || '',
    vitalsText: entry.vitalsText || '',
    clinicalTip: entry.clinicalTip || '',
    objective: entry.objective || '',
  };
  row.entries = [...(row.entries || []), next];
  row.active = { ...(row.active || {}), [slotKey(next.playRole, next.difficulty)]: next.id };
  all[id] = row;
  writeAll(all);
  return next;
}

export async function refineNarrativeWithAI({
  rawText,
  playRole = 'doctor',
  title = '',
  category = '',
  clinicalTip = '',
  objective = '',
}) {
  const r = await fetch('http://127.0.0.1:3001/api/refine-narrative', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      rawText,
      playRole,
      title,
      category,
      clinicalTip,
      objective,
    }),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.error || `Refine failed (${r.status})`);
  }
  return r.json();
}
