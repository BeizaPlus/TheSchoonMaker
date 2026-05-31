import preparedCases from '../data/preparedCases.json' with { type: 'json' };
import { getCompletionThresholdAdjust } from './sessionProfile.js';

const PREPARED = preparedCases?.cases || {};

export function getPreparedCase(caseId) {
  const key = String(caseId || '').padStart(3, '0');
  return PREPARED[key] || null;
}

export function applySessionToCase(caseData, session = {}) {
  const playRole = session.playRole === 'patient' ? 'patient' : 'doctor';
  const difficulty = ['easy', 'standard', 'hard'].includes(session.difficulty)
    ? session.difficulty
    : 'standard';
  const prepared = getPreparedCase(caseData?.id);
  const narr = prepared?.narrative?.[playRole]?.[difficulty];

  const merged = {
    ...caseData,
    playRole,
    sessionDifficulty: difficulty,
    preparedVitals: prepared?.vitals || null,
    preparedExam: prepared?.exam || null,
    flowTrack: prepared?.flowTrack || caseData.flowTrack,
    dispositionUnits: prepared?.dispositionUnits || caseData.dispositionUnits,
  };

  if (narr) {
    if (narr.intro) merged.chief_complaint = narr.intro.slice(0, 800);
    if (narr.hpi) merged.historyText = narr.hpi;
    if (narr.vitalsText != null) merged.vitalsText = narr.vitalsText;
    if (narr.clinicalTip) merged.clinical_tip = narr.clinicalTip;
    if (narr.objective) merged.objective = narr.objective;
  }

  if (prepared?.patientSex && prepared.patientSex !== 'unknown') {
    merged.patientSex = prepared.patientSex;
  }

  merged.completionThreshold = getCompletionThresholdAdjust(
    difficulty,
    caseData.completionThreshold ?? 99,
  );

  return merged;
}
