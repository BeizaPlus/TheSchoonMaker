# Game data (JSON) — edit these, not the React code

## `src/data/preparedCases.json` (generated)

**Single prepared source** for vitals, exam, flow, and doctor/patient × easy/standard/hard narratives.

Regenerate after catalog or playbook changes:

```bash
npm run build:cases
```

Each case includes structured `vitals` (parsed from CCS text when available), `exam`, `narrative.doctor|patient`, and metadata. The app loads this file at runtime via `caseNarrative.js` and `caseFlows.js`.

## `src/data/gameConfig.json`

| Key | Purpose |
|-----|---------|
| `patientScene` | `src` (path under `public/`), `objectFit`, `objectPosition` |
| `zones` | Drop target positions (`cx`, `cy`, `w`, `h`, `label`) — fractions 0–1, tuned to `public/patient-scene.png` |
| `zoneColors` | Hex color per zone id |
| `ui` | Hint strings, toast messages |
| `drag` | `overlap` (0–1), `snapBackMs` |
| `layout` | Fixed pixel sizes: list width, sidebar, row heights, `zoneDisplay`: `"always"` \| `"onDrag"` |

## `playbooks.json` — clinical algorithm

Optional per presentation:

```json
"algorithm": {
  "title": "Surviving Sepsis — Hour-1 Bundle",
  "steps": [
    {
      "order": 1,
      "label": "Blood cultures ×2",
      "interventionId": "blood-cultures",
      "zone": "zone-blood",
      "zoneLabel": "Blood draw"
    }
  ]
}
```

If omitted, steps are built automatically from `interventions` array order.

## `src/data/playbooks.json`

| Key | Purpose |
|-----|---------|
| `default` | Fallback when no presentation match |
| `presentations` | Keyed by CCS **presentation title** (e.g. `"Chest Pain"`, `"Sepsis"`) |
| `casePlaybooks` | Override by CCS case id, e.g. `"023": "Sepsis"` |

Each playbook:

```json
{
  "clinical_tip": "...",
  "objective": "...",
  "interventions": [
    {
      "id": "unique-id",
      "label": "Blood Cultures x2",
      "correct_zone": "zone-blood",
      "why": "Teaching text",
      "guideline": "SSC 2021"
    }
  ]
}
```

Zone ids: `zone-monitor`, `zone-iv-bag`, `zone-blood`, `zone-arm`, `zone-icu`

## `src/data/ccsCatalog.json`

Auto-built from Step 3 (`npm run build:catalog`). Case list + categories.

## Example: force Sepsis bundle on case #23

```json
"casePlaybooks": {
  "023": "Sepsis"
}
```

Restart dev server after JSON edits (Vite hot-reloads JSON automatically).
