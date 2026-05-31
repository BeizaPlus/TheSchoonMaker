import { STORAGE } from './storageKeys.js';
import { DEFAULT_TIMER_SECONDS, normalizeTimerSeconds } from './caseTimer.js';

const CONDITION_CASE_IDS = {
  diabetes: ['004', '032', '056', '060'],
  asthma: ['016', '048', '066', '074'],
  hypertension: ['005', '034', '140'],
  hyperlipidemia: ['001', '015', '040', '052', '117', '124'],
  depression: ['128', '160', '107', '115'],
  heart_attack: ['001', '015', '040', '052'],
  stroke: ['002', '033', '051'],
  pneumonia: ['023', '053', '058', '066'],
  broken_bone: ['042', '043', '089'],
  concussion: ['035', '142'],
  appendicitis: ['004', '009', '011'],
  kidney_stones: ['010', '086', '114'],
  anemia: ['007', '106', '138'],
  eczema: ['110', '127', '141'],
};

const BASELINE_PUBLIC_ORDER = [
  ...CONDITION_CASE_IDS.diabetes,
  ...CONDITION_CASE_IDS.hypertension,
  ...CONDITION_CASE_IDS.depression,
  ...CONDITION_CASE_IDS.hyperlipidemia,
];

const LAYPERSON_EXCLUDED_CATEGORIES = new Set([
  'Psychiatry & Social',
  'Trauma & Toxicology',
]);

export function levelFromSlider(value) {
  const n = Number(value) || 0;
  if (n <= 0.33) return 'kid';
  if (n <= 0.66) return 'layperson';
  if (n <= 0.88) return 'mid';
  return 'advanced';
}

export function sliderFromLevel(level) {
  if (level === 'kid') return 0.2;
  if (level === 'layperson') return 0.5;
  if (level === 'mid') return 0.75;
  return 1;
}

export function readAudienceProfile() {
  try {
    const raw = localStorage.getItem(STORAGE.audienceProfile);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const level = ['kid', 'layperson', 'mid', 'advanced'].includes(parsed.level)
      ? parsed.level
      : 'layperson';
    const condition = typeof parsed.condition === 'string' ? parsed.condition : 'diabetes';
    const playRole = parsed.playRole === 'patient' ? 'patient' : 'doctor';
    const difficulty = ['easy', 'standard', 'hard'].includes(parsed.difficulty)
      ? parsed.difficulty
      : 'standard';
    const timerSeconds = normalizeTimerSeconds(parsed.timerSeconds, DEFAULT_TIMER_SECONDS);
    return { level, condition, playRole, difficulty, timerSeconds };
  } catch {
    return null;
  }
}

export function writeAudienceProfile(profile) {
  try {
    const payload = { ...profile };
    if (payload.timerSeconds != null) {
      payload.timerSeconds = normalizeTimerSeconds(payload.timerSeconds, DEFAULT_TIMER_SECONDS);
    }
    localStorage.setItem(STORAGE.audienceProfile, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
}

function unique(list) {
  return [...new Set(list)];
}

export function getAllowedCaseIds(catalogCases, profile) {
  const allIds = catalogCases.map((c) => c.id);
  const level = profile?.level || 'advanced';
  const condition = profile?.condition || 'diabetes';
  const focused = CONDITION_CASE_IDS[condition] || [];

  if (level === 'advanced') return allIds;

  const safeCases = catalogCases.filter((c) => !LAYPERSON_EXCLUDED_CATEGORIES.has(c.category));
  const safeIds = safeCases.map((c) => c.id);

  const publicOrdered = unique([...focused, ...BASELINE_PUBLIC_ORDER]).filter((id) =>
    safeIds.includes(id),
  );

  if (level === 'kid' || level === 'layperson') {
    return publicOrdered.slice(0, 20);
  }

  const expanded = unique([
    ...publicOrdered,
    ...safeCases
      .filter((c) => c.hasIntro && Number(c.caseNumber || 999) <= 90)
      .map((c) => c.id),
  ]);
  return expanded.slice(0, 72);
}

export function getConditionChoices(level = 'advanced') {
  if (level === 'kid' || level === 'layperson') {
    return [
      { id: 'diabetes', label: 'Diabetes' },
      { id: 'hypertension', label: 'High blood pressure' },
      { id: 'depression', label: 'Depression' },
      { id: 'hyperlipidemia', label: 'Hyperlipidemia' },
    ];
  }
  return [
    { id: 'diabetes', label: 'Diabetes' },
    { id: 'asthma', label: 'Asthma' },
    { id: 'hypertension', label: 'High blood pressure' },
    { id: 'hyperlipidemia', label: 'Hyperlipidemia' },
    { id: 'depression', label: 'Depression' },
    { id: 'heart_attack', label: 'Heart attack' },
    { id: 'stroke', label: 'Stroke' },
    { id: 'pneumonia', label: 'Pneumonia' },
    { id: 'broken_bone', label: 'Broken bone' },
    { id: 'concussion', label: 'Concussion' },
    { id: 'appendicitis', label: 'Appendicitis' },
    { id: 'kidney_stones', label: 'Kidney stones' },
    { id: 'anemia', label: 'Anemia' },
    { id: 'eczema', label: 'Eczema' },
  ];
}
