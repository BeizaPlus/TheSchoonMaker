import playbooks from './playbooks.json' with { type: 'json' };
import caseSpecific from './caseSpecificPlaybooks.json' with { type: 'json' };

/** CCS presentation title → playbook key when titles differ or need routing. */
const TITLE_ALIASES = {
  'Acute Confusion': 'Altered Mental Status',
  Delirium: 'Altered Mental Status',
  Confusion: 'Altered Mental Status',
  Syncope: 'Altered Mental Status',
  Seizure: 'Altered Mental Status',
  Stroke: 'Altered Mental Status',
  Weakness: 'Generalized Weakness',
  'Shortness of Breath': 'Shortness of Breath',
  Dyspnea: 'Shortness of Breath',
};

/** When no title match exists, use a category playbook instead of generic default. */
const CATEGORY_FALLBACK = {
  Neurology: 'Altered Mental Status',
  'GI & Abdomen': 'Abdominal Pain',
  Cardiopulmonary: 'Chest Pain',
  'OB/GYN': 'Pelvic Pain',
  Genitourinary: 'Burning During Urination',
  'ID & Dermatology': 'Rash and Lethargy',
  'MSK & General': 'Generalized Weakness',
  Pediatrics: 'Poor Feeding',
};

function presentationForKey(key) {
  if (!key) return null;
  return playbooks.presentations?.[key] || null;
}

function resolvePresentationKey(ccsCase, override) {
  if (override && typeof override === 'string' && !String(override).startsWith('_')) {
    return override;
  }

  const title = ccsCase?.title || '';
  if (TITLE_ALIASES[title]) return TITLE_ALIASES[title];
  if (presentationForKey(title)) return title;

  const insensitive = Object.keys(playbooks.presentations || {}).find(
    (key) => key.toLowerCase() === title.toLowerCase(),
  );
  if (insensitive) return insensitive;

  return title;
}

/** Resolve drag-game playbook: per-case authored → title presentation → category → default. */
export function resolvePlaybook(ccsCase) {
  const specific =
    caseSpecific.cases?.[ccsCase.id] || caseSpecific.cases?.[ccsCase.caseNumber];
  if (specific?.interventions?.length) {
    return { ...specific, playbookKey: `case-${ccsCase.id}` };
  }

  const override =
    playbooks.casePlaybooks?.[ccsCase.id] || playbooks.casePlaybooks?.[ccsCase.caseNumber];
  let key = resolvePresentationKey(ccsCase, override);

  let presentation =
    presentationForKey(key) ||
    presentationForKey(ccsCase.title);

  if (!presentation && CATEGORY_FALLBACK[ccsCase.category]) {
    const fallbackKey = CATEGORY_FALLBACK[ccsCase.category];
    const fallback = presentationForKey(fallbackKey);
    if (fallback) {
      presentation = fallback;
      key = fallbackKey;
    }
  }

  if (!presentation) {
    presentation = playbooks.default;
    key = key || ccsCase.title || 'default';
  }

  return { ...presentation, playbookKey: key };
}

/** Number of required orders/stacks for a CCS case (3–20+ depending on playbook). */
export function getCaseOrderCount(ccsCase) {
  if (!ccsCase) return 0;
  return resolvePlaybook(ccsCase)?.interventions?.length || 0;
}

export function getCaseSpecificPlaybookIds() {
  return Object.keys(caseSpecific.cases || {});
}

export function hasCaseSpecificPlaybook(caseId) {
  return Boolean(caseSpecific.cases?.[String(caseId)]);
}
