/** Whether this case has imported CCS narrative vs a placeholder stub. */
export function hasRichPresentation(caseData) {
  if (caseData?.preparedMeta?.hasSourceIntro) return true;
  const history = caseData?.historyText || '';
  if (history.length < 120) return false;
  return !/— emergency presentation\.?$/i.test(history.trim());
}

export function getPresentationIntro(caseData) {
  return caseData?.chief_complaint?.trim() || '';
}

export function getPresentationHistory(caseData) {
  const history = caseData?.historyText?.trim() || '';
  const intro = getPresentationIntro(caseData);
  if (!history) return intro;
  if (intro && history.startsWith(intro.slice(0, Math.min(intro.length, 80)))) {
    return history;
  }
  return history;
}

export function getPresentationVitals(caseData) {
  return caseData?.vitalsText?.trim() || '';
}
