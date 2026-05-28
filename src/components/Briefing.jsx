import { useEffect, useState } from 'react';
import PatientScene from './PatientScene.jsx';
import BriefingCasePicker from './BriefingCasePicker.jsx';
import {
  getPatientImagePayload,
  readVisionZones,
  writeVisionZones,
} from '../lib/patientImage.js';

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
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setReady(false);
    setLoading(true);
    const t = setTimeout(() => {
      setReady(true);
      setLoading(false);
    }, 2200);
    return () => clearTimeout(t);
  }, [caseData?.id]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        const payload = await getPatientImagePayload(caseData);
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

  return (
    <main className="briefing briefing-with-scene">
      <div className="briefing-scene-wrap" aria-hidden>
        <PatientScene scene={caseData.patientScene} className="briefing-scene-img" />
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
          <p className="briefing-intro">{caseData.chief_complaint}</p>
          <p className="briefing-tip">{caseData.clinical_tip}</p>
          <p className="briefing-objective">Objective — {caseData.objective}</p>
          <div className="briefing-load">
            <div className="briefing-dots" aria-hidden>
              <span className="brief-dot filled" />
              <span className="brief-dot" />
              <span className="brief-dot" />
              <span className="brief-dot" />
              <span className="brief-dot" />
            </div>
            <div className="briefing-bar" aria-hidden>
              <div className={`briefing-bar-fill ${loading ? 'loading' : ''}`} />
            </div>
          </div>
          <div className="briefing-actions">
            <button type="button" className="btn-primary" onClick={onBegin} disabled={!ready}>
              {ready ? 'Begin case →' : 'Loading…'}
            </button>
            <button type="button" className="btn-ghost" onClick={onBack}>
              Back
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
