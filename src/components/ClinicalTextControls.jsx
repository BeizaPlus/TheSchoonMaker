import { useMemo, useState } from 'react';
import { readAudienceProfile } from '../lib/audienceProfile.js';
import { readClinicalTextPrefs } from '../lib/clinicalTextPrefs.js';
import ClinicalFontControls from './ClinicalFontControls.jsx';
import {
  listRefinedEntries,
  refineNarrativeWithAI,
  saveRefinedEntry,
  setActiveRefinedEntry,
} from '../lib/narrativeRefine.js';

export default function ClinicalTextControls({
  caseData,
  rawText,
  onUpdated,
  compact = false,
}) {
  const session = useMemo(() => readAudienceProfile() || {}, []);
  const playRole = caseData?.playRole || session.playRole || 'doctor';
  const difficulty = caseData?.sessionDifficulty || session.difficulty || 'standard';

  const [prefs, setPrefs] = useState(() => readClinicalTextPrefs());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [version, setVersion] = useState(0);

  const entries = useMemo(
    () => listRefinedEntries(caseData?.id, playRole, difficulty),
    [caseData?.id, playRole, difficulty, version],
  );

  const runRefine = async () => {
    setBusy(true);
    setMsg('');
    try {
      const refined = await refineNarrativeWithAI({
        rawText: rawText || caseData?.historyText || caseData?.chief_complaint || '',
        playRole,
        title: caseData?.title,
        category: caseData?.category,
        clinicalTip: caseData?.clinical_tip,
        objective: caseData?.objective,
      });
      const saved = saveRefinedEntry(caseData.id, {
        label: `AI refined · ${playRole}`,
        playRole,
        difficulty,
        intro: refined.intro || '',
        hpi: refined.hpi || refined.formatted || '',
        vitalsText: refined.vitalsText || '',
        clinicalTip: refined.clinicalTip || caseData?.clinical_tip || '',
        objective: refined.objective || caseData?.objective || '',
      });
      setVersion((v) => v + 1);
      setMsg(`Saved "${saved.label}"`);
      onUpdated?.({ entry: saved });
    } catch (e) {
      setMsg(e.message || 'Refine failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`clinical-text-controls ${compact ? 'compact' : ''}`}>
      <ClinicalFontControls
        prefs={prefs}
        onChange={(next) => {
          setPrefs(next);
          onUpdated?.({ prefs: next });
        }}
        compact={compact}
      />
      <div className="clinical-text-controls-row">
        <button type="button" className="btn-ghost clinical-text-btn refine" onClick={runRefine} disabled={busy}>
          {busy ? 'Refining…' : 'Refine with AI'}
        </button>
      </div>
      {entries.length > 0 && (
        <div className="clinical-text-controls-row">
          <label className="clinical-text-controls-label" htmlFor={`refined-${caseData?.id}`}>Version</label>
          <select
            id={`refined-${caseData?.id}`}
            className="clinical-text-select"
            defaultValue=""
            onChange={(e) => {
              const id = e.target.value;
              if (!id) return;
              setActiveRefinedEntry(caseData.id, playRole, difficulty, id);
              setVersion((v) => v + 1);
              onUpdated?.({ entryId: id });
            }}
          >
            <option value="">Original / latest refined</option>
            {entries.map((e) => (
              <option key={e.id} value={e.id}>{e.label}</option>
            ))}
          </select>
        </div>
      )}
      {msg && <p className="clinical-text-msg">{msg}</p>}
    </div>
  );
}
