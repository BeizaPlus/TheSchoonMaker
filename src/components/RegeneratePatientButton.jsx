import { useCallback, useState } from 'react';
import { FiRefreshCw } from 'react-icons/fi';
import { clearVisionZones, writeVisionZones } from '../lib/patientImage.js';
import { regeneratePatientFromCase } from '../lib/patientRegen.js';

const API = 'http://127.0.0.1:3001';

function clampZone(z) {
  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const clampRange = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  return {
    cx: clamp01(z.cx),
    cy: clamp01(z.cy),
    w: clampRange(z.w, 0.05, 0.22),
    h: clampRange(z.h, 0.04, 0.18),
  };
}

function normalizeZones(zones) {
  const keys = ['zone-monitor', 'zone-iv-bag', 'zone-blood', 'zone-arm', 'zone-icu'];
  if (!zones || typeof zones !== 'object') return null;
  for (const k of keys) {
    if (!zones[k]) return null;
  }
  const out = {};
  for (const k of keys) out[k] = clampZone(zones[k]);
  return out;
}

async function detectZonesForDataUrl(dataUrl, sourceKey) {
  if (!dataUrl?.startsWith('data:')) return null;
  const base64 = dataUrl.split(',')[1] || '';
  const mimeType = dataUrl.slice(5, dataUrl.indexOf(';')) || 'image/png';
  const r = await fetch(`${API}/api/detect-zones`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageBase64: base64, mimeType }),
  });
  if (!r.ok) return null;
  const data = await r.json();
  const normalized = normalizeZones(data?.zones);
  if (!normalized) return null;
  writeVisionZones(sourceKey, normalized);
  return normalized;
}

export default function RegeneratePatientButton({
  caseData,
  onRegenerated,
  onError,
  onBusyChange,
  className = 'btn-ghost btn-sm',
  label = 'Regenerate this case\'s patient',
}) {
  const [busy, setBusy] = useState(false);

  const handleClick = useCallback(async () => {
    if (busy || !caseData?.id) return;
    setBusy(true);
    onBusyChange?.(true);
    try {
      clearVisionZones();
      const result = await regeneratePatientFromCase(caseData);
      const sourceKey = `regen:${caseData.id}`;
      await detectZonesForDataUrl(result.dataUrl, sourceKey);
      onRegenerated?.(result);
    } catch (e) {
      onError?.(String(e.message || e));
    } finally {
      setBusy(false);
      onBusyChange?.(false);
    }
  }, [busy, caseData, onRegenerated, onError, onBusyChange]);

  return (
    <button
      type="button"
      className={className}
      onClick={() => void handleClick()}
      disabled={busy}
      title="Optional — rebuild only this case's patient from its presentation (OpenAI)"
    >
      <FiRefreshCw className={`chip-icon ${busy ? 'spin' : ''}`} aria-hidden />
      {busy ? 'Regenerating patient…' : label}
    </button>
  );
}
