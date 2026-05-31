/**
 * Builds src/data/preparedCases.json — single source for vitals, exam, narratives, difficulty copy.
 * Run: node scripts/build-prepared-cases.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { resolvePlaybook } from '../src/data/resolvePlaybook.js';
import { resolveCaseExam } from '../src/lib/caseExam.js';
import {
  loadCaseBank,
  ordersToInterventions,
  distractorsToDecoys,
} from './caseBankLoader.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const CATALOG_PATH = path.join(ROOT, 'src/data/ccsCatalog.json');
const PLAYBOOKS_PATH = path.join(ROOT, 'src/data/playbooks.json');
const OUT_PATH = path.join(ROOT, 'src/data/preparedCases.json');

// Inline vitals helpers (keep in sync with src/lib/vitalsParse.js)
function pickNum(text, re, fallback) {
  const m = text?.match(re);
  if (!m?.[1]) return fallback;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : fallback;
}

function parseCcsVitalsBlock(vitalsText = '') {
  const t = vitalsText || '';
  const temp =
    pickNum(t, /Temperature:\s*\n+\s*([\d.]+)/i, null) ??
    pickNum(t, /(?:temp(?:erature)?)[^\d]{0,8}(\d{2,3}(?:\.\d)?)/i, 37.0);
  const hr =
    pickNum(t, /Pulse:\s*\n+\s*(\d{2,3})/i, null) ??
    pickNum(t, /(?:heart rate|hr|pulse)[^\d]{0,8}(\d{2,3})/i, 100);
  const rr =
    pickNum(t, /Respiratory rate:\s*\n+\s*(\d{1,2})/i, null) ??
    pickNum(t, /(?:resp(?:iratory)? rate|rr)[^\d]{0,8}(\d{1,2})/i, 18);
  const bpMatch = t.match(/(?:bp|blood pressure)[^\d]{0,8}(\d{2,3})\s*\/\s*(\d{2,3})/i);
  const sbp =
    pickNum(t, /systolic:\s*\n+\s*(\d{2,3})/i, null) ?? (bpMatch ? Number(bpMatch[1]) : 110);
  const dbp =
    pickNum(t, /diastolic:\s*\n+\s*(\d{2,3})/i, null) ?? (bpMatch ? Number(bpMatch[2]) : 70);
  const spo2 = pickNum(t, /(?:spo2|o2 sat(?:uration)?)[^\d]{0,8}(\d{2,3})/i, 96);
  const lactate = pickNum(t, /lactate[^\d]{0,8}(\d(?:\.\d)?)/i, 1.8);
  return { sbp, dbp, hr, rr, temp, spo2, lactate };
}

const CATEGORY_VITALS = {
  Cardiopulmonary: { sbp: 98, dbp: 62, hr: 112, rr: 24, temp: 37.2, spo2: 91, lactate: 2.4 },
  'GI & Abdomen': { sbp: 108, dbp: 68, hr: 104, rr: 20, temp: 38.1, spo2: 97, lactate: 2.0 },
  Neurology: { sbp: 148, dbp: 88, hr: 88, rr: 16, temp: 38.4, spo2: 98, lactate: 1.6 },
  'OB/GYN': { sbp: 118, dbp: 74, hr: 108, rr: 20, temp: 37.4, spo2: 98, lactate: 1.9 },
  Genitourinary: { sbp: 122, dbp: 78, hr: 96, rr: 18, temp: 38.6, spo2: 98, lactate: 1.7 },
  'ID & Dermatology': { sbp: 102, dbp: 64, hr: 118, rr: 22, temp: 39.1, spo2: 94, lactate: 2.8 },
  Pediatrics: { sbp: 96, dbp: 58, hr: 128, rr: 28, temp: 38.8, spo2: 95, lactate: 2.2 },
  'Psychiatry & Social': { sbp: 128, dbp: 82, hr: 92, rr: 16, temp: 37.0, spo2: 99, lactate: 1.4 },
  'Trauma & Toxicology': { sbp: 88, dbp: 54, hr: 124, rr: 26, temp: 36.8, spo2: 89, lactate: 4.2 },
  'MSK & General': { sbp: 132, dbp: 84, hr: 98, rr: 18, temp: 37.1, spo2: 98, lactate: 1.5 },
  'Emergency Medicine': { sbp: 110, dbp: 70, hr: 102, rr: 20, temp: 37.5, spo2: 96, lactate: 2.0 },
};

function vitalsForCategory(category, seed = 0) {
  const base = { ...(CATEGORY_VITALS[category] || CATEGORY_VITALS['Emergency Medicine']) };
  const jitter = (n, spread) => Math.max(1, Math.round(n + ((seed % 7) - 3) * spread));
  return {
    sbp: jitter(base.sbp, 3),
    dbp: jitter(base.dbp, 2),
    hr: jitter(base.hr, 4),
    rr: jitter(base.rr, 1),
    temp: Math.round((base.temp + ((seed % 5) - 2) * 0.2) * 10) / 10,
    spo2: jitter(base.spo2, 1),
    lactate: Math.round((base.lactate + ((seed % 3) - 1) * 0.3) * 10) / 10,
  };
}

function parseVitals(vitalsText, category, seed) {
  if (!vitalsText?.trim()) return { vitals: vitalsForCategory(category, seed), source: 'template' };
  const hasSignal =
    /systolic|diastolic|Pulse:|Temperature:/i.test(vitalsText) ||
    /bp|blood pressure|heart rate|spo2/i.test(vitalsText);
  if (!hasSignal) return { vitals: vitalsForCategory(category, seed), source: 'template' };
  return { vitals: parseCcsVitalsBlock(vitalsText), source: 'parsed' };
}

const AUTHORED_FLOWS = {
  '001': {
    flowTrack: 'ACS rapid stratification',
    dispositionUnits: ['ER', 'OBS', 'ICU', 'CATH'],
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
    flowTrack: 'AMS stabilization',
    dispositionUnits: ['ER', 'OBS', 'ICU', 'WARD'],
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
    flowTrack: 'Ectopic exclusion pathway',
    dispositionUnits: ['ER', 'OBS', 'ICU', 'OR'],
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

function defaultExam(category, title) {
  if (AUTHORED_FLOWS[title]) return null;
  if (/abdominal|append|chole|divertic/i.test(title)) {
    return [
      ['General', 'Ill-appearing, diaphoretic, guarding with movement'],
      ['Cardiovascular', 'Tachycardic, delayed capillary refill'],
      ['Respiratory', 'Mild tachypnea, clear breath sounds'],
      ['Abdomen', 'Diffuse tenderness, focal peritoneal signs possible'],
      ['Neuro', 'Alert but uncomfortable'],
      ['Skin', 'Warm, mildly clammy'],
    ];
  }
  if (category === 'Cardiopulmonary') {
    return [
      ['General', 'Distressed, speaking in short phrases'],
      ['Cardiovascular', 'Tachycardic; assess for murmurs and JVD'],
      ['Respiratory', 'Increased work of breathing'],
      ['Abdomen', 'Soft, non-distended'],
      ['Neuro', 'Alert unless hypoperfused'],
      ['Skin', 'Diaphoretic; perfusion varies with stability'],
    ];
  }
  if (category === 'Neurology') {
    return [
      ['General', 'Altered interaction or focal neurologic concern'],
      ['Cardiovascular', 'Rate and rhythm reflect stress response'],
      ['Respiratory', 'Protect airway if decreased mentation'],
      ['Abdomen', 'Non-focal unless alternate source'],
      ['Neuro', 'Mental status and focal deficits guide urgency'],
      ['Skin', 'No rash unless infectious etiology suspected'],
    ];
  }
  return [
    ['General', 'Acutely ill appearance consistent with presentation'],
    ['Cardiovascular', 'Hemodynamics match parsed vitals'],
    ['Respiratory', 'Work of breathing matches chief complaint'],
    ['Abdomen', 'Targeted exam for red-flag sources'],
    ['Neuro', 'Mental status appropriate to case'],
    ['Skin', 'Perfusion and temperature align with vitals'],
  ];
}

function inferSex(intro, history, title) {
  const blob = `${intro} ${history} ${title}`.toLowerCase();
  if (/\b(female|woman|girl|she|her)\b/.test(blob)) return 'female';
  if (/\b(male|man|boy|he|him)\b/.test(blob)) return 'male';
  return 'unknown';
}

function toPatientVoice(text, title) {
  const base = text?.trim() || `I came in because of ${title}.`;
  return base
    .replace(/Case Introduction\s*/gi, '')
    .replace(/A \d+-year-old[^.]{0,120}presents[^.]*\./gi, 'I came in today because ')
    .replace(/The patient/gi, 'I')
    .replace(/\bHe\b/g, 'I')
    .replace(/\bShe\b/g, 'I')
    .replace(/\bHis\b/g, 'My')
    .replace(/\bHer\b/g, 'My')
    .slice(0, 1200);
}

