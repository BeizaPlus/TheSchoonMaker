/**
 * Builds src/data/ccsCatalog.json from Step 3 CCS exports in ./step3
 * Run: npm run build:catalog
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const STEP3_CANDIDATES = [
  path.join(ROOT, 'step3'),
  path.join(__dirname, '../../../Step 3'),
];
const OUT = path.join(ROOT, 'src/data/ccsCatalog.json');

function resolveStep3Root() {
  return STEP3_CANDIDATES.find((p) => fs.existsSync(path.join(p, 'ccs_mirror'))) || STEP3_CANDIDATES[0];
}

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

function loadPresentations(presDir) {
  const presentations = {};
  if (!fs.existsSync(presDir)) return presentations;

  for (const f of fs.readdirSync(presDir).filter((x) => x.endsWith('.txt') && x.startsWith('presentation_'))) {
    const p = parsePresentationFile(path.join(presDir, f));
    if (p.title) presentations[p.title] = p;
  }
  return presentations;
}

function catalogToCaseList(catalog) {
  return {
    exportedAt: catalog.builtAt || new Date().toISOString(),
    sidebar: {
      sortBy: 'Case Number',
      listStyle: 'List',
      categories: catalog.sidebarCategories || [],
      otherFilters: [],
      timedExam: 'Unknown',
      customTimeLimit: 'None',
      networkLag: 'None',
    },
    cases: catalog.cases.map((c) => ({
      caseNumber: String(c.caseNumber),
      title: c.title,
      completionDate: c.completionDate || '',
      highYield: c.highYield || '',
      timeLimit: c.timeLimit || '',
      averageGrade: c.averageGrade || '',
      reviewLater: false,
    })),
  };
}

function loadCaseList(step3Root, catalogFallback) {
  const listPath = path.join(step3Root, 'ccs_screenshots/ccs_case_list.json');
  if (fs.existsSync(listPath)) {
    return { data: JSON.parse(fs.readFileSync(listPath, 'utf8')), source: listPath, kind: 'step3-export' };
  }

  if (catalogFallback?.cases?.length) {
    console.warn(`Step 3 case list missing at ${listPath}`);
    console.warn('Using checked-in ccsCatalog.json as case bank until you run: npm run capture:case-list');
    return { data: catalogToCaseList(catalogFallback), source: OUT, kind: 'catalog-fallback' };
  }

  return null;
}

const step3Root = resolveStep3Root();
const presDir = path.join(step3Root, 'ccs_presentations');
const presentations = loadPresentations(presDir);

let catalogFallback = null;
if (fs.existsSync(OUT)) {
  try {
    catalogFallback = JSON.parse(fs.readFileSync(OUT, 'utf8'));
  } catch {
    catalogFallback = null;
  }
}

const loaded = loadCaseList(step3Root, catalogFallback);
if (!loaded) {
  console.error(`Missing case bank. Add ${path.join(step3Root, 'ccs_screenshots/ccs_case_list.json')}`);
  console.error('Run: npm run capture:case-list  (requires step3/ccs_credentials.json)');
  process.exit(1);
}

const { data, source, kind } = loaded;

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
  step3Root: path.relative(ROOT, step3Root).replace(/\\/g, '/'),
  caseListSource: kind,
  caseListPath: path.relative(ROOT, source).replace(/\\/g, '/'),
  presentationFiles: Object.keys(presentations).length,
  totalCases: cases.length,
  sidebarCategories: data.sidebar?.categories || catalogFallback?.sidebarCategories || [],
  categories,
  cases,
  presentations,
};

fs.writeFileSync(OUT, JSON.stringify(catalog, null, 2));
console.log(`Wrote ${OUT}`);
console.log(`${cases.length} cases, ${categories.length} categories, ${Object.keys(presentations).length} presentation intros`);
console.log(`Case list: ${kind} (${path.relative(ROOT, source)})`);
console.log(`Step 3 root: ${path.relative(ROOT, step3Root)}`);
