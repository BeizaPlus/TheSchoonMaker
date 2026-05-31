/**
 * Reads Step 3 CCS exports → game/src/data/ccsCatalog.json
 * Run: node scripts/build-ccs-catalog.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STEP3 = path.join(__dirname, '../../../Step 3');
const OUT = path.join(__dirname, '../src/data/ccsCatalog.json');
const PRES_DIR = path.join(STEP3, 'ccs_presentations');

const TITLE_TO_CATEGORY = [
  [/chest pain|palpitation|shortness of breath|cough|sob/i, 'Cardiopulmonary'],
  [/abdominal|epigastric|nausea|vomit|diarrhea|constipation|hematemesis/i, 'GI & Abdomen'],
  [/headache|seizure|altered mental|unconscious|unresponsive|memory|dizziness|facial pain|somnolence/i, 'Neurology'],
  [/pelvic|vaginal|amenorrhea|prenatal|dyspareunia|breast|menstrual|postcoital/i, 'OB/GYN'],
  [/urinat|dysuria|scrotal|hematuria/i, 'Genitourinary'],
  [/rash|fever|yellow|lethargy|burning during/i, 'ID & Dermatology'],
  [/baby|feeding|stature|enuresis/i, 'Pediatrics'],
  [/anxiety|depression|paranoia|agitation|hanging|assault/i, 'Psychiatry & Social'],
  [/burn|bite|drown|fall|trauma|unconscious/i, 'Trauma & Toxicology'],
  [/knee|back pain|leg pain|weakness|muscle|wrist|foot|joint/i, 'MSK & General'],
];

function categorize(title) {
  for (const [re, cat] of TITLE_TO_CATEGORY) {
    if (re.test(title)) return cat;
  }
  return 'Emergency Medicine';
}

function parsePresentationFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const intro = raw.match(/--- Case Introduction ---\s*([\s\S]*?)(?=--- Initial Vital Signs ---)/)?.[1]?.trim() || '';
  const vitals = raw.match(/--- Initial Vital Signs ---\s*([\s\S]*?)(?=--- Initial History ---)/)?.[1]?.trim() || '';
  const history = raw.match(/--- Initial History ---\s*([\s\S]*?)$/)?.[1]?.trim() || '';
  const title = raw.match(/Case \d+: (.+)/)?.[1]?.trim();
  return { title, intro, vitals, history };
}

const listPath = path.join(STEP3, 'ccs_screenshots/ccs_case_list.json');
if (!fs.existsSync(listPath)) {
  if (fs.existsSync(OUT)) {
    console.log(`Step 3 export not found at ${listPath}; keeping existing ${OUT}`);
    process.exit(0);
  }
  console.error(`Missing Step 3 export: ${listPath}`);
  console.error(`Expected CCS case list JSON. Copy Step 3 data or restore ${OUT}.`);
  process.exit(1);
}
const data = JSON.parse(fs.readFileSync(listPath, 'utf8'));

const presentations = {};
if (fs.existsSync(PRES_DIR)) {
  for (const f of fs.readdirSync(PRES_DIR).filter((x) => x.endsWith('.txt'))) {
    const p = parsePresentationFile(path.join(PRES_DIR, f));
    if (p.title) presentations[p.title] = p;
  }
}

const cases = data.cases.map((c) => ({
  id: String(c.caseNumber).padStart(3, '0'),
  caseNumber: c.caseNumber,
  title: c.title,
  category: categorize(c.title),
  timeLimit: c.timeLimit,
  averageGrade: c.averageGrade,
  highYield: c.highYield,
  completionDate: c.completionDate,
  hasIntro: Boolean(presentations[c.title]),
}));

const categoryMap = {};
for (const c of cases) {
  if (!categoryMap[c.category]) categoryMap[c.category] = [];
  categoryMap[c.category].push(c.id);
}

const categories = Object.entries(categoryMap)
  .map(([id, caseIds]) => ({
    id,
    label: id,
    count: caseIds.length,
    caseIds,
  }))
  .sort((a, b) => b.count - a.count);

const catalog = {
  builtAt: new Date().toISOString(),
  source: 'Step 3 / CCS',
  totalCases: cases.length,
  sidebarCategories: data.sidebar?.categories || [],
  categories,
  cases,
  presentations,
};

fs.writeFileSync(OUT, JSON.stringify(catalog, null, 2));
console.log(`Wrote ${OUT}`);
console.log(`${cases.length} cases, ${categories.length} categories, ${Object.keys(presentations).length} presentation intros`);
