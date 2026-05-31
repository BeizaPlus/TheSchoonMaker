import { buildCaseChatContext } from './caseChat.js';
import { getBuiltInPatientSrc } from './patientImage.js';
import { STORAGE } from './storageKeys.js';

const API = 'http://127.0.0.1:3001';

async function fetchBuiltInImagePayload(caseData) {
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
    source: `builtin:${src}`,
  };
}

export function readCaseRegenImage(caseId) {
  try {
    const raw = localStorage.getItem(STORAGE.caseRegenImages);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.[String(caseId)] || null;
  } catch {
    return null;
  }
}

export function writeCaseRegenImage(caseId, dataUrl) {
  try {
    const raw = localStorage.getItem(STORAGE.caseRegenImages);
    const parsed = raw ? JSON.parse(raw) : {};
    parsed[String(caseId)] = dataUrl;
    localStorage.setItem(STORAGE.caseRegenImages, JSON.stringify(parsed));
  } catch {
    /* ignore */
  }
}

export function clearCaseRegenImage(caseId) {
  try {
    const raw = localStorage.getItem(STORAGE.caseRegenImages);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    delete parsed[String(caseId)];
    localStorage.setItem(STORAGE.caseRegenImages, JSON.stringify(parsed));
  } catch {
    /* ignore */
  }
}

export function clearCaseSceneVariantsForSig(sceneSourceSig) {
  if (!sceneSourceSig) return;
  try {
    const raw = localStorage.getItem(STORAGE.sceneVariants);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    delete parsed[sceneSourceSig];
    localStorage.setItem(STORAGE.sceneVariants, JSON.stringify(parsed));
  } catch {
    /* ignore */
  }
}

export function buildSceneSourceSig(caseData, erSrc) {
  return `${caseData.id}:${caseData.patientSex || 'unknown'}:${erSrc.slice(0, 96)}:${erSrc.length}`;
}

/** Base template image + case JSON → analyzed & reconstructed patient (once cached per case/context). */
export async function regeneratePatientFromCase(caseData) {
  const payload = await fetchBuiltInImagePayload(caseData);
  const caseContext = buildCaseChatContext(caseData);

  const r = await fetch(`${API}/api/regenerate-patient-from-case`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      imageBase64: payload.base64,
      mimeType: payload.mimeType,
      caseContext,
    }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    throw new Error(data.error || 'Could not regenerate patient from presentation');
  }

  const resolvedUrl = data.dataUrl || data.url;
  if (!resolvedUrl) throw new Error('No regenerated patient image returned');

  writeCaseRegenImage(caseData.id, resolvedUrl);
  return {
    dataUrl: resolvedUrl,
    cached: Boolean(data.cached),
    analysis: data.analysis || null,
  };
}
