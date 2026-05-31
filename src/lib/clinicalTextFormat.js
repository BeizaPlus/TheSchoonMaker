import preparedCases from '../data/preparedCases.json' with { type: 'json' };

const PREPARED = preparedCases?.cases || {};

const SECTION_HEADERS = [
  'History of present Illness',
  'History of Present Illness',
  'Past Medical History',
  'Current medications',
  'Allergies',
  'Vaccinations',
  "Women's health",
  'Family History',
  'Social History',
  'Review of systems',
  'Review of Systems',
  'Initial History Reason\\(s\\) for visit',
  'Case Introduction',
];

/** Detect broken regex patient-voice conversion (not LLM). */
export function hasBrokenPatientVoice(text = '') {
  return (
    /\bI also claims\b/i.test(text) ||
    /\bI also states\b/i.test(text) ||
    /\bI is an?\b/i.test(text) ||
    /\bI has never\b/i.test(text) ||
    /\bI denies\b/i.test(text) ||
    /\bI feels that her\b/i.test(text) ||
    /\bwhich she rates\b/i.test(text) ||
    /\bI received her\b/i.test(text)
  );
}

export function stripChartJunk(text = '') {
  return String(text)
    .replace(/--- Chart tabs ---[\s\S]*$/i, '')
    .replace(/→ presentation_[^\s]+/g, '')
    .replace(/\* Chart:[^\n]*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Light structure pass — section breaks only, no voice conversion. */
export function formatClinicalText(text = '') {
  let t = stripChartJunk(text);
  if (!t) return '';

  for (const header of SECTION_HEADERS) {
    const re = new RegExp(`(?<!\\n\\n)(${header}\\s*:?)`, 'gi');
    t = t.replace(re, '\n\n$1');
  }

  t = t.replace(/Reason\(s\) for visit:\s*/gi, 'Reason for visit:\n');
  t = t.replace(/\n{3,}/g, '\n\n').trim();
  return t;
}

const SECTION_SHORT = {
  'history of present illness': 'HPI',
  'past medical history': 'PMH',
  'current medications': 'Meds',
  'review of systems': 'ROS',
  'social history': 'Social',
  'family history': 'Family',
  'case introduction': 'Intro',
  "women's health": "Women's",
};

function isSectionHeader(line = '') {
  const t = line.trim();
  if (!t) return false;
  if (t.endsWith(':') && t.length < 72 && !/[.!?]$/.test(t.slice(0, -1))) return true;
  const normalized = t.replace(/:$/, '').toLowerCase();
  return SECTION_HEADERS.some((h) => {
    const key = h.replace(/\\\(.*?\\\)/g, '').toLowerCase();
    return normalized === key || normalized.startsWith(`${key}:`);
  });
}

/** Split formatted clinical text into titled sections for tabbed UI. */
export function parseClinicalSections(text = '') {
  const formatted = formatClinicalText(text);
  if (!formatted) return [{ title: 'Presentation', body: '' }];

  const lines = formatted.split('\n');
  const sections = [];
  let current = null;

  for (const line of lines) {
    if (isSectionHeader(line)) {
      if (current?.body?.trim()) sections.push(current);
      current = { title: line.trim().replace(/:$/, ''), body: '' };
      continue;
    }
    if (!current) current = { title: 'Presentation', body: '' };
    current.body += `${current.body ? '\n' : ''}${line}`;
  }

  if (current && (current.body.trim() || current.title !== 'Presentation')) {
    sections.push({ ...current, body: current.body.trim() });
  }

  if (!sections.length) return [{ title: 'Presentation', body: formatted }];
  return sections;
}

export function shortSectionTitle(title = '') {
  const key = title.trim().replace(/:$/, '').toLowerCase();
  if (SECTION_SHORT[key]) return SECTION_SHORT[key];
  if (key.length <= 14) return title.replace(/:$/, '');
  const words = title.replace(/:$/, '').split(/\s+/);
  if (words.length <= 2) return title.replace(/:$/, '');
  return words
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

export function pickBestHistory({ history = '', intro = '', playRole = 'doctor', caseId }) {
  const h = history.trim();
  const i = intro.trim();

  if (playRole === 'patient' && hasBrokenPatientVoice(h)) {
    const prepared = PREPARED[String(caseId || '').padStart(3, '0')];
    const doctorHpi =
      prepared?.narrative?.doctor?.standard?.hpi ||
      prepared?.narrative?.doctor?.easy?.hpi ||
      '';
    if (doctorHpi && !hasBrokenPatientVoice(doctorHpi)) {
      return doctorHpi;
    }
  }

  if (!h) return i;
  if (i && h.startsWith(i.slice(0, Math.min(i.length, 80)))) return h;
  if (i && h.length < 80) return `${i}\n\n${h}`.trim();
  return h;
}
