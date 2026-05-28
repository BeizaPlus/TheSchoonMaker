# Public Nutrition Intelligence Features (Draft)

## Goal
Build a public-facing experience (including kids/laypeople) where users can scan food, see likely health outcomes, and understand *why* choices matter in plain language.

## Proposed Feature Set

### 1) Food Scanner
- **Input modes**
  - Camera label/photo scan
  - Barcode lookup
  - Manual search ("apple", "chips", "cola")
- **Normalization**
  - Convert item into a standard nutrition object:
    - calories, protein, carbs, fats, fiber, sodium, sugar
    - additives/preservatives if available
- **3 main food classes (initial model)**
  - `Protective` (whole/minimally processed, nutrient-dense)
  - `Neutral/Mixed` (moderate processing, context-dependent)
  - `Risk-heavy` (ultra-processed/high sugar-salt-fat pattern)

### 2) Outcomes Sheet (per food choice)
- Show short-term + long-term likely impact:
  - energy, satiety, glycemic response
  - cardiometabolic risk trend
  - liver/kidney/cardiovascular burden indicators
- Display confidence/uncertainty and evidence source level.

### 3) Understanding Slider (audience level)
- Global slider: **Kid Mode <-> Layperson <-> Advanced**
- Content adaptation:
  - vocabulary complexity
  - sentence length
  - depth of mechanism
  - chart complexity
- Example:
  - Kid: "This food gives quick sugar spikes; your body crashes sooner."
  - Advanced: "High glycemic load may worsen insulin variability and appetite rebound."

### 4) Organ Affinity Insights
- Map food patterns to organ systems:
  - heart, liver, kidneys, pancreas, gut, brain
- Explain "why this organ is affected" with transparent rules/evidence.

### 5) Life Expectancy / Insurance Context (Phase 2)
- If age + profile data is provided, estimate directional impact:
  - risk trend buckets (lower/similar/higher)
  - population-based life expectancy deltas (not medical diagnosis)
- Insurance-related data should be handled as:
  - public actuarial trend overlays
  - no underwriting claims
  - explicit disclaimers and model limits

## Data Strategy (Recommended)

### Core data
- USDA FoodData Central (nutrient baseline)
- OpenFoodFacts (barcode + packaging metadata)
- Curated guideline overlays:
  - AHA, ADA, WHO, CDC, NIH where relevant

### Risk/Outcome models
- Start rule-based (transparent) before ML:
  - sodium/sugar/sat fat/fiber thresholds
  - processing score
  - food pattern scoring (Mediterranean-like vs ultra-processed-heavy)
- Add model calibration later with published cohorts.

### Insurance / longevity overlays
- Use public, aggregate datasets only at first.
- Keep outputs educational and directional.

## UX Flow (MVP)
1. User scans/selects a food.
2. System classifies into 1 of 3 food classes.
3. Show Outcomes Sheet.
4. User adjusts Understanding Slider.
5. Explanations re-render to chosen literacy level.
6. Optional compare feature: "swap this with a better alternative".

## Safety + Compliance
- Not medical advice banner.
- Explain uncertainty and data coverage gaps.
- No diagnosis, no treatment claims.
- Strong age-appropriate language filters for kid mode.

## Pilot Scope (First release)
- 50-100 common foods
- 5 organ systems
- 3 literacy levels
- 1 compare/swap recommendation per scan

## Open Questions to Decide
1. Confirm your exact **3 food classes** naming.
2. Do we want **camera OCR** in MVP or barcode/search first?
3. Should kid mode include icon/emoji visual cues?
4. Do we store personal history locally only, or account-based?
5. For insurance/life expectancy, do you want age-only in v1, or age + sex + smoking + activity?

## Suggested Next Step
Lock MVP schema:
- Food entity schema
- Outcomes sheet schema
- Slider text transformation rules
- First 3 demo scenarios for stakeholder review

