/**
 * Physical exam resolution — presentation bank → HPI-derived → vitals-based.
 * Avoids generic category boilerplate when case bank text is available.
 */

const GENERIC_FINDINGS = new Set([
  'Altered interaction or focal neurologic concern',
  'Rate and rhythm reflect stress response',
  'Protect airway if decreased mentation',
  'Non-focal unless alternate source',
  'Mental status and focal deficits guide urgency',
  'No rash unless infectious etiology suspected',
  'Acutely ill appearance consistent with presentation',
  'Hemodynamics match parsed vitals',
  'Work of breathing matches chief complaint',
  'Targeted exam for red-flag sources',
  'Mental status appropriate to case',
  'Perfusion and temperature align with vitals',
  'Distressed, speaking in short phrases',
  'Tachycardic; assess for murmurs and JVD',
  'Increased work of breathing',
  'Soft, non-distended',
  'Alert unless hypoperfused',
  'Diaphoretic; perfusion varies with stability',
]);

/** Authored per-case exams (cases with captured CCS depth). */
export const AUTHORED_CASE_EXAMS = {
  '001': [
    ['General', 'Diaphoretic and anxious, clutching chest'],
    ['Cardiovascular', 'Tachycardic, regular rhythm, no new murmur'],
    ['Respiratory', 'Mild tachypnea, bibasilar crackles absent'],
    ['Abdomen', 'Soft, non-tender'],
    ['Neuro', 'Alert and oriented'],
    ['Skin', 'Cool clammy extremities'],
  ],
  '002': [
    ['General', 'Somnolent, intermittently arousable'],
    ['Cardiovascular', 'Tachycardic with delayed capillary refill'],
    ['Respiratory', 'Compensatory tachypnea'],
    ['Abdomen', 'Soft, no rebound or guarding'],
    ['Neuro', 'Confused, follows simple commands; gait unsteady after recent fall'],
    ['Skin', 'Warm with mild diaphoresis'],
  ],
  '003': [
    ['General', 'Uncomfortable, guarding lower abdomen'],
    ['Cardiovascular', 'Tachycardic with borderline hypotension'],
    ['Respiratory', 'Non-labored breathing'],
    ['Abdomen', 'Suprapubic and unilateral lower quadrant tenderness'],
    ['Neuro', 'Alert but distressed'],
    ['Skin', 'Pale, slightly diaphoretic'],
  ],
};

