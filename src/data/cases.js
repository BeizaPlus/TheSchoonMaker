export const CASES = [
{
  id:"001",title:"SEPSIS",
  chief_complaint:"68M with fever, hypotension, altered mental status",
  clinical_tip:"Sepsis kills fastest when you hesitate on fluids.",
  objective:"Identify source. Treat within the first hour.",
  interventions:[
    {id:"blood-cultures",label:"Blood Cultures x2",correct_zone:"zone-blood",
     why:"Two sets from different sites before antibiotics. Improves sensitivity to 80–90%. SSC 2021 mandates cultures before first antibiotic dose.",guideline:"Surviving Sepsis Campaign 2021"},
    {id:"iv-fluids",label:"30 mL/kg Crystalloid",correct_zone:"zone-iv-bag",
     why:"Initial resuscitation target in hypotensive sepsis. Give within 3 hours of recognition. Reassess after each bolus.",guideline:"SSC 2021 — Strong Recommendation"},
    {id:"antibiotics",label:"Vanc + Pip-Tazo",correct_zone:"zone-arm",
     why:"Broad-spectrum coverage within 1 hour of sepsis recognition. Vancomycin covers MRSA. Pip-Tazo covers gram-negatives including Pseudomonas.",guideline:"SSC 2021 — Strong Recommendation"},
    {id:"lactate",label:"Lactate Level",correct_zone:"zone-blood",
     why:"Lactate ≥2 mmol/L indicates tissue hypoperfusion even with normal BP. Guides resuscitation depth and predicts mortality.",guideline:"SSC 2021 — Best Practice Statement"},
    {id:"icu-admit",label:"ICU Admission",correct_zone:"zone-icu",
     why:"Septic shock requires ICU-level monitoring for vasopressor titration, airway management, and hour-by-hour reassessment.",guideline:"ACEP / SCCM"}
  ]
},
{
  id:"002",title:"DKA",
  chief_complaint:"32F with type 1 DM, nausea, vomiting, fruity breath, BS 480",
  clinical_tip:"In DKA, fix the fluid first — insulin chases the potassium.",
  objective:"Correct acidosis and prevent cerebral edema.",
  interventions:[
    {id:"iv-fluids-dka",label:"NS 1L Bolus",correct_zone:"zone-iv-bag",
     why:"Aggressive fluid resuscitation corrects the volume deficit that drives hyperosmolality. Start with 1L NS over 1 hour.",guideline:"ADA Standards of Care 2024"},
    {id:"insulin-dka",label:"Regular Insulin gtt",correct_zone:"zone-arm",
     why:"0.1 U/kg/hr infusion corrects anion gap without causing precipitous glucose drop. Do NOT bolus — increases cerebral edema risk.",guideline:"ADA 2024 — Standard"},
    {id:"potassium-dka",label:"KCl Repletion",correct_zone:"zone-arm",
     why:"Insulin drives K+ intracellularly — must replète if K+ <3.5. Hold insulin if K+ <3.3 until corrected.",guideline:"ADA 2024"},
    {id:"glucose-check",label:"BMP / Glucose q1h",correct_zone:"zone-blood",
     why:"Titrate insulin to anion gap closure, NOT to glucose. Check electrolytes hourly until resolving.",guideline:"ADA 2024"},
    {id:"icu-dka",label:"Step-Down / ICU",correct_zone:"zone-icu",
     why:"Moderate-severe DKA requires continuous monitoring for mental status change, K+ dysrhythmias, and cerebral edema.",guideline:"ADA / ACEP"}
  ]
},
{
  id:"003",title:"STEMI",
  chief_complaint:"55M with crushing chest pain, diaphoresis, ST elevation in II, III, aVF",
  clinical_tip:"Door-to-balloon time is your only clock. Every minute costs 1000 myocytes.",
  objective:"Reperfuse within 90 minutes of door arrival.",
  interventions:[
    {id:"aspirin-stemi",label:"Aspirin 324mg Chew",correct_zone:"zone-arm",
     why:"Antiplatelet effect reduces infarct size and mortality. Chewed for rapid buccal absorption. Give immediately unless true allergy.",guideline:"ACC/AHA STEMI Guidelines 2022"},
    {id:"heparin-stemi",label:"Heparin IV Bolus",correct_zone:"zone-iv-bag",
     why:"Unfractionated heparin prevents thrombus propagation and maintains catheter patency. Weight-based bolus before cath lab.",guideline:"ACC/AHA 2022"},
    {id:"ecg-monitor",label:"12-Lead ECG + Monitor",correct_zone:"zone-monitor",
     why:"Serial ECGs detect evolving changes, re-occlusion post-PCI, and new blocks. Continuous monitoring for VF/VT.",guideline:"ACC/AHA 2022"},
    {id:"cath-lab",label:"Activate Cath Lab",correct_zone:"zone-icu",
     why:"Primary PCI is superior to thrombolytics when door-to-balloon time can be achieved within 90 min. Activate immediately on ECG interpretation.",guideline:"ACC/AHA 2022 — Class I"},
    {id:"troponin-stemi",label:"Troponin + CBC/BMP",correct_zone:"zone-blood",
     why:"Baseline troponin establishes peak, CBC/BMP identifies contraindications to anticoagulation and baseline renal function for contrast.",guideline:"ACC/AHA 2022"}
  ]
},
{
  id:"004",title:"PULMONARY EMBOLISM",
  chief_complaint:"44F post-op day 3, sudden dyspnea, tachycardia, O2 sat 88% on room air",
  clinical_tip:"Wells score first — but don't let a low score stop your clinical gestalt.",
  objective:"Risk-stratify and anticoagulate immediately if high probability.",
  interventions:[
    {id:"heparin-pe",label:"Heparin IV gtt",correct_zone:"zone-iv-bag",
     why:"Anticoagulation prevents clot propagation. Weight-based bolus + infusion. Start before CT if high clinical probability.",guideline:"ASH PE Guidelines 2020"},
    {id:"cta-pe",label:"CT Pulm Angiography",correct_zone:"zone-monitor",
     why:"Gold standard for PE diagnosis. Sensitivity >90%. Assess for right heart strain as marker of massive PE.",guideline:"ASH 2020 / AHA"},
    {id:"echo-pe",label:"Bedside Echo",correct_zone:"zone-monitor",
     why:"RV dilation/hypokinesis indicates massive PE requiring escalation. Identifies alternative diagnoses (tamponade, pneumothorax).",guideline:"AHA PE Guidelines 2019"},
    {id:"troponin-pe",label:"Troponin + BNP",correct_zone:"zone-blood",
     why:"Elevated troponin/BNP flags submassive PE with RV strain — risk-stratifies for ICU vs floor and potential catheter-directed therapy.",guideline:"AHA 2019"},
    {id:"icu-pe",label:"ICU vs Cath Lab",correct_zone:"zone-icu",
     why:"Massive PE with hemodynamic instability: systemic thrombolytics or catheter-directed therapy. Submassive: anticoagulate + monitor.",guideline:"AHA 2019 — Massive PE"}
  ]
},
{
  id:"005",title:"ACUTE STROKE",
  chief_complaint:"67M with sudden right-sided weakness and aphasia onset 45 min ago",
  clinical_tip:"Treat a stroke like a STEMI — time is brain, 1.9M neurons/minute.",
  objective:"tPA decision within 60 min of door arrival. Endovascular if eligible.",
  interventions:[
    {id:"ct-stroke",label:"Non-contrast CT Head",correct_zone:"zone-monitor",
     why:"Rules out hemorrhagic transformation before tPA. Also identifies ASPECTS score for endovascular candidacy.",guideline:"AHA/ASA Stroke Guidelines 2019"},
    {id:"tpa-stroke",label:"IV tPA (Alteplase)",correct_zone:"zone-iv-bag",
     why:"0.9 mg/kg IV within 4.5 hours of onset (10% bolus, remainder over 60 min). Improves functional outcomes NNT ~8.",guideline:"AHA/ASA 2019 — Class I"},
    {id:"bp-stroke",label:"BP Management",correct_zone:"zone-arm",
     why:"Target BP <185/110 before tPA. After tPA, maintain <180/105 for 24h. Permissive hypertension if no tPA given.",guideline:"AHA/ASA 2019"},
    {id:"labs-stroke",label:"Stat Labs + Glucose",correct_zone:"zone-blood",
     why:"Hypoglycemia mimics stroke. PT/INR rules out anticoagulation as contraindication to tPA. CBC for platelets.",guideline:"AHA/ASA 2019"},
    {id:"neuro-icu",label:"Stroke Unit / Neuro ICU",correct_zone:"zone-icu",
     why:"Continuous neuro assessment, BP titration, swallow evaluation, DVT prophylaxis. Reduces 90-day mortality and dependency.",guideline:"AHA/ASA 2019 — Class I"}
  ]
},
{
  id:"006",title:"ANAPHYLAXIS",
  chief_complaint:"28F with bee sting, diffuse urticaria, throat tightness, BP 78/50",
  clinical_tip:"Epinephrine first — antihistamines are adjuncts, never primary therapy.",
  objective:"Epi IM within 60 seconds. Airway secured within 3 minutes.",
  interventions:[
    {id:"epi-ana",label:"Epi 0.3mg IM Thigh",correct_zone:"zone-arm",
     why:"IM epinephrine in lateral thigh (not deltoid) gives fastest absorption. Repeat every 5–15 min if no response. Never delay for antihistamines.",guideline:"WAO Anaphylaxis Guidelines 2020"},
    {id:"fluids-ana",label:"IV Fluid Bolus 1L",correct_zone:"zone-iv-bag",
     why:"Distributive shock — rapid volume expansion. 1–2L crystalloid for persistent hypotension after epinephrine.",guideline:"WAO 2020"},
    {id:"airway-ana",label:"Airway / RSI Prep",correct_zone:"zone-monitor",
     why:"Angioedema can close the airway within minutes. Prepare for early intubation if laryngeal edema — waiting makes it impossible.",guideline:"WAO 2020 / EM Airway Management"},
    {id:"diphen-ana",label:"Diphenhydramine IV",correct_zone:"zone-arm",
     why:"H1 blocker as adjunct therapy. Does NOT replace epinephrine. Addresses urticaria/pruritus but has no role in hypotension or airway.",guideline:"WAO 2020 — Adjunct"},
    {id:"obs-ana",label:"Observation 4–6 hr",correct_zone:"zone-icu",
     why:"Biphasic anaphylaxis occurs in 4–23% of cases up to 72 hours post-exposure. All anaphylaxis requires extended observation.",guideline:"WAO 2020 — All Severity"}
  ]
},
{
  id:"007",title:"HYPERTENSIVE EMERGENCY",
  chief_complaint:"52M BP 228/142, headache, blurred vision, papilledema",
  clinical_tip:"Lower MAP by 25% in first hour — faster reduction causes stroke.",
  objective:"Prevent end-organ damage. Controlled MAP reduction.",
  interventions:[
    {id:"nicardipine",label:"Nicardipine IV gtt",correct_zone:"zone-iv-bag",
     why:"Titratable IV calcium channel blocker. Ideal for most hypertensive emergencies. Start 5 mg/hr, titrate to BP goal.",guideline:"AHA Hypertension Guidelines 2023"},
    {id:"bp-monitor",label:"Arterial Line / IBP",correct_zone:"zone-arm",
     why:"Continuous BP monitoring required during IV antihypertensive titration. Prevents overshoot. Placed in radial artery.",guideline:"AHA 2023"},
    {id:"ct-head-htn",label:"CT Head / MRI Brain",correct_zone:"zone-monitor",
     why:"Rule out hemorrhagic stroke or PRES. Imaging guides choice of agent (avoid vasodilators if hemorrhagic stroke suspected).",guideline:"AHA 2023"},
    {id:"echo-htn",label:"BMP / UA / Troponin",correct_zone:"zone-blood",
     why:"Identifies end-organ damage: creatinine (renal crisis), troponin (ACS), urinalysis (hematuria in glomerulonephritis).",guideline:"AHA 2023"},
    {id:"icu-htn",label:"ICU Admission",correct_zone:"zone-icu",
     why:"Hypertensive emergency requires ICU-level monitoring for titratable antihypertensives and end-organ reassessment.",guideline:"AHA 2023"}
  ]
},
{
  id:"008",title:"ACUTE APPENDICITIS",
  chief_complaint:"19M with periumbilical pain migrating to RLQ, fever 38.4°C, nausea",
  clinical_tip:"CT confirms, but your Alvarado score should already tell you the answer.",
  objective:"Timely surgical consult. Avoid perforation.",
  interventions:[
    {id:"ct-appy",label:"CT Abdomen/Pelvis",correct_zone:"zone-monitor",
     why:"CT with contrast has 94–98% sensitivity for appendicitis. Confirms diagnosis and identifies complications (perforation, abscess, phlegmon).",guideline:"ACR Appropriateness Criteria 2022"},
    {id:"iv-abx-appy",label:"Cefoxitin IV",correct_zone:"zone-iv-bag",
     why:"Pre-operative antibiotics reduce surgical site infection. Cefoxitin covers bowel flora including anaerobes. Give within 1 hr of incision.",guideline:"IDSA Surgical Prophylaxis 2023"},
    {id:"iv-access",label:"IV Access + NPO",correct_zone:"zone-arm",
     why:"Large-bore IV access for fluids and pre-op. NPO status established for emergent OR case. Rehydrate for operative optimization.",guideline:"Surgical Prep Standard"},
    {id:"cbc-appy",label:"CBC / CRP / BMP",correct_zone:"zone-blood",
     why:"WBC elevation supports diagnosis; CRP >75 mg/L at 24h suggests perforation. BMP for pre-op metabolic baseline.",guideline:"ACR / ACS"},
    {id:"surgery-appy",label:"Surgery Consult / OR",correct_zone:"zone-icu",
     why:"Laparoscopic appendectomy is standard of care. Early surgery prevents perforation. Non-operative management only for select uncomplicated cases.",guideline:"EAST Guidelines 2022"}
  ]
},
{
  id:"009",title:"ECTOPIC PREGNANCY",
  chief_complaint:"26F 7 weeks LMP, sharp pelvic pain, vaginal spotting, BP 88/60",
  clinical_tip:"Unstable + positive HCG + pelvic pain = ectopic until proven otherwise.",
  objective:"Rule out rupture. Surgical vs medical management decision.",
  interventions:[
    {id:"utz-ectopic",label:"Bedside Pelvic US",correct_zone:"zone-monitor",
     why:"Identifies intrauterine vs extrauterine pregnancy and free fluid in Pouch of Douglas (hemoperitoneum). Adnexal mass with empty uterus = ectopic.",guideline:"ACOG Practice Bulletin 193"},
    {id:"iv-ectopic",label:"2 Large-Bore IVs",correct_zone:"zone-iv-bag",
     why:"Two large-bore IVs (16g+) for rapid transfusion if rupture. Volume resuscitation for hemodynamic instability.",guideline:"Trauma Resuscitation / ACOG"},
    {id:"type-screen",label:"Type & Crossmatch",correct_zone:"zone-blood",
     why:"Type and screen for potential OR. Rh-negative patients need RhoGAM. Quantitative HCG guides methotrexate eligibility.",guideline:"ACOG 193"},
    {id:"ob-consult",label:"OB/GYN Stat Consult",correct_zone:"zone-arm",
     why:"Ruptured ectopic is a surgical emergency with hemorrhagic shock mortality. Unstable patient goes straight to OR — no methotrexate.",guideline:"ACOG 193 — Ruptured"},
    {id:"or-ectopic",label:"OR / Surgical Prep",correct_zone:"zone-icu",
     why:"Laparoscopic salpingostomy or salpingectomy is definitive treatment. Unstable patient: open surgery. Methotrexate only for stable, unruptured, criteria-meeting cases.",guideline:"ACOG 193"}
  ]
},
{
  id:"010",title:"BACTERIAL MENINGITIS",
  chief_complaint:"21M college student, fever 39.8°C, nuchal rigidity, photophobia, petechiae",
  clinical_tip:"Petechiae + fever = meningococcemia until proven otherwise. Antibiotics NOW.",
  objective:"Antibiotics within 30 minutes. LP only if no signs of herniation.",
  interventions:[
    {id:"abx-mening",label:"Ceftriaxone 2g IV",correct_zone:"zone-iv-bag",
     why:"Empiric ceftriaxone covers N. meningitidis, S. pneumoniae, and Listeria (add Ampicillin >50yo). Give IMMEDIATELY — do NOT delay for LP.",guideline:"IDSA Meningitis Guidelines 2004 (updated 2017)"},
    {id:"dexa-mening",label:"Dexamethasone IV",correct_zone:"zone-arm",
     why:"0.15 mg/kg q6h × 4 days, starting before or with first antibiotic dose. Reduces hearing loss and mortality in pneumococcal meningitis.",guideline:"IDSA 2004/2017 — Class I"},
    {id:"lp-mening",label:"LP (after CT if indicated)",correct_zone:"zone-blood",
     why:"CSF analysis confirms diagnosis and identifies organism for targeted therapy. CT first only if papilledema, focal neuro deficit, or seizure.",guideline:"IDSA 2004/2017"},
    {id:"ct-mening",label:"CT Head",correct_zone:"zone-monitor",
     why:"Rules out mass lesion/herniation before LP in select patients. Never delay antibiotics for CT.",guideline:"IDSA 2004/2017"},
    {id:"icu-mening",label:"ICU + Isolation",correct_zone:"zone-icu",
     why:"Bacterial meningitis carries 20–30% mortality. ICU for ICP monitoring, seizure management. Droplet isolation until 24h of appropriate antibiotics.",guideline:"IDSA / CDC"}
  ]
}
];
