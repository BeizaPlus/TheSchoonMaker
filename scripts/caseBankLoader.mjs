/**
 * Load scraped CCS case bank from ER doc/data/cases/
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const CASE_BANK_DIR = path.resolve(__dirname, '../../data/cases');
export const CASE_BANK_MASTER = path.resolve(__dirname, '../../data/ccs_cases_master.json');

const ZONE_RULES = [
  [/oxygen|o2|pulse ox|monitor|telemetry|ecg|ekg|x-?ray|cxr|ct |mri|imaging|ultrasound|peak flow|abg/i, 'zone-monitor'],
  [/iv fluid|fluid bolus|normal saline|lactated|transfusion|insulin|heparin|ppi|antibiotic|magnesium|steroid|nebul|epinephrine|lorazepam|morphine|nitro|aspirin|statin|beta-?block|vasopress|pressor|drip/i, 'zone-iv-bag'],
  [/iv access|large-?bore|central line|needle|decompression|medication|meds|injection|tpa|thrombol|intubat|tube thorac|thoracostomy|splint|pain control/i, 'zone-arm'],
  [/cbc|bmp|cmp|lab|troponin|culture|type & cross|crossmatch|hCG|pregnancy|glucose|lactate|coag|ua\b|urinalysis|blood draw|std|naat/i, 'zone-blood'],
  [/admit|icu|ccu|telemetry ward|disposition|consult|ed\b|emergency department|or\b|surgery|gi consult|neuro|ob consult|cardiology|ortho|ent|psych/i, 'zone-icu'],
  [/abdominal exam|pelvic exam|physical exam|exam\b|neuro exam|rectal/i, 'zone-custom-1'],
];

function slugify(label, idx) {
  const base = String(label)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  return base || `order-${idx}`;
}

export function inferZone(label) {
  for (const [re, zone] of ZONE_RULES) {
    if (re.test(label)) return zone;
  }
  return 'zone-arm';
}

export function ordersToInterventions(orders = [], rationale = {}) {
  return orders.map((order, idx) => {
    const label = typeof order === 'string' ? order : order?.order || order?.label || '';
    if (!label) return null;
    const id = slugify(label, idx);
    return {
      id,
      label,
      correct_zone: inferZone(label),
      why: rationale[label] || (typeof order === 'object' ? order.rationale : '') || 'Required for this case presentation.',
      guideline: typeof order === 'object' ? order.guideline || 'ACEP' : 'ACEP',
    };
  }).filter(Boolean);
}

export function distractorsToDecoys(distractors = [], caseId) {
  return distractors.map((d, idx) => {
    const label = typeof d === 'string' ? d : d?.order || '';
    if (!label) return null;
    return {
      id: `decoy-bank-${caseId}-${idx}`,
      label,
      why: typeof d === 'object' ? d.why_wrong || d.why || 'Incorrect for this presentation.' : 'Incorrect for this presentation.',
      correct_zone: 'zone-custom-2',
    };
  }).filter(Boolean);
}

export function loadCaseBank() {
  const byId = new Map();
  if (fs.existsSync(CASE_BANK_MASTER)) {
    try {
      const master = JSON.parse(fs.readFileSync(CASE_BANK_MASTER, 'utf8'));
      for (const c of master.cases || []) {
        if (c?.id != null) byId.set(Number(c.id), c);
      }
    } catch {
      /* fall through */
    }
  }
  if (fs.existsSync(CASE_BANK_DIR)) {
    for (const f of fs.readdirSync(CASE_BANK_DIR)) {
      const m = f.match(/^case_(\d+)\.json$/i);
      if (!m) continue;
      try {
        const c = JSON.parse(fs.readFileSync(path.join(CASE_BANK_DIR, f), 'utf8'));
        byId.set(Number(m[1]), c);
      } catch {
        /* skip bad file */
      }
    }
  }
  return byId;
}

export function getCaseBankEntry(caseId, bank = loadCaseBank()) {
  return bank.get(Number(caseId)) || null;
}
