/** 5-intervention playbooks keyed by CCS presentation title (drag-game format) */

const Z = {
  monitor: 'zone-monitor',
  iv: 'zone-iv-bag',
  blood: 'zone-blood',
  arm: 'zone-arm',
  icu: 'zone-icu',
};

function iv(id, label, zone, why, guideline) {
  return { id, label, correct_zone: zone, why, guideline };
}

export const PLAYBOOKS = {
  'Chest Pain': {
    clinical_tip: 'Until proven otherwise, treat unstable chest pain as ACS.',
    objective: 'Rule out life threats. ECG within 10 minutes.',
    interventions: [
      iv('ecg', '12-Lead ECG', Z.monitor, 'STEMI vs NSTEMI vs other — do not delay for labs.', 'ACC/AHA'),
      iv('aspirin', 'Aspirin 324mg', Z.arm, 'Chewed unless allergy. Reduces mortality in ACS.', 'ACC/AHA'),
      iv('troponin', 'Troponin + BMP', Z.blood, 'Baseline and trend. Risk-stratify with ECG.', 'ACC/AHA'),
      iv('heparin', 'Heparin / Anticoag', Z.iv, 'If ACS confirmed per protocol after ECG.', 'ACC/AHA'),
      iv('cath', 'Cath lab / Admit', Z.icu, 'STEMI → activate PCI. Unstable → monitored bed.', 'ACC/AHA'),
    ],
  },
  'Altered Mental Status': {
    clinical_tip: 'Fingerstick glucose before CT — hypoglycemia mimics stroke.',
    objective: 'Stabilize ABCs. Identify reversible causes.',
    interventions: [
      iv('glucose', 'Point-of-care Glucose', Z.blood, 'Hypoglycemia is immediately reversible.', 'ACEP'),
      iv('thiamine', 'Thiamine IV', Z.iv, 'Before dextrose in malnourished / alcoholic patients.', 'ACEP'),
      iv('ct', 'CT Head non-contrast', Z.monitor, 'Rule out bleed before tPA or if trauma concern.', 'AHA/ACEP'),
      iv('labs', 'BMP · CBC · UA · Tox', Z.blood, 'Infection, uremia, electrolytes, overdose.', 'ACEP'),
      iv('admit', 'Monitor / ICU admit', Z.icu, 'Protect airway if GCS falling; continuous neuro checks.', 'ACEP'),
    ],
  },
  'Pelvic Pain': {
    clinical_tip: 'Positive pregnancy test changes everything — ectopic until proven otherwise.',
    objective: 'Rule out ectopic, torsion, and rupture.',
    interventions: [
      iv('upt', 'Pregnancy test (UPT)', Z.blood, 'Mandatory in reproductive-age patients.', 'ACOG'),
      iv('us', 'Pelvic Ultrasound', Z.monitor, 'Ectopic, ovarian torsion, abscess.', 'ACOG'),
      iv('iv', 'IV Access + Type & Screen', Z.iv, 'Two large-bore if unstable or rupture concern.', 'ACOG'),
      iv('ob', 'OB/GYN Consult', Z.arm, 'Surgical emergency if ruptured ectopic.', 'ACOG'),
      iv('or', 'OR / ICU if unstable', Z.icu, 'Unstable ectopic → surgery, not methotrexate.', 'ACOG'),
    ],
  },
  'Abdominal Pain': {
    clinical_tip: 'Elderly and immunocompromised may have minimal exam findings until rupture.',
    objective: 'Resuscitate, image, involve surgery early if indicated.',
    interventions: [
      iv('iv', 'IV Fluids + NPO', Z.iv, 'Resuscitate before imaging if hypotensive.', 'ACS'),
      iv('labs', 'CBC · Lipase · LFTs · UA', Z.blood, 'Narrow differential: biliary, pancreatic, UTI, medical.', 'ACS'),
      iv('ct', 'CT Abdomen/Pelvis', Z.monitor, 'High yield for appendicitis, diverticulitis, obstruction.', 'ACR'),
      iv('surg', 'Surgery Consult', Z.arm, 'Perforation, appendicitis, mesenteric ischemia.', 'EAST'),
      iv('abx', 'Antibiotics if indicated', Z.iv, 'Give before OR if sepsis or perforation suspected.', 'IDSA'),
    ],
  },
  'Headache': {
    clinical_tip: 'Thunderclap headache = SAH workup. Do not send home without considering red flags.',
    objective: 'Rule out SAH, meningitis, mass, and hypertensive emergency.',
    interventions: [
      iv('ct', 'CT Head', Z.monitor, 'Non-contrast first for thunderclap or neuro deficit.', 'AHA'),
      iv('lp', 'LP if CT negative', Z.blood, 'Xanthochromia / cell count for SAH.', 'AHA'),
      iv('bp', 'BP Management', Z.arm, 'Treat only if hypertensive emergency criteria met.', 'AHA'),
      iv('mri', 'MRI / MRA if indicated', Z.monitor, 'Venous sinus thrombosis, posterior fossa lesions.', 'AHA'),
      iv('admit', 'Observation / Neuro', Z.icu, 'Worst headache of life → admit until SAH excluded.', 'ACEP'),
    ],
  },
  'Rash and Lethargy': {
    clinical_tip: 'Petechiae + fever in a sick patient — treat empirically for meningococcemia.',
    objective: 'Recognize toxic rash syndromes. Resuscitate and cover infection.',
    interventions: [
      iv('abx', 'Empiric Antibiotics IV', Z.iv, 'Do not delay for LP if unstable or petechial rash.', 'IDSA'),
      iv('fluids', 'IV Fluid Bolus', Z.iv, 'Septic shock physiology common in toxic presentations.', 'SSC'),
      iv('cultures', 'Blood Cultures', Z.blood, 'Before antibiotics when possible — not if delaying care.', 'IDSA'),
      iv('icu', 'ICU / Isolation', Z.icu, 'Droplet precautions for meningococcal concern.', 'CDC'),
      iv('derm', 'Dermatology / ID consult', Z.arm, 'Toxic epidermal necrolysis, meningococcemia, vasculitis.', 'IDSA'),
    ],
  },
  'Generalized Weakness': {
    clinical_tip: 'Weakness + hyperreflexia vs hyporeflexia localizes — think electrolytes and cord.',
    objective: 'Differentiate metabolic, neurologic, and toxic causes.',
    interventions: [
      iv('glucose', 'Glucose · BMP', Z.blood, 'Hypo/hyperkalemia, hypercalcemia, hypoglycemia.', 'ACEP'),
      iv('ekg', 'ECG + Monitor', Z.monitor, 'HyperK causes weakness and arrhythmia.', 'ACEP'),
      iv('mri', 'MRI Spine if cord signs', Z.monitor, 'Cord compression is a surgical emergency.', 'AAN'),
      iv('tox', 'Tox screen if indicated', Z.blood, 'Botulism, organophosphates, sedatives.', 'ACEP'),
      iv('admit', 'Admit / Neuro consult', Z.icu, 'Progressive weakness or respiratory concern → ICU.', 'ACEP'),
    ],
  },
  'Burning During Urination': {
    clinical_tip: 'Complicated UTI in men, pregnancy, or fever → admit and image.',
    objective: 'Treat infection; rule out pyelonephritis and STI.',
    interventions: [
      iv('ua', 'Urinalysis + Culture', Z.blood, 'Culture guides therapy; send before antibiotics if stable.', 'IDSA'),
      iv('abx', 'Empiric Antibiotics', Z.iv, 'Cover E. coli; adjust for local resistance.', 'IDSA'),
      iv('fluids', 'IV Fluids if febrile', Z.iv, 'Pyelonephritis and sepsis need volume.', 'IDSA'),
      iv('ct', 'CT if complicated', Z.monitor, 'Abscess, obstruction, emphysematous pyelonephritis.', 'AUA'),
      iv('urology', 'Urology / Admit', Z.icu, 'Male with fever, obstruction, or sepsis.', 'IDSA'),
    ],
  },
  'Shortness of Breath': {
    clinical_tip: 'ABG or pulse ox + ECG + CXR in the first minutes.',
    objective: 'Stabilize hypoxia. Differentiate pulmonary vs cardiac vs metabolic.',
    interventions: [
      iv('o2', 'Oxygen / BIPAP', Z.monitor, 'Target SpO₂ per protocol; prepare intubation if tiring.', 'ACEP'),
      iv('cxr', 'CXR + ECG', Z.monitor, 'PE, pneumothorax, CHF, pneumonia patterns.', 'ACEP'),
      iv('d-dimer', 'BNP · D-dimer · ABG', Z.blood, 'PE workup, CHF, CO₂ retention in COPD.', 'ACEP'),
      iv('ctpa', 'CT Pulmonary Angiography', Z.monitor, 'If PE suspected and pre-test probability warrants.', 'ACEP'),
      iv('admit', 'ICU if unstable', Z.icu, 'BiPAP failure, shock, or rising work of breathing.', 'ACEP'),
    ],
  },
};