/** Presentation-title exams synced with captured CCS playbooks. */
export const PRESENTATION_EXAMS = {
  'Chest Pain': AUTHORED_CASE_EXAMS['001'],
  'Altered Mental Status': AUTHORED_CASE_EXAMS['002'],
  'Pelvic Pain': AUTHORED_CASE_EXAMS['003'],
  'Abdominal Pain': [
    ['General', 'Ill-appearing, diaphoretic, guarding with movement'],
    ['Cardiovascular', 'Tachycardic, delayed capillary refill'],
    ['Respiratory', 'Mild tachypnea, clear breath sounds'],
    ['Abdomen', 'Diffuse tenderness with focal peritoneal signs possible'],
    ['Neuro', 'Alert but uncomfortable, no focal deficits'],
    ['Skin', 'Warm, mildly clammy, no rash'],
  ],
  'Headache': [
    ['General', 'Uncomfortable, photophobic, concerned about worst headache'],
    ['Cardiovascular', 'Normotensive to mildly elevated BP on repeat checks'],
    ['Respiratory', 'Non-labored, no hypoxia'],
    ['Abdomen', 'Soft, non-tender'],
    ['Neuro', 'Occipital tenderness; assess neck stiffness and focal deficits'],
    ['Skin', 'Prior rash resolved per history; no current petechiae'],
  ],
  'Memory Loss': [
    ['General', 'Family reports progressive memory loss and personality change'],
    ['Cardiovascular', 'Hemodynamically stable; continuous monitoring in place'],
    ['Respiratory', 'Airway patent, no respiratory distress'],
    ['Abdomen', 'Soft, non-tender, no organomegaly appreciated'],
    ['Neuro', 'Impaired short-term recall; disorientation; gait instability with recent falls'],
    ['Skin', 'No meningismus; assess for bruising from falls'],
  ],
  'Rash and Lethargy': [
    ['General', 'Lethargic, ill-appearing on presentation'],
    ['Cardiovascular', 'Tachycardic when febrile, capillary refill monitored'],
    ['Respiratory', 'Clear to decreased breath sounds depending on work of breathing'],
    ['Abdomen', 'Soft, may have mild tenderness if systemic illness'],
    ['Neuro', 'Lethargy with intact or fluctuating mental status'],
    ['Skin', 'Rash distribution and morphology documented; petechiae ruled out if toxic'],
  ],
  'Generalized Weakness': [
    ['General', 'Fatigued, reports progressive weakness'],
    ['Cardiovascular', 'Heart rate and BP reflect volume and metabolic status'],
    ['Respiratory', 'Breath sounds clear unless respiratory muscle weakness'],
    ['Abdomen', 'Soft, non-focal'],
    ['Neuro', 'Motor strength testing shows fatigable weakness pattern'],
    ['Skin', 'No rash; hydration and perfusion assessed'],
  ],
  'Burning During Urination': [
    ['General', 'Uncomfortable, afebrile to febrile depending on progression'],
    ['Cardiovascular', 'Tachycardic if febrile or dehydrated'],
    ['Respiratory', 'Non-labored'],
    ['Abdomen', 'Suprapubic tenderness possible; costovertebral angle tenderness if pyelonephritis'],
    ['Neuro', 'Alert, no focal deficits'],
    ['Skin', 'No rash unless STI-related findings'],
  ],
  'Shortness of Breath': [
    ['General', 'Dyspneic, speaking in short phrases if severe'],
    ['Cardiovascular', 'Tachycardic; JVD and peripheral edema assessed'],
    ['Respiratory', 'Increased work of breathing; crackles or wheeze documented'],
    ['Abdomen', 'Soft, non-distended'],
    ['Neuro', 'Alert unless hypercapnic or hypoxic'],
    ['Skin', 'Cyanosis absent unless critical hypoxemia'],
  ],
  'Found Unconscious': [
    ['General', 'Unresponsive on arrival, airway and circulation addressed first'],
    ['Cardiovascular', 'Hemodynamics stabilized with monitoring'],
    ['Respiratory', 'Airway protection and oxygenation priority'],
    ['Abdomen', 'Deferred until stable unless trauma pathway'],
    ['Neuro', 'GCS documented; pupils and focal signs assessed'],
    ['Skin', 'Trauma survey for lacerations, track marks, temperature'],
  ],
};

function isGenericTemplateExam(exam) {
  if (!Array.isArray(exam) || !exam.length) return true;
  const genericCount = exam.filter(([, finding]) => GENERIC_FINDINGS.has(finding)).length;
  return genericCount >= Math.ceil(exam.length * 0.5);
}

