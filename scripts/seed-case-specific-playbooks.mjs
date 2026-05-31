import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'src/data/caseSpecificPlaybooks.json');

const Z = {
  monitor: 'zone-monitor',
  iv: 'zone-iv-bag',
  blood: 'zone-blood',
  arm: 'zone-arm',
  icu: 'zone-icu',
};

function iv(id, label, zone, why, guideline = 'CCS Guide') {
  return { id, label, correct_zone: zone, why, guideline };
}

/** From High-Yield USMLE Step 3 CCS Case Synthesis Guide + 181-case inventory diagnoses. */
const cases = {
  '001': {
    diagnosis: 'Tension Pneumothorax',
    clinical_tip: 'Needle decompression before CXR in the unstable patient — do not delay treatment for imaging.',
    objective: 'Immediate decompression and chest tube; 100% oxygen.',
    interventions: [
      iv('ed', 'Move to Emergency Department', Z.icu, 'Acute respiratory failure requires ED care.', 'ACEP'),
      iv('o2', '100% Oxygen', Z.monitor, 'Maximize oxygenation while preparing decompression.', 'ATLS'),
      iv('monitor', 'Pulse ox + cardiac monitor', Z.monitor, 'Track oxygenation and hemodynamics continuously.', 'ACEP'),
      iv('iv', 'IV access', Z.iv, 'Large-bore access if hypotensive or peri-arrest.', 'ATLS'),
      iv('needle', 'Needle decompression', Z.arm, 'Clinical diagnosis — treat before imaging if unstable.', 'ATLS'),
      iv('chest-tube', 'Tube thoracostomy', Z.icu, 'Definitive management after needle decompression.', 'ATLS'),
      iv('cxr', 'Chest X-ray', Z.monitor, 'Confirm tube placement after stabilization.', 'ACEP'),
    ],
  },
  '002': {
    diagnosis: 'Subdural Hematoma',
    clinical_tip: 'Elderly or alcoholic with AMS after minor trauma — non-contrast CT head first.',
    objective: 'Identify bleed, reverse coagulopathy, neurosurgical evacuation if indicated.',
    interventions: [
      iv('ed', 'Emergency Department', Z.icu, 'Acute neurologic change needs ED evaluation.', 'ACEP'),
      iv('seizure', 'Seizure precautions', Z.monitor, 'Prevent secondary brain injury from seizures.', 'AAN'),
      iv('ct', 'Non-contrast CT head', Z.monitor, 'Crescent-shaped subdural collection.', 'ACEP'),
      iv('coag', 'PT/INR and platelets', Z.blood, 'Identify coagulopathy before neurosurgery.', 'ACEP'),
      iv('cbc', 'CBC', Z.blood, 'Baseline and transfusion planning.', 'ACEP'),
      iv('neuro', 'Neurosurgery consult', Z.icu, 'Evacuation if midline shift or decline.', 'AAN'),
      iv('monitor', 'Neurologic checks + monitor', Z.monitor, 'Detect herniation early.', 'ACEP'),
    ],
  },
  '091': {
    diagnosis: 'Breast Cancer',
    clinical_tip: 'Order the biopsy yourself — do not defer workup to the consultant.',
    objective: 'Diagnostic mammography, ultrasound, and tissue diagnosis.',
    interventions: [
      iv('clinic', 'Clinic / office setting', Z.icu, 'Stable mass evaluation in outpatient setting.', 'NCCN'),
      iv('exam', 'Breast + HEENT exam', Z.arm, 'Document fixed painless mass before imaging.', 'NCCN'),
      iv('mammo', 'Diagnostic mammography', Z.monitor, 'Characterize malignant features.', 'NCCN'),
      iv('us', 'Breast ultrasound', Z.monitor, 'Guide biopsy of solid lesions.', 'NCCN'),
      iv('biopsy', 'Core needle biopsy or FNA', Z.arm, 'Tissue diagnosis is mandatory.', 'NCCN'),
      iv('onc', 'Surgical oncology referral', Z.icu, 'Definitive cancer management pathway.', 'NCCN'),
    ],
  },
  '099': {
    diagnosis: 'Cauda Equina Syndrome',
    clinical_tip: 'Saddle anesthesia + bowel/bladder dysfunction = surgical emergency.',
    objective: 'Urgent MRI and emergent decompression consult.',
    interventions: [
      iv('ed', 'Emergency Department', Z.icu, 'Acute cord compression syndrome.', 'AAN'),
      iv('mri', 'Urgent MRI spine', Z.monitor, 'Confirm compressive lesion level.', 'AAN'),
      iv('neuro', 'Emergency neurosurgery / ortho consult', Z.icu, 'Order with MRI — do not wait for full workup.', 'AAN'),
      iv('bladder', 'Bladder scan / catheter if retention', Z.arm, 'Document urinary retention.', 'AAN'),
      iv('cbc', 'CBC + BMP', Z.blood, 'Pre-op labs and baseline.', 'ACEP'),
      iv('monitor', 'Neurologic checks', Z.monitor, 'Track progressive deficits.', 'AAN'),
    ],
  },
  '111': {
    diagnosis: 'Fat Embolism Syndrome',
    clinical_tip: 'Triad after long-bone fracture: hypoxemia, AMS, petechial rash (axilla/neck).',
    objective: 'ICU support — recognition and stabilization; no specific drug cure.',
    interventions: [
      iv('icu', 'Intensive care unit', Z.icu, 'Respiratory failure and AMS need ICU.', 'ATLS'),
      iv('o2', 'Pulse oximetry + supplemental O₂', Z.monitor, 'Treat hypoxemia aggressively.', 'ACEP'),
      iv('abg', 'Arterial blood gas', Z.blood, 'Document hypoxemia severity.', 'ACEP'),
      iv('cxr', 'Chest X-ray', Z.monitor, 'Bilateral infiltrates support diagnosis.', 'ACEP'),
      iv('fluids', 'IV fluids', Z.iv, 'Supportive hemodynamic care.', 'ATLS'),
      iv('support', 'Respiratory support as needed', Z.monitor, 'Escalate to mechanical ventilation if tiring.', 'ACEP'),
    ],
  },
  '122': {
    diagnosis: 'Stevens-Johnson Syndrome',
    clinical_tip: 'Burn unit or ICU transfer is mandatory — not a ward case.',
    objective: 'Aggressive fluids, pain control, electrolytes, ophthalmology involvement.',
    interventions: [
      iv('burn', 'Burn unit / ICU transfer', Z.icu, 'Major point item — wrong location loses points.', 'AAD'),
      iv('fluids', 'IV fluid resuscitation', Z.iv, 'Large insensible losses from skin slough.', 'SSC'),
      iv('bmp', 'BMP / electrolytes', Z.blood, 'Sodium and potassium management.', 'ACEP'),
      iv('pain', 'IV pain control (morphine)', Z.iv, 'SJS is extremely painful.', 'ACEP'),
      iv('biopsy', 'Skin biopsy', Z.arm, 'Confirm diagnosis when needed.', 'Derm'),
      iv('ophtho', 'Ophthalmology consult', Z.icu, 'Prevent ocular complications.', 'AAD'),
      iv('monitor', 'Infection monitoring', Z.monitor, 'Watch for secondary sepsis.', 'IDSA'),
    ],
  },
  '127': {
    diagnosis: 'Immune Thrombocytopenia (ITP)',
    clinical_tip: 'Stool guaiac and blood cultures are required red items in pediatrics.',
    objective: 'Isolated thrombocytopenia workup; treat if bleeding or very low platelets.',
    interventions: [
      iv('setting', 'Office or ED as acuity dictates', Z.icu, 'Match location to bleeding risk.', 'AAP'),
      iv('cbc', 'CBC', Z.blood, 'Isolated low platelets after viral illness.', 'AAP'),
      iv('smear', 'Peripheral smear', Z.blood, 'Rule out pseudothrombocytopenia and other causes.', 'AAP'),
      iv('culture', 'Blood culture', Z.blood, 'Required red item in rubric.', 'AAP'),
      iv('stool', 'Stool occult blood', Z.blood, 'Screen for GI bleeding.', 'AAP'),
      iv('tx', 'Observation or IVIG / steroids', Z.iv, 'Treat if platelets <20k or active bleeding.', 'AAP'),
    ],
  },
  '133': {
    diagnosis: 'Ankylosing Spondylitis',
    clinical_tip: 'Morning back stiffness improving with activity — image sacroiliac joints, not lumbar spine alone.',
    objective: 'Inflammatory back pain workup and NSAID first-line therapy.',
    interventions: [
      iv('office', 'Office / clinic', Z.icu, 'Chronic inflammatory back pain evaluation.', 'ACR'),
      iv('exam', 'Musculoskeletal + back exam', Z.arm, 'Document inflammatory features.', 'ACR'),
      iv('hlab27', 'HLA-B27', Z.blood, 'Supports spondyloarthropathy diagnosis.', 'ACR'),
      iv('esr', 'ESR and CRP', Z.blood, 'Inflammatory markers.', 'ACR'),
      iv('si', 'X-ray sacroiliac joints', Z.monitor, 'Look for sacroiliitis.', 'ACR'),
      iv('nsaid', 'NSAID (indomethacin / naproxen)', Z.arm, 'First-line symptomatic therapy.', 'ACR'),
    ],
  },
  '135': {
    diagnosis: 'Hypertensive Emergency (ACE-I / NSAID induced)',
    clinical_tip: 'Triple whammy: ACE-I + NSAID + diuretic → acute kidney injury. Check K⁺ and bicarbonate.',
    objective: 'ICU IV antihypertensives with electrolyte monitoring.',
    interventions: [
      iv('icu', 'Intensive care unit', Z.icu, 'Titratable IV antihypertensives.', 'ACC'),
      iv('bmp', 'BMP (Cr, K, bicarbonate)', Z.blood, 'Red-item electrolytes and renal function.', 'ACC'),
      iv('ua', 'Urinalysis', Z.blood, 'Assess renal injury.', 'ACC'),
      iv('ekg', '12-lead EKG', Z.monitor, 'End-organ ischemia screening.', 'ACC'),
      iv('ivbp', 'IV antihypertensive titration', Z.iv, 'Controlled BP reduction in emergency.', 'ACC'),
      iv('hold', 'Hold offending ACE-I / NSAID', Z.arm, 'Remove precipitant of renal failure.', 'ACC'),
    ],
  },
  '138': {
    diagnosis: 'End-Stage Renal Failure',
    clinical_tip: 'Fatigue in ESRF — CXR, EKG, and ABG are red items; do not skip them.',
    objective: 'Evaluate uremia complications and dialytic indications (AEIOU).',
    interventions: [
      iv('ward', 'Admit to ward', Z.icu, 'Chronic renal failure decompensation.', 'KDIGO'),
      iv('io', 'Strict intake / output', Z.monitor, 'Volume status assessment.', 'KDIGO'),
      iv('bmp', 'BMP / BUN / creatinine', Z.blood, 'Hyperkalemia and acidosis.', 'KDIGO'),
      iv('cbc', 'CBC (anemia)', Z.blood, 'Uremic anemia workup.', 'KDIGO'),
      iv('pth', 'PTH, vitamin D, phosphorus', Z.blood, 'Mineral bone disorder panel.', 'KDIGO'),
      iv('abg', 'Arterial blood gas', Z.blood, 'Red item — assess acidosis.', 'KDIGO'),
      iv('cxr', 'Chest X-ray PA and lateral', Z.monitor, 'Fluid overload / uremic lung.', 'KDIGO'),
      iv('ekg', '12-lead EKG', Z.monitor, 'Hyperkalemia and pericarditis.', 'KDIGO'),
      iv('epo', 'Erythropoietin', Z.iv, 'Treat anemia of CKD.', 'KDIGO'),
      iv('binders', 'Phosphate binder + calcium carbonate', Z.arm, 'Mineral bone disease management.', 'KDIGO'),
    ],
  },
  '139': {
    diagnosis: 'Squamous Cell Carcinoma of the Lip',
    clinical_tip: 'HEENT and skin exam before biopsy — sequencing matters for points.',
    objective: 'Biopsy non-healing lip lesion and stage with imaging.',
    interventions: [
      iv('office', 'Office / clinic', Z.icu, 'Stable lip lesion workup.', 'NCCN'),
      iv('heent', 'HEENT exam', Z.arm, 'Document ulcerated/crusting lesion.', 'NCCN'),
      iv('skin', 'Skin exam', Z.arm, 'Complete dermatologic survey.', 'NCCN'),
      iv('biopsy', 'Shave or punch biopsy', Z.arm, 'Tissue diagnosis.', 'NCCN'),
      iv('ct', 'CT head and neck', Z.monitor, 'Local invasion and nodes.', 'NCCN'),
      iv('surg', 'Surgery / Mohs referral', Z.icu, 'Definitive oncologic management.', 'NCCN'),
    ],
  },
  '142': {
    diagnosis: 'Maple Syrup Urine Disease (MSUD)',
    clinical_tip: 'Treat seizures immediately while awaiting amino acid results.',
    objective: 'NICU/PICU metabolic emergency with anticonvulsants and thiamine.',
    interventions: [
      iv('nicu', 'NICU / PICU', Z.icu, 'Neonatal metabolic crisis.', 'AAP'),
      iv('amino', 'Serum amino acids (Leu, Ile, Val)', Z.blood, 'Confirm MSUD pattern.', 'Genetics'),
      iv('seizure', 'Phenobarbital or lorazepam', Z.iv, 'Treat active seizures without delay.', 'AAP'),
      iv('thiamine', 'Thiamine', Z.iv, 'Cofactor support in organic acidemias.', 'Genetics'),
      iv('glucose', 'Monitor glucose', Z.blood, 'Avoid hypoglycemia during crisis.', 'AAP'),
    ],
  },
  '145': {
    diagnosis: 'Trigeminal Postherpetic Neuropathy',
    clinical_tip: 'Standard analgesics fail — gabapentinoid or amitriptyline; fluorescein if V1 eye involved.',
    objective: 'Neuropathic pain control after shingles.',
    interventions: [
      iv('office', 'Office / clinic', Z.icu, 'Outpatient neuropathic pain management.', 'AAN'),
      iv('gaba', 'Gabapentin or pregabalin', Z.arm, 'First-line neuropathic agents.', 'AAN'),
      iv('amit', 'Amitriptyline if needed', Z.arm, 'Adjunct neuropathic therapy.', 'AAN'),
      iv('eye', 'Fluorescein stain if eye involved', Z.monitor, 'V1 distribution corneal protection.', 'Ophtho'),
    ],
  },
  '148': {
    diagnosis: 'Post-MI Pericarditis (Dressler syndrome)',
    clinical_tip: 'Pleuritic pain days–weeks post-MI; pain better leaning forward. Avoid anticoag if large effusion.',
    objective: 'Confirm pericarditis; treat with aspirin/NSAID + colchicine.',
    interventions: [
      iv('ed', 'ED or ward', Z.icu, 'Post-MI inflammatory chest pain.', 'ACC'),
      iv('trop', 'Troponin', Z.blood, 'Assess myocardial injury overlap.', 'ACC'),
      iv('esr', 'ESR', Z.blood, 'Inflammatory marker.', 'ACC'),
      iv('ekg', 'EKG', Z.monitor, 'Diffuse ST elevation pattern.', 'ACC'),
      iv('echo', 'Echocardiogram', Z.monitor, 'Effusion / tamponade risk.', 'ACC'),
      iv('asa', 'High-dose aspirin or NSAID', Z.arm, 'Anti-inflammatory therapy.', 'ACC'),
      iv('colch', 'Colchicine', Z.arm, 'Reduce recurrence.', 'ACC'),
    ],
  },
  '150': {
    diagnosis: 'Multiple Myeloma',
    clinical_tip: 'Order UPEP — UA dipstick misses Bence-Jones protein. Skeletal survey, NOT bone scan.',
    objective: 'CRAB features workup and hematology referral.',
    interventions: [
      iv('setting', 'Office or ward', Z.icu, 'Bone pain, fatigue, weight loss in elderly.', 'NCCN'),
      iv('cbc', 'CBC', Z.blood, 'Anemia and cytopenias.', 'NCCN'),
      iv('calcium', 'BMP with calcium', Z.blood, 'Hypercalcemia screening.', 'NCCN'),
      iv('spep', 'Serum protein electrophoresis', Z.blood, 'Monoclonal protein.', 'NCCN'),
      iv('upep', 'Urine protein electrophoresis (UPEP)', Z.blood, 'Red item — light chains.', 'NCCN'),
      iv('survey', 'Skeletal survey', Z.monitor, 'Osteolytic lesions — not bone scan.', 'NCCN'),
      iv('bis', 'Bisphosphonates', Z.iv, 'Prevent pathologic fractures.', 'NCCN'),
      iv('heme', 'Hematology / oncology referral', Z.icu, 'Definitive treatment planning.', 'NCCN'),
    ],
  },
  '151': {
    diagnosis: 'Carbon Monoxide Poisoning',
    clinical_tip: 'Pulse ox lies — order 100% O₂ before carboxyhemoglobin returns.',
    objective: 'ED oxygenation and CO level confirmation.',
    interventions: [
      iv('ed', 'Emergency Department', Z.icu, 'Found unconscious in enclosed space.', 'ACEP'),
      iv('o2', '100% O₂ non-rebreather', Z.monitor, 'Displace CO from hemoglobin immediately.', 'ACEP'),
      iv('cohb', 'Carboxyhemoglobin level', Z.blood, 'Confirm exposure severity.', 'ACEP'),
      iv('iv', 'IV access', Z.iv, 'Supportive care access.', 'ACEP'),
      iv('monitor', 'Cardiac monitor', Z.monitor, 'Arrhythmia risk with hypoxia.', 'ACEP'),
      iv('neuro', 'Neurologic checks', Z.monitor, 'Track delayed neuro toxicity.', 'ACEP'),
    ],
  },
  '152': {
    diagnosis: 'Carbon Monoxide Poisoning',
    clinical_tip: 'Family with flu-like headaches in winter — think CO; 100% O₂ first.',
    objective: 'Same as Case 151 — high-flow O₂ and CO level.',
    interventions: [
      iv('ed', 'Emergency Department', Z.icu, 'Headache cluster suggests exposure.', 'ACEP'),
      iv('o2', '100% O₂ non-rebreather', Z.monitor, 'Do not wait for lab to start treatment.', 'ACEP'),
      iv('cohb', 'Carboxyhemoglobin level', Z.blood, 'Diagnostic confirmation.', 'ACEP'),
      iv('iv', 'IV access', Z.iv, 'Supportive pathway.', 'ACEP'),
      iv('monitor', 'Cardiac monitor + pulse ox', Z.monitor, 'Note: pulse ox unreliable in CO.', 'ACEP'),
      iv('neuro', 'Neurologic exam serially', Z.monitor, 'Detect delayed encephalopathy.', 'ACEP'),
    ],
  },
  '153': {
    diagnosis: 'Porphyria Cutanea Tarda',
    clinical_tip: 'Sun-exposed blistering hands — screen Hep C and check urine porphyrins.',
    objective: 'Reduce iron load; sun and alcohol counseling.',
    interventions: [
      iv('office', 'Office / clinic', Z.icu, 'Chronic photosensitive blistering.', 'Derm'),
      iv('porph', 'Urine porphyrin screen', Z.blood, 'Confirm porphyria cutanea tarda.', 'Derm'),
      iv('iron', 'Serum ferritin / iron studies', Z.blood, 'Iron overload association.', 'Derm'),
      iv('hcv', 'Hepatitis C screening', Z.blood, 'Strong PCT association.', 'Derm'),
      iv('phleb', 'Phlebotomy or hydroxychloroquine', Z.iv, 'Reduce hepatic iron.', 'Derm'),
      iv('sun', 'Sun protection counseling', Z.arm, 'Prevent blistering flares.', 'Derm'),
      iv('etoh', 'Alcohol cessation counseling', Z.arm, 'Common precipitant.', 'Derm'),
    ],
  },
  '154': {
    diagnosis: 'Trichomoniasis',
    clinical_tip: 'One STD diagnosed — screen all others and treat the partner.',
    objective: 'Metronidazole plus full STI panel.',
    interventions: [
      iv('clinic', 'Clinic', Z.icu, 'Outpatient GU complaint.', 'CDC'),
      iv('wet', 'Wet mount', Z.blood, 'Motile trichomonads / strawberry cervix.', 'CDC'),
      iv('ph', 'Vaginal pH', Z.blood, 'Elevated pH supports trichomoniasis.', 'CDC'),
      iv('sti', 'HIV, RPR, chlamydia/gonorrhea NAAT', Z.blood, 'Co-infection screening mandatory.', 'CDC'),
      iv('metro', 'Oral metronidazole', Z.arm, 'First-line therapy.', 'CDC'),
      iv('partner', 'Treat sexual partner', Z.arm, 'Prevent reinfection — separate order.', 'CDC'),
    ],
  },
  '157': {
    diagnosis: 'Diabetes Mellitus Type II',
    clinical_tip: 'At diagnosis order eye referral and foot exam — automatic CCS points.',
    objective: 'Confirm hyperglycemia and start metformin with screening bundle.',
    interventions: [
      iv('office', 'Office / clinic', Z.icu, 'New polyuria/polydipsia workup.', 'ADA'),
      iv('glucose', 'Fasting plasma glucose', Z.blood, 'Diagnostic threshold.', 'ADA'),
      iv('a1c', 'HbA1c', Z.blood, 'Chronic glycemic control baseline.', 'ADA'),
      iv('ua', 'Urinalysis glucose/ketones', Z.blood, 'Assess ketosis risk.', 'ADA'),
      iv('lipids', 'Lipid panel', Z.blood, 'Cardiovascular risk management.', 'ADA'),
      iv('micro', 'Microalbumin/creatinine ratio', Z.blood, 'Nephropathy screening.', 'ADA'),
      iv('metformin', 'Start metformin', Z.arm, 'First-line unless contraindicated.', 'ADA'),
      iv('eye', 'Ophthalmology referral', Z.icu, 'Retinopathy screening at diagnosis.', 'ADA'),
      iv('foot', 'Diabetic foot exam', Z.arm, 'Neuropathy and ulcer screening.', 'ADA'),
    ],
  },
  '163': {
    diagnosis: 'Acute Otitis Media',
    clinical_tip: 'Office or home — placing simple AOM in the ED loses points.',
    objective: 'Pneumatic otoscopy diagnosis and amoxicillin.',
    interventions: [
      iv('office', 'Office or home (not ED)', Z.icu, 'Stable pediatric ear pain — wrong location deducts points.', 'AAP'),
      iv('otoscopy', 'Pneumatic otoscopy', Z.monitor, 'Confirm middle ear effusion.', 'AAP'),
      iv('amox', 'Oral amoxicillin', Z.arm, 'First-line antibacterial therapy.', 'AAP'),
    ],
  },
  '166': {
    diagnosis: 'Hemophilia A',
    clinical_tip: 'Avoid NSAIDs and IM injections — replace factor VIII.',
    objective: 'Stop bleeding with factor replacement after confirming deficiency.',
    interventions: [
      iv('ed', 'ED or ward', Z.icu, 'Oral bleeding or hemarthrosis in male child.', 'ASH'),
      iv('cbc', 'CBC', Z.blood, 'Baseline counts.', 'ASH'),
      iv('ptt', 'PTT', Z.blood, 'Prolonged in hemophilia.', 'ASH'),
      iv('factor', 'Factor VIII assay', Z.blood, 'Confirm hemophilia A.', 'ASH'),
      iv('replace', 'Factor VIII replacement', Z.iv, 'Definitive hemostatic therapy.', 'ASH'),
      iv('avoid', 'Avoid NSAIDs / IM injections', Z.arm, 'Prevent worsening bleeding.', 'ASH'),
    ],
  },
  '167': {
    diagnosis: 'Diabetic Gastroparesis',
    clinical_tip: 'Gastric emptying study is gold standard; EGD if acute obstruction concern.',
    objective: 'Prokinetic therapy after confirming delayed emptying.',
    interventions: [
      iv('ward', 'Ward if dehydrated', Z.icu, 'Chronic diabetic nausea/vomiting.', 'ADA'),
      iv('bmp', 'BMP / electrolytes', Z.blood, 'Correct dehydration and electrolytes.', 'ADA'),
      iv('ges', 'Gastric emptying study', Z.monitor, 'Gold standard diagnostic test.', 'ADA'),
      iv('prok', 'Metoclopramide or erythromycin', Z.iv, 'Enhance gastric motility.', 'ADA'),
      iv('egd', 'EGD if obstruction suspected', Z.monitor, 'Rule out mechanical blockage.', 'ADA'),
    ],
  },
  '169': {
    diagnosis: 'Hypercalcemia Secondary to Malignancy',
    clinical_tip: 'Aggressive NS hydration before bisphosphonate; no loop diuretics until replete.',
    objective: 'Volume resuscitation then zoledronic acid in ED.',
    interventions: [
      iv('ed', 'Emergency Department', Z.icu, 'Somnolence and confusion from hypercalcemia.', 'Endocrine'),
      iv('iv', 'Continuous IV access', Z.iv, 'High-volume hydration pathway.', 'Endocrine'),
      iv('calcium', 'Ionized calcium, PTH, PTHrp', Z.blood, 'Confirm malignancy-mediated mechanism.', 'Endocrine'),
      iv('bmp', 'BMP', Z.blood, 'Renal function and electrolytes.', 'Endocrine'),
      iv('cxr', 'Chest X-ray', Z.monitor, 'Screen for lung malignancy.', 'Endocrine'),
      iv('ns', 'Normal saline IV hydration', Z.iv, 'First-line — volume repletion.', 'Endocrine'),
      iv('bis', 'IV zoledronic acid', Z.iv, 'Definitive calcium lowering after hydration.', 'Endocrine'),
    ],
  },
  '170': {
    diagnosis: 'Orthostatic Hypotension',
    clinical_tip: 'Start in office/home — unnecessary ED transfer loses points unless unstable.',
    objective: 'Orthostatic vitals and review offending antihypertensives/diuretics.',
    interventions: [
      iv('office', 'Office or home (not ED)', Z.icu, 'Stable lightheadedness on standing — location trap.', 'ACC'),
      iv('ortho', 'Orthostatic vital signs', Z.monitor, 'Diagnostic cornerstone.', 'ACC'),
      iv('ekg', 'EKG', Z.monitor, 'Arrhythmia and ischemia screen.', 'ACC'),
      iv('labs', 'BMP and CBC', Z.blood, 'Anemia, dehydration, electrolytes.', 'ACC'),
      iv('fluids', 'IV fluid bolus if acutely symptomatic', Z.iv, 'Volume repletion when needed.', 'ACC'),
      iv('meds', 'Stop offending diuretics / antihypertensives', Z.arm, 'Remove precipitating agents.', 'ACC'),
    ],
  },
};

const out = {
  version: 1,
  builtAt: new Date().toISOString(),
  source:
    'High-Yield USMLE Step 3 CCS Case Synthesis Guide + 181-Case Inventory (diagnosis list)',
  totalAuthored: Object.keys(cases).length,
  cases,
};

fs.writeFileSync(OUT, JSON.stringify(out, null, 2), 'utf8');
console.log(`Wrote ${out.totalAuthored} case-specific playbooks → ${OUT}`);
