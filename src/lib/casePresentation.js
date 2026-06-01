import {
  formatClinicalText,
  pickBestHistory,
} from './clinicalTextFormat.js';
import { getActiveRefinedNarrative } from './narrativeRefine.js';
import { readAudienceProfile } from './audienceProfile.js';
import { getPreparedCase } from './caseNarrative.js';

/** Whether this case has imported CCS narrative vs a placeholder stub. */
export function hasRichPresentation(caseData) {
  if (caseData?.preparedMeta?.hasSourceIntro) return true;
  const history = caseData?.historyText || '';
  if (history.length < 120) return false;
  return !/— emergency presentation\.?$/i.test(history.trim());
}

export function getPresentationIntro(caseData) {
  const playRole = caseData?.playRole || readAudienceProfile()?.playRole || 'doctor';
  const difficulty = caseData?.sessionDifficulty || readAudienceProfile()?.difficulty || 'standard';
  const refined = getActiveRefinedNarrative(caseData?.id, playRole, difficulty);
  if (refined?.intro) return formatClinicalText(refined.intro);
  return formatClinicalText(caseData?.chief_complaint?.trim() || '');
}

export function getPresentationHistory(caseData) {
  const playRole = caseData?.playRole || readAudienceProfile()?.playRole || 'doctor';
  const difficulty = caseData?.sessionDifficulty || readAudienceProfile()?.difficulty || 'standard';
  const refined = getActiveRefinedNarrative(caseData?.id, playRole, difficulty);
  if (refined?.hpi) return formatClinicalText(refined.hpi);
  const prepared = getPreparedCase(caseData?.id);
  const preparedNarrative =
    prepared?.narrative?.[playRole]?.[difficulty]?.hpi ||
    prepared?.narrative?.[playRole]?.standard?.hpi ||
    prepared?.narrative?.doctor?.standard?.hpi ||
    prepared?.narrative?.doctor?.easy?.hpi ||
    '';

  const intro = caseData?.chief_complaint?.trim() || '';
  const history = caseData?.historyText?.trim() || preparedNarrative.trim();
  const text = pickBestHistory({
    history,
    intro,
    playRole,
    caseId: caseData?.id,
  });
  return formatClinicalText(text);
}

export function getPresentationVitals(caseData) {
  const playRole = caseData?.playRole || readAudienceProfile()?.playRole || 'doctor';
  const difficulty = caseData?.sessionDifficulty || readAudienceProfile()?.difficulty || 'standard';
  const refined = getActiveRefinedNarrative(caseData?.id, playRole, difficulty);
  if (refined?.vitalsText) return formatClinicalText(refined.vitalsText);
  return formatClinicalText(caseData?.vitalsText?.trim() || '');
}
