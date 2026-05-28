import { getZones } from '../data/gameData.js';
import { readVisionZones } from './patientImage.js';

import { STORAGE } from './storageKeys.js';

export const STUDIO_ZONES_KEY = STORAGE.studioZones;

function round4(n) {
  return Math.round(Number(n) * 10000) / 10000;
}

export function clampZone(z) {
  return {
    ...z,
    cx: Math.max(0.02, Math.min(0.98, z.cx)),
    cy: Math.max(0.02, Math.min(0.98, z.cy)),
    w: Math.max(0.05, Math.min(0.4, z.w)),
    h: Math.max(0.04, Math.min(0.35, z.h)),
  };
}

export function getBaseZones() {
  const config = getZones();
  // Config is authoritative for studio + play mapping.
  // Vision output is still available for optional tooling, but should not
  // silently override manually curated zone JSON.
  return { ...config };
}

export function readStudioZones() {
  try {
    const raw = localStorage.getItem(STUDIO_ZONES_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeStudioZones(zones) {
  localStorage.setItem(STUDIO_ZONES_KEY, JSON.stringify(zones));
}

export function clearStudioZones() {
  localStorage.removeItem(STUDIO_ZONES_KEY);
}

export function formatZonesJson(zones) {
  const out = {};
  for (const [id, z] of Object.entries(zones)) {
    const item = {
      cx: round4(z.cx),
      cy: round4(z.cy),
      w: round4(z.w),
      h: round4(z.h),
      label: z.label,
    };
    if (typeof z.rating === 'number') item.rating = z.rating;
    out[id] = item;
  }
  return JSON.stringify(out, null, 2);
}

/** Paste into gameConfig.json under "zones". */
export function formatGameConfigSnippet(zones) {
  return `"zones": ${formatZonesJson(zones)}`;
}

export function syncZoneFromElement(el, sceneEl) {
  const sr = sceneEl.getBoundingClientRect();
  const zr = el.getBoundingClientRect();
  const cx = (zr.left + zr.width / 2 - sr.left) / sr.width;
  const cy = (zr.top + zr.height / 2 - sr.top) / sr.height;
  const w = zr.width / sr.width;
  const h = zr.height / sr.height;
  return clampZone({
    cx,
    cy,
    w,
    h,
    label: el.dataset.zoneLabel || '',
  });
}

export function mergeZonesForPlay(caseZones) {
  const base = getBaseZones();
  const merged = { ...caseZones };
  for (const [k, z] of Object.entries(base)) {
    if (merged[k]) merged[k] = { ...merged[k], ...z };
  }
  const studio = readStudioZones();
  if (studio) {
    for (const [k, z] of Object.entries(studio)) {
      if (merged[k]) merged[k] = { ...merged[k], ...z };
    }
  }
  return merged;
}
