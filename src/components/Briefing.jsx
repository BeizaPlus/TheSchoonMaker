import { useEffect, useState } from 'react';
import PatientScene from './PatientScene.jsx';
import BriefingCasePicker from './BriefingCasePicker.jsx';
import CaseReviewFlagButton from './CaseReviewFlagButton.jsx';
import {
  getPatientImagePayload,
  readVisionZones,
  writeVisionZones,
} from '../lib/patientImage.js';
import {
  getPresentationHistory,
  getPresentationIntro,
  getPresentationVitals,
} from '../lib/casePresentation.js';
import { readCaseRegenImage } from '../lib/patientRegen.js';

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

export default function Briefing({ caseData, onBegin, onBack, onSelectCase }) {
  const [regenSrc, setRegenSrc] = useState(() => readCaseRegenImage(caseData?.id));

  useEffect(() => {
    setRegenSrc(readCaseRegenImage(caseData?.id));
  }, [caseData?.id]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        const savedRegen = readCaseRegenImage(caseData.id);
        let payload;
        if (savedRegen?.startsWith('data:')) {
          payload = {
            base64: savedRegen.split(',')[1] || '',
            mimeType: savedRegen.slice(5, savedRegen.indexOf(';')) || 'image/png',
            source: `regen:${caseData.id}`,
          };
        } else if (savedRegen?.startsWith('http')) {
          if (readVisionZones(savedRegen)) return;
          const resp = await fetch(savedRegen);
          const blob = await resp.blob();
          const mimeType = blob.type || 'image/png';
          const dataUrl = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || ''));
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
          payload = {
            base64: dataUrl.split(',')[1] || '',
            mimeType,
            source: savedRegen,
          };
        } else {
          payload = await getPatientImagePayload(caseData);
        }
        if (readVisionZones(payload.source)) return;

        const r = await fetch('http://127.0.0.1:3001/api/detect-zones', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64: payload.base64,
            mimeType: payload.mimeType,
          }),
        });
        if (!r.ok) return;
        const data = await r.json();
        const normalized = normalizeZones(data?.zones);
        if (!normalized || cancelled) return;
        writeVisionZones(payload.source, normalized);
      } catch {
        /* ignore — config zones still work */
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [caseData?.id]);

  const presentationIntro = getPresentationIntro(caseData);
  const presentationHistory = getPresentationHistory(caseData);
  const presentationVitals = getPresentationVitals(caseData);
  const presentationText =
    presentationHistory || presentationIntro || 'No presentation text available.';

  return (
    <main className="briefing briefing-with-scene briefing-minimal">
      <div className="briefing-scene-wrap" aria-hidden>
        <PatientScene scene={caseData.patientScene} className="briefing-scene-img" forceSrc={regenSrc} />
        <div className="briefing-scene-dim" />
      </div>

      {onSelectCase && (
        <BriefingCasePicker currentCaseId={caseData.id} onSelectCase={onSelectCase} />
      )}

      <div className="briefing-layout">
        <div className="briefing-main">
          <p className="briefing-case">
            CCS Case {caseData.ccsNumber || caseData.id}
            {caseData.category ? ` · ${caseData.category}` : ''}
            {caseData.timeLimit ? ` · ${caseData.timeLimit}` : ''}
          </p>
          <h1>{caseData.title}</h1>
          {caseData.diagnosis && (
            <p className="briefing-diagnosis-line">{caseData.diagnosis}</p>
          )}
          <div className="briefing-scroll">
            <p>{presentationText}</p>
            {presentationVitals && (
              <p className="briefing-vitals-line">{presentationVitals}</p>
            )}
          </div>
          <p className="briefing-objective">Objective — {caseData.objective}</p>
          <div className="briefing-actions">
            <button type="button" className="btn-primary" onClick={onBegin}>
              Begin case →
            </button>
            <CaseReviewFlagButton caseId={caseData.id} compact />
            <button type="button" className="btn-ghost" onClick={onBack}>
              Back
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