function buildNarrative({ intro, history, vitalsText, clinicalTip, objective, title }) {
  const introClean = intro?.replace(/\s+/g, ' ').trim() || `${title} — emergency presentation.`;
  const hpi = history?.replace(/\s+/g, ' ').trim() || introClean;
  return {
    doctor: {
      easy: {
        intro: introClean,
        hpi,
        vitalsText: vitalsText || '',
        clinicalTip: `Teaching hint: ${clinicalTip}`,
        objective: `${objective} Start with stabilization, then targeted testing.`,
      },
      standard: {
        intro: introClean,
        hpi,
        vitalsText: vitalsText || '',
        clinicalTip,
        objective,
      },
      hard: {
        intro: introClean,
        hpi,
        vitalsText: vitalsText || '',
        clinicalTip: 'Minimal coaching — prioritize life threats without hand-holding.',
        objective: `High-acuity workup: ${objective}`,
      },
    },
    patient: {
      easy: {
        intro: toPatientVoice(introClean, title),
        hpi: toPatientVoice(hpi, title),
        vitalsText: 'The team is checking my vital signs now.',
        clinicalTip: 'You feel unwell and want help — the clinical team will guide next steps.',
        objective: 'Share your symptoms clearly; ask what happens next.',
      },
      standard: {
        intro: toPatientVoice(introClean, title),
        hpi: toPatientVoice(hpi, title),
        vitalsText: vitalsText ? 'What I was told about my vitals is on the monitor.' : '',
        clinicalTip: 'Focus on what you feel, when it started, and what makes it worse or better.',
        objective: 'Participate in shared decision-making as the team stabilizes you.',
      },
      hard: {
        intro: toPatientVoice(introClean, title),
        hpi: toPatientVoice(hpi, title),
        vitalsText: '',
        clinicalTip: 'Limited guidance — advocate for yourself if symptoms worsen.',
        objective: 'Navigate uncertainty while the team works through the differential.',
      },
    },
  };
}

