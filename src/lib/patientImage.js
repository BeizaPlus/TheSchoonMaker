import { getPatientScene, getPatientSceneForCase } from '../data/gameData.js';

import { STORAGE } from './storageKeys.js';

export const VISION_ZONES_KEY = STORAGE.visionZones;

export function getBuiltInPatientSrc(caseData = null) {
  const scene = caseData ? getPatientSceneForCase(caseData) : getPatientScene();
  return scene?.src || '/assets/patient/patient-scene.png';
}

/** Built-in hospital photo or user upload (data URL). */
export async function getPatientImagePayload(caseData = null) {
  try {
    const dataUrl = localStorage.getItem(STORAGE.patientImage);
    if (dataUrl?.startsWith('data:')) {
      return {
        base64: dataUrl.split(',')[1] || '',
        mimeType: localStorage.getItem(STORAGE.patientMime) || 'image/png',
        source: 'upload',
      };
    }
  } catch {
    /* ignore */
  }

  const src = getBuiltInPatientSrc(caseData);
  const resp = await fetch(src);
  if (!resp.ok) throw new Error(`Patient image not found: ${src}`);
  const blob = await resp.blob();
  const mimeType = blob.type || 'image/png';
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
  return {
    base64: dataUrl.split(',')[1] || '',
    mimeType,
    source: 'builtin',
  };
}

export function readVisionZones(source) {
  try {
    const raw = localStorage.getItem(VISION_ZONES_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.zones && parsed?.source) {
      if (source && parsed.source !== source) return null;
      return parsed.zones;
    }
    // Legacy: plain zone map
    if (parsed && typeof parsed === 'object' && parsed['zone-monitor']) {
      return parsed;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function writeVisionZones(source, zones) {
  localStorage.setItem(VISION_ZONES_KEY, JSON.stringify({ source, zones }));
}

export function clearVisionZones() {
  localStorage.removeItem(VISION_ZONES_KEY);
}
