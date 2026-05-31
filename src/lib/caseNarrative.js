import preparedCases from '../data/preparedCases.json' with { type: 'json' };
import { getCompletionThresholdAdjust } from './sessionProfile.js';
import { getActiveRefinedNarrative } from './narrativeRefine.js';
import { resolveCaseExam } from './caseExam.js';

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

  const refined = getActiveRefinedNarrative(caseData?.id, playRole, difficulty);
  if (refined) {
    if (refined.intro) merged.chief_complaint = refined.intro.slice(0, 800);
    if (refined.hpi) merged.historyText = refined.hpi;
    if (refined.vitalsText != null) merged.vitalsText = refined.vitalsText;
    if (refined.clinicalTip) merged.clinical_tip = refined.clinicalTip;
    if (refined.objective) merged.objective = refined.objective;
    merged.narrativeSource = refined.label || 'refined';
  }

  if (prepared?.patientSex && prepared.patientSex !== 'unknown') {
    merged.patientSex = prepared.patientSex;
  }

  if (prepared?.interventions?.length) {
    merged.interventions = prepared.interventions;
  }
  if (prepared?.decoys?.length) {
    merged.decoys = prepared.decoys;
  }
  if (prepared?.diagnosis) {
    merged.diagnosis = prepared.diagnosis;
  }
  if (prepared?.caseBankSource) {
    merged.caseBankSource = prepared.caseBankSource;
  }
  if (prepared?.exam?.length) {
    merged.preparedExam = prepared.exam;
  }

  merged.preparedExam = resolveCaseExam({
    caseId: caseData?.id,
    title: prepared?.title || caseData?.title,
    category: prepared?.category || caseData?.category,
    history: merged.historyText || prepared?.narrative?.doctor?.standard?.hpi || '',
    vitals: prepared?.vitals || merged.preparedVitals,
    preparedExam: merged.preparedExam,
    hasSourceIntro: prepared?.hasSourceIntro || caseData?.preparedMeta?.hasSourceIntro,
  });

  merged.completionThreshold = getCompletionThresholdAdjust(
    difficulty,
    caseData.completionThreshold ?? 99,
  );

  return merged;
}