function resolvePlaybookForBuild(ccsCase, playbooks) {
  return resolvePlaybook(ccsCase);
}

const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
const playbooks = JSON.parse(fs.readFileSync(PLAYBOOKS_PATH, 'utf8'));
const caseBank = loadCaseBank();
let bankMerged = 0;

const cases = {};
for (const ccsCase of catalog.cases) {
  const id = ccsCase.id;
  const caseNum = Number(ccsCase.caseNumber);
  const bankCase = caseBank.get(caseNum);
  const pres = catalog.presentations?.[ccsCase.title];
  const pb = resolvePlaybookForBuild(ccsCase, playbooks);
  const intro = bankCase?.hpi || pres?.intro || '';
  const vitalsText = (typeof bankCase?.vitals === 'string' ? bankCase.vitals : '') || pres?.vitals || '';
  const history = bankCase?.hpi || pres?.history || '';
  const seed = Number(ccsCase.caseNumber) || 0;
  const { vitals, source: vitalsSource } = parseVitals(vitalsText, ccsCase.category, seed);
  const authored = AUTHORED_FLOWS[id];
  const examFromBank = Array.isArray(bankCase?.physical_exam) ? bankCase.physical_exam : null;
  const exam = examFromBank || resolveCaseExam({
    caseId: id,
    title: ccsCase.title,
    category: ccsCase.category,
    history,
    vitals,
    preparedExam: authored?.exam || null,
    hasSourceIntro: Boolean(pres?.intro || bankCase?.hpi),
  });

  const bankInterventions =
    bankCase?.correct_orders?.length
      ? ordersToInterventions(bankCase.correct_orders, bankCase.rationale || {})
      : null;
  const bankDecoys = bankCase?.distractors?.length
    ? distractorsToDecoys(bankCase.distractors, caseNum)
    : null;
  const interventions = bankInterventions?.length ? bankInterventions : pb.interventions;
  if (bankInterventions?.length) bankMerged += 1;

  cases[id] = {
    id,
    title: ccsCase.title,
    category: ccsCase.category,
    presentationKey: ccsCase.title,
    playbookKey: bankInterventions?.length ? `case-bank-${caseNum}` : pb.playbookKey || pb.presentation || ccsCase.title,
    diagnosis: bankCase?.diagnosis || pb.diagnosis || null,
    caseBankSource: bankCase?.enrichment_source || bankCase?.source || null,
    hasSourceIntro: Boolean(pres?.intro || bankCase?.hpi),
    vitals,
    vitalsSource,
    vitalsText: vitalsText.replace(/\s+/g, ' ').trim(),
    flowTrack: authored?.flowTrack || 'Standard ED pathway',
    dispositionUnits: authored?.dispositionUnits || ['ER', 'OBS', 'ICU', 'WARD'],
    exam,
    patientSex: inferSex(intro, history, ccsCase.title),
    difficulty: 'standard',
    clinical_tip: pb.clinical_tip,
    objective: pb.objective,
    interventionIds: interventions.map((iv) => iv.id),
    interventions,
    decoys: bankDecoys || [],
    narrative: buildNarrative({
      intro,
      history,
      vitalsText,
      clinicalTip: pb.clinical_tip,
      objective: pb.objective,
      title: ccsCase.title,
    }),
  };
}

const out = {
  version: 1,
  builtAt: new Date().toISOString(),
  totalCases: Object.keys(cases).length,
  caseBankMerged: bankMerged,
  caseBankDir: path.resolve(__dirname, '../../data/cases'),
  cases,
};

fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2), 'utf8');
console.log(`Wrote ${out.totalCases} prepared cases → ${OUT_PATH}`);
console.log(`Case bank treatments merged: ${bankMerged}/${out.totalCases}`);