const DEFAULT = {
  clinical_tip: 'Stabilize first — ABCs, IV access, monitor, then targeted workup.',
  objective: 'Identify and treat life threats within the time limit.',
  interventions: [
    iv('monitor', 'Cardiac Monitor', Z.monitor, 'Continuous vitals for any unstable patient.', 'ACEP'),
    iv('iv', 'IV Access + Fluids', Z.iv, 'Two large-bore if shock or active bleeding.', 'ATLS'),
    iv('labs', 'Stat Labs', Z.blood, 'CBC, BMP, lactate, type & screen as indicated.', 'ACEP'),
    iv('imaging', 'Bedside / CT imaging', Z.monitor, 'Targeted study based on presentation.', 'ACEP'),
    iv('admit', 'Admit / Disposition', Z.icu, 'Match level of care to illness severity.', 'ACEP'),
  ],
};

export function playbookForTitle(title) {
  return PLAYBOOKS[title] || DEFAULT;
}

export function toGameCase(ccsCase, catalog) {
  const pb = playbookForTitle(ccsCase.title);
  const pres = catalog?.presentations?.[ccsCase.title];
  const introText = pres?.intro?.replace(/\s+/g, ' ').trim().slice(0, 400) || '';
  return {
    id: ccsCase.id,
    ccsNumber: ccsCase.caseNumber,
    title: ccsCase.title.toUpperCase(),
    category: ccsCase.category,
    chief_complaint: introText || `${ccsCase.title} — CCS Case ${ccsCase.caseNumber}`,
    clinical_tip: pb.clinical_tip,
    objective: pb.objective,
    timeLimit: ccsCase.timeLimit,
    interventions: pb.interventions,
  };
}
