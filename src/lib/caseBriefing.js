import { formatClinicalText } from './clinicalTextFormat.js';
import { hasRichPresentation } from './casePresentation.js';

function formatVitalsLine(vitals = {}) {
  const temp =
    typeof vitals.temp === 'number' ? `${vitals.temp.toFixed(1)}°C` : '—';
  const lactate =
    typeof vitals.lactate === 'number' ? vitals.lactate.toFixed(1) : '—';
  return `BP ${vitals.sbp ?? '—'}/${vitals.dbp ?? '—'} · HR ${vitals.hr ?? '—'} · RR ${vitals.rr ?? '—'} · Temp ${temp} · SpO₂ ${vitals.spo2 ?? '—'}% · Lactate ${lactate}`;
}

/** Full HPI for briefing / sidebar — expands stub cases with vitals and context. */
export function getBriefingHpi(caseData, caseFlow, presentationHpi = '') {
  const hpi = formatClinicalText(presentationHpi || caseData?.historyText || caseData?.chief_complaint || '');
  if (hasRichPresentation(caseData) && hpi.length > 140) return hpi;

  const parts = [];
  const lead = presentationHpi || caseData?.chief_complaint || caseData?.title || 'Emergency presentation';
  parts.push(lead);

  if (caseFlow?.vitals) {
    parts.push(`Initial vitals: ${formatVitalsLine(caseFlow.vitals)}.`);
  }
  if (caseData?.vitalsText?.trim()) {
    parts.push(caseData.vitalsText.trim());
  }
  if (caseData?.flowTrack) {
    parts.push(`Clinical pathway: ${caseData.flowTrack}.`);
  }
  if (caseData?.category) {
    parts.push(`Setting: ${caseData.category}${caseData.timeLimit ? ` · ${caseData.timeLimit}` : ''}.`);
  }
  if (caseData?.objective?.trim()) {
    parts.push(`Case focus: ${caseData.objective.trim()}`);
  }

  return parts.join('\n\n');
}

/** Multi-line physical exam for briefing. */
export function getBriefingExam(caseFlow) {
  const exam = caseFlow?.exam || [];
  if (!exam.length) return 'No physical exam findings documented yet.';
  return exam.map(([system, finding]) => `${system}\n${finding}`).join('\n\n');
}

/** Treatment plan summary (text only — stacks appear after Begin). */
export function getBriefingTreatment(caseData, interventions = []) {
  if (!interventions.length) {
    return caseData?.clinical_tip?.trim() || 'Review expected orders after you begin the case.';
  }
  const lines = interventions.map((iv, i) => {
    const why = iv.why?.trim();
    return why ? `${i + 1}. ${iv.label}\n   ${why}` : `${i + 1}. ${iv.label}`;
  });
  const blocks = [`Expected orders (${interventions.length} stacks):`, '', ...lines];
  if (caseData?.clinical_tip?.trim()) {
    blocks.push('', `Teaching focus: ${caseData.clinical_tip.trim()}`);
  }
  return blocks.join('\n');
}

/** Full chart note for the Notes tab — deep dive beyond the summary tabs. */
export function getBriefingNotes(caseData, caseFlow, presentationHpi = '') {
  const sections = [];
  const chief = formatClinicalText(caseData?.chief_complaint?.trim() || '');
  const history = formatClinicalText(caseData?.historyText?.trim() || '');
  const summaryHpi = formatClinicalText(presentationHpi || '');

  if (chief) {
    sections.push({ title: 'Chief complaint', body: chief });
  }
  if (history && history !== summaryHpi && history.length > summaryHpi.length + 20) {
    sections.push({ title: 'History of present illness', body: history });
  } else if (summaryHpi) {
    sections.push({ title: 'History of present illness', body: summaryHpi });
  }

  if (caseFlow?.vitals) {
    sections.push({ title: 'Vitals', body: formatVitalsLine(caseFlow.vitals) });
  }
  if (caseData?.vitalsText?.trim()) {
    sections.push({ title: 'Vitals narrative', body: caseData.vitalsText.trim() });
  }

  const exam = getBriefingExam(caseFlow);
  if (exam) {
    sections.push({ title: 'Physical examination', body: exam });
  }

  const treatment = getBriefingTreatment(caseData, caseData?.interventions || []);
  if (treatment) {
    sections.push({ title: 'Treatment plan', body: treatment });
  }

  if (caseData?.diagnosis) {
    sections.push({ title: 'Working diagnosis', body: caseData.diagnosis });
  }
  if (caseData?.clinical_tip?.trim()) {
    sections.push({ title: 'Clinical tip', body: caseData.clinical_tip.trim() });
  }
  if (caseData?.objective?.trim()) {
    sections.push({ title: 'Learning objective', body: caseData.objective.trim() });
  }

  if (!sections.length) {
    return 'No extended chart note available for this case yet.';
  }

  return sections.map(({ title, body }) => `${title}\n${body}`).join('\n\n');
}
