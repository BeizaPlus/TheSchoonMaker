import { getCaseFlow } from '../data/caseFlows.js';
import { getPreparedCase } from './caseNarrative.js';

const API = 'http://127.0.0.1:3001';
const sessions = new Map();

export function buildCaseChatContext(caseData) {
  const flow = getCaseFlow(caseData);
  const prepared = getPreparedCase(caseData?.id);
  return {
    id: caseData?.id,
    ccsNumber: caseData?.ccsNumber,
    title: caseData?.title,
    category: caseData?.category,
    timeLimit: caseData?.timeLimit,
    playRole: caseData?.playRole || 'doctor',
    sessionDifficulty: caseData?.sessionDifficulty || 'standard',
    patientSex: caseData?.patientSex,
    chief_complaint: caseData?.chief_complaint,
    historyText: caseData?.historyText,
    vitalsText: caseData?.vitalsText,
    clinical_tip: caseData?.clinical_tip,
    objective: caseData?.objective,
    vitals: flow?.vitals,
    exam: flow?.exam,
    flowTrack: flow?.flowTrack,
    dispositionUnits: flow?.dispositionUnits,
    hasSourceIntro: prepared?.hasSourceIntro ?? caseData?.preparedMeta?.hasSourceIntro,
    interventions: (caseData?.interventions || []).map((iv) => ({
      id: iv.id,
      label: iv.label,
      why: iv.why,
      guideline: iv.guideline,
      zone: iv.correct_zone,
    })),
    algorithm: caseData?.algorithm
      ? {
          title: caseData.algorithm.title,
          steps: (caseData.algorithm.steps || []).map((s) => ({
            order: s.order,
            label: s.label,
            zoneLabel: s.zoneLabel,
          })),
        }
      : null,
  };
}

export async function checkCaseChatAvailable() {
  try {
    const r = await fetch(`${API}/api/health`);
    if (!r.ok) return false;
    const data = await r.json();
    return Boolean(data.openai);
  } catch {
    return false;
  }
}

/** One OpenAI session per case id — case JSON sent once in the system prompt. */
export async function ensureCaseChatSession(caseData) {
  const caseId = String(caseData?.id || '');
  if (!caseId) throw new Error('Missing case id');

  const cached = sessions.get(caseId);
  if (cached?.sessionId) return cached.sessionId;

  const caseContext = buildCaseChatContext(caseData);
  const r = await fetch(`${API}/api/case-chat/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ caseContext }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    throw new Error(data.error || 'Could not start case chat session');
  }
  sessions.set(caseId, { sessionId: data.sessionId, caseId });
  return data.sessionId;
}

export function clearCaseChatSession(caseId) {
  sessions.delete(String(caseId || ''));
}

export async function sendCaseChatMessage(sessionId, message) {
  const r = await fetch(`${API}/api/case-chat/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, message }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    throw new Error(data.error || 'Case chat request failed');
  }
  return data.reply;
}
