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

## Case bank (Step 3 / CCS)

The **181-case bank** lives in `step3/` and feeds the game via build scripts.

| Path | Purpose |
|------|---------|
| `step3/ccs_screenshots/ccs_case_list.json` | Full case list export (gitignored — run capture locally) |
| `step3/ccs_presentations/*.txt` | Real intro / vitals / history text per presentation |
| `step3/ccs_mirror/` | Cached CCS web API responses for offline proxy |
| `src/data/ccsCatalog.json` | Built catalog consumed by the app |
| `src/data/preparedCases.json` | Vitals + narratives derived from catalog |

### Refresh the game from Step 3

```bash
# After exporting a fresh case list (needs step3/ccs_credentials.json):
npm run capture:case-list
npm run capture:presentations   # optional — more intro/vitals text

# Rebuild game JSON (works without export — merges step3 presentations into existing catalog):
npm run refresh:case-bank
```

`npm run dev` runs `build:data` automatically. If `ccs_case_list.json` is missing, the catalog builder keeps the checked-in 181 cases and still merges any new `step3/ccs_presentations/*.txt` files.

### Step 3 proxy (optional)

See `step3/CCS_LOCAL_PROXY.md` — record CCS API traffic, serve at `http://localhost:8765`.

## `src/data/ccsCatalog.json`

Auto-built from Step 3 (`npm run build:catalog`). Case list + categories + presentation intros.

## Example: force Sepsis bundle on case #23

```json
"casePlaybooks": {
  "023": "Sepsis"
}
```

Restart dev server after JSON edits (Vite hot-reloads JSON automatically).
