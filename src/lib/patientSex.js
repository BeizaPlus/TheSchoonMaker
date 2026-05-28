/** Infer patient sex from case narrative text (CCS intros / history). */
export function inferPatientSex(caseData) {
  const blob = [
    caseData?.chief_complaint,
    caseData?.historyText,
    caseData?.title,
  ]
    .filter(Boolean)
    .join(' ');

  if (!blob) return 'male';

  const femaleHits = (blob.match(/\bfemale\b/gi) || []).length;
  const maleHits = (blob.match(/\bmale\b/gi) || []).length;
  if (femaleHits > maleHits) return 'female';
  if (maleHits > femaleHits) return 'male';

  const she = (blob.match(/\bshe\b/gi) || []).length;
  const he = (blob.match(/\bhe\b/gi) || []).length;
  const his = (blob.match(/\bhis\b/gi) || []).length;
  const her = (blob.match(/\bher\b/gi) || []).length;
  const femaleScore = she + her;
  const maleScore = he + his;
  if (femaleScore > maleScore + 2) return 'female';
  if (maleScore > femaleScore + 2) return 'male';

  return 'male';
}
