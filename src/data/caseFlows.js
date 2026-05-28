/**
 * Case flow — prefers preparedCases.json (built by scripts/build-prepared-cases.mjs).
 */

import { getPreparedCase } from '../lib/caseNarrative.js';
import { parseVitalsFromText } from '../lib/vitalsParse.js';

const CASE_FLOW_DICTIONARY = {
  '001': {
    id: '001',
    title: 'Chest Pain',
    flowTrack: 'ACS rapid stratification',
    dispositionUnits: ['ER', 'OBS', 'ICU', 'CATH'],
    vitals: { sbp: 96, dbp: 62, hr: 112, rr: 22, temp: 37.5, spo2: 93, lactate: 2.1 },
    exam: [
      ['General', 'Diaphoretic and anxious, clutching chest'],
      ['Cardiovascular', 'Tachycardic, regular rhythm, no new murmur'],
      ['Respiratory', 'Mild tachypnea, bibasilar crackles absent'],
      ['Abdomen', 'Soft, non-tender'],
      ['Neuro', 'Alert and oriented'],
      ['Skin', 'Cool clammy extremities'],
    ],
  },
  '002': {
    id: '002',
    title: 'Altered Mental Status',
    flowTrack: 'AMS stabilization',
    dispositionUnits: ['ER', 'OBS', 'ICU', 'WARD'],
    vitals: { sbp: 102, dbp: 66, hr: 106, rr: 24, temp: 38.0, spo2: 95, lactate: 2.8 },
    exam: [
      ['General', 'Somnolent, intermittently arousable'],
      ['Cardiovascular', 'Tachycardic with delayed capillary refill'],
      ['Respiratory', 'Compensatory tachypnea'],
      ['Abdomen', 'Soft, no rebound or guarding'],
      ['Neuro', 'Confused, follows simple commands'],
      ['Skin', 'Warm with mild diaphoresis'],
    ],
  },
  '003': {
    id: '003',
    title: 'Pelvic Pain',
    flowTrack: 'Ectopic exclusion pathway',
    dispositionUnits: ['ER', 'OBS', 'ICU', 'OR'],
    vitals: { sbp: 94, dbp: 58, hr: 118, rr: 23, temp: 37.8, spo2: 96, lactate: 3.1 },
    exam: [
      ['General', 'Uncomfortable, guarding lower abdomen'],
      ['Cardiovascular', 'Tachycardic with borderline hypotension'],
      ['Respiratory', 'Non-labored breathing'],
      ['Abdomen', 'Suprapubic and unilateral lower quadrant tenderness'],
      ['Neuro', 'Alert but distressed'],
      ['Skin', 'Pale, slightly diaphoretic'],
    ],
  },
};

function defaultExamRows(title = '') {
  if (/abdominal|append|chole|divertic/i.test(title)) {
    return [
      ['General', 'Ill-appearing, diaphoretic, guarding with movement'],
      ['Cardiovascular', 'Tachycardic, delayed capillary refill'],
      ['Respiratory', 'Mild tachypnea, clear breath sounds'],
      ['Abdomen', 'Diffuse tenderness, worst RLQ, no rigid board-like abdomen'],
      ['Neuro', 'Alert but uncomfortable, no focal deficits'],
      ['Skin', 'Warm, mildly clammy, no rash'],
    ];
  }
  return [
    ['General', 'Acutely ill with high physiologic stress'],
    ['Cardiovascular', 'Tachycardic with reduced perfusion signs'],
    ['Respiratory', 'Compensatory tachypnea, monitor work of breathing'],
    ['Abdomen', 'Focused exam guides source control'],
    ['Neuro', 'Mentation may fluctuate with perfusion'],
    ['Skin', 'Assess perfusion, temperature, and focal findings'],
  ];
}

export function getCaseFlow(caseData) {
  const key = String(caseData?.id || '').padStart(3, '0');
  const prepared = getPreparedCase(key);
  if (prepared?.vitals) {
    return {
      id: key,
      title: caseData?.title || prepared.title,
      flowTrack: prepared.flowTrack || 'Standard ED pathway',
      dispositionUnits: prepared.dispositionUnits || ['ER', 'OBS', 'ICU', 'WARD'],
      vitals: prepared.vitals,
      exam: prepared.exam || defaultExamRows(caseData?.title || ''),
    };
  }
  const authored = CASE_FLOW_DICTIONARY[key];
  if (authored) return authored;
  const seed = Number(caseData?.ccsNumber) || Number(key) || 0;
  return {
    id: key,
    title: caseData?.title || 'Case',
    flowTrack: 'Standard ED pathway',
    dispositionUnits: ['ER', 'OBS', 'ICU', 'WARD'],
    vitals: parseVitalsFromText(
      caseData?.vitalsText || '',
      caseData?.category || 'Emergency Medicine',
      seed,
    ),
    exam: defaultExamRows(caseData?.title || ''),
  };
}