function clip(text = '', max = 220) {
  const t = String(text).replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trim()}…`;
}

function formatCardiovascular(vitals = {}, historyLower = '') {
  const parts = [];
  if (vitals.hr != null) {
    let note = `HR ${vitals.hr}`;
    if (vitals.hr > 110) note += ', tachycardic';
    else if (vitals.hr < 60) note += ', bradycardic';
    parts.push(note);
  }
  if (vitals.sbp != null && vitals.dbp != null) {
    parts.push(`BP ${vitals.sbp}/${vitals.dbp}`);
    if (vitals.sbp < 95) parts.push('hypotensive');
  }
  if (/murmur|jvd|gallop|clutching chest|diaphoretic/i.test(historyLower)) {
    parts.push('cardiac exam guided by presentation acuity');
  }
  return parts.length ? `${parts.join('; ')}.` : 'Heart rate and rhythm assessed at bedside.';
}

function formatRespiratory(vitals = {}, historyLower = '') {
  const parts = [];
  if (vitals.rr != null) {
    let note = `RR ${vitals.rr}`;
    if (vitals.rr > 22) note += ', tachypneic';
    parts.push(note);
  }
  if (vitals.spo2 != null) {
    parts.push(`SpO₂ ${vitals.spo2}%`);
    if (vitals.spo2 < 92) parts.push('hypoxemic');
  }
  if (/dyspnea|shortness of breath|respiratory distress|wheez|crackles/i.test(historyLower)) {
    parts.push('increased work of breathing noted');
  }
  return parts.length ? `${parts.join('; ')}.` : 'Breath sounds and work of breathing assessed.';
}

function deriveGeneral(history = '', title = '') {
  const h = history;
  const hl = h.toLowerCase();
  if (/diaphoretic|anxious|clutching|acute distress|moaning/i.test(h)) {
    const m = h.match(/[^.!?]*(?:diaphoretic|distress|moaning|anxious)[^.!?]*[.!?]/i);
    if (m) return clip(m[0]);
  }
  if (/behavioral|barely talks|stares|somnolent|confused|lethargic|altered mental|memory loss/i.test(hl)) {
    return 'Decreased engagement and cognitive change compared with reported baseline.';
  }
  if (/pain|rash|weakness|headache|cough|bleeding/i.test(hl)) {
    const m = h.match(/(?:presents|complaining|reports)[^.!?]{20,180}[.!?]/i);
    if (m) return clip(m[0]);
  }
  if (title) return clip(`${title} — exam tailored to chief complaint on arrival.`);
  return 'Exam findings reflect presentation acuity on arrival.';
}

function deriveAbdomen(historyLower = '', title = '') {
  if (/abdominal|pelvic|suprapubic|nausea|vomit|guarding|rlq|llq/i.test(historyLower)) {
    if (/guarding|tender|rebound|peritoneal/i.test(historyLower)) {
      return 'Tenderness with guarding; peritoneal signs assessed.';
    }
    return 'Abdominal tenderness pattern matches history; no rigid abdomen documented yet.';
  }
  if (/burning during urination|dysuria|flank/i.test(historyLower)) {
    return 'Suprapubic or CVA tenderness assessed for UTI/pyelonephritis source.';
  }
  if (/pelvic/i.test(title.toLowerCase())) {
    return 'Pelvic and abdominal exam indicated for pain source localization.';
  }
  return 'Soft, non-distended, no focal peritoneal signs on initial exam.';
}

function deriveNeuro(historyLower = '', title = '') {
  const tl = title.toLowerCase();
  if (/memory loss|confus|altered mental|somnolent|stares|barely talks|gait|fall|weakness|headache|seizure|stroke|numbness|focal/i.test(historyLower + tl)) {
    if (/memory loss/i.test(tl)) {
      return 'Impaired recall and orientation; gait and focal motor/sensory exam documented.';
    }
    if (/headache/i.test(tl)) {
      return 'Mental status intact; cranial nerves and neck stiffness assessed.';
    }
    if (/altered mental|confus|somnolent/i.test(historyLower + tl)) {
      return 'Altered mental status with attention and command-following documented.';
    }
    if (/weakness/i.test(historyLower + tl)) {
      return 'Motor strength and reflexes tested for fatigability and focal deficits.';
    }
    return 'Neurologic exam focused on mental status and focal deficits.';
  }
  return 'Alert and oriented unless perfusion or metabolic derangement present.';
}

function deriveSkin(historyLower = '', vitals = {}) {
  if (/rash|petech|lesion|jaundice|diaphoretic|clammy|pale/i.test(historyLower)) {
    if (/rash|petech/i.test(historyLower)) return 'Skin rash morphology and distribution documented.';
    if (/diaphoretic|clammy|pale/i.test(historyLower)) return 'Diaphoretic or pale skin with perfusion checked.';
  }
  if (vitals.temp >= 38.5) return 'Warm skin with fever; no purpura on initial survey.';
  return 'No acute rash; capillary refill and perfusion assessed.';
}

/** Build exam rows from imported CCS history + parsed vitals. */
export function deriveExamFromHistory(history = '', vitals = {}, title = '', category = '') {
  const clean = String(history).replace(/\s+/g, ' ').trim();
  if (clean.length < 80) return null;

  const hl = clean.toLowerCase();
  return [
    ['General', deriveGeneral(clean, title)],
    ['Cardiovascular', formatCardiovascular(vitals, hl)],
    ['Respiratory', formatRespiratory(vitals, hl)],
    ['Abdomen', deriveAbdomen(hl, title || category)],
    ['Neuro', deriveNeuro(hl, title || category)],
    ['Skin', deriveSkin(hl, vitals)],
  ];
}

function titleKey(title = '') {
  const t = String(title).trim();
  if (PRESENTATION_EXAMS[t]) return t;
  const found = Object.keys(PRESENTATION_EXAMS).find(
    (key) => key.toLowerCase() === t.toLowerCase(),
  );
  return found || t;
}

function applyVitalsToExam(exam, vitals = {}) {
  return exam.map(([system, finding]) => {
    if (system === 'Cardiovascular') return [system, formatCardiovascular(vitals, '')];
    if (system === 'Respiratory') return [system, formatRespiratory(vitals, '')];
    return [system, finding];
  });
}

function mergeExamWithVitals(template, derived, vitals) {
  const derivedMap = Object.fromEntries(derived);
  return template.map(([system, finding]) => {
    if (system === 'Cardiovascular') return [system, formatCardiovascular(vitals, '')];
    if (system === 'Respiratory') return [system, formatRespiratory(vitals, '')];
    const fromHistory = derivedMap[system];
    if (system === 'General' || system === 'Neuro' || system === 'Abdomen' || system === 'Skin') {
      return [system, fromHistory || finding];
    }
    return [system, finding];
  });
}

function vitalsBasedExam(vitals = {}, title = '', category = '') {
  const hl = `${title} ${category}`.toLowerCase();
  return [
    ['General', deriveGeneral('', title || category)],
    ['Cardiovascular', formatCardiovascular(vitals, hl)],
    ['Respiratory', formatRespiratory(vitals, hl)],
    ['Abdomen', deriveAbdomen(hl, title)],
    ['Neuro', deriveNeuro(hl, title)],
    ['Skin', deriveSkin(hl, vitals)],
  ];
}

/**
 * Resolve physical exam for a case from the case bank.
 * Priority: per-case authored → presentation title → HPI-derived → stored (if not generic) → vitals-based.
 */
export function resolveCaseExam({
  caseId = '',
  title = '',
  category = '',
  history = '',
  vitals = {},
  preparedExam = null,
  hasSourceIntro = false,
} = {}) {
  const key = String(caseId || '').padStart(3, '0');
  const presentationTitle = titleKey(title);

  if (AUTHORED_CASE_EXAMS[key]) {
    return AUTHORED_CASE_EXAMS[key];
  }

  if (PRESENTATION_EXAMS[presentationTitle]) {
    const template = PRESENTATION_EXAMS[presentationTitle];
    if (hasSourceIntro || history.length > 120) {
      const derived = deriveExamFromHistory(history, vitals, presentationTitle, category);
      if (derived) {
        return mergeExamWithVitals(template, derived, vitals);
      }
    }
    return applyVitalsToExam(template, vitals);
  }

  const derived = deriveExamFromHistory(history, vitals, presentationTitle, category);
  if (derived) return derived;

  if (preparedExam?.length && !isGenericTemplateExam(preparedExam)) {
    return preparedExam;
  }

  return vitalsBasedExam(vitals, presentationTitle, category);
}

export function isGenericExam(exam) {
  return isGenericTemplateExam(exam);
}
