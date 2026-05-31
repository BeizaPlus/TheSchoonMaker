# Agent handoff — TheSchoonMaker

Medical training game: **181 CCS cases**, drag-and-place clinical orders onto a patient scene. React 19 + Vite 6 + Express.

**Repo:** `git@github.com:BeizaPlus/TheSchoonMaker.git` (SSH as **BeizaPlus** — configured on this machine)

---

## Run the app

```powershell
Set-Location "C:\Users\steve\dev\TheSchoonMaker"
npm run dev
```

- Web: http://localhost:5173 (Vite)
- API: http://localhost:3001 (Express)
- `predev` runs `build:data` + smoke test (20 checks) — must pass before dev starts

If ports are busy, kill old node processes or use the alternate Vite port shown in the terminal.

---

## Data pipeline (case bank)

```
step3/ccs_screenshots/ccs_case_list.json   ← export from live CCS (gitignored)
step3/ccs_presentations/*.txt              ← real intro/vitals/history (8 types in repo)
        ↓  npm run build:catalog
src/data/ccsCatalog.json                   ← 181 cases + categories + presentations
        ↓  npm run build:cases
src/data/preparedCases.json                ← vitals, exam, narratives (what the game plays)
```

**npm scripts:**

| Script | Purpose |
|--------|---------|
| `npm run refresh:case-bank` | Rebuild catalog + prepared cases |
| `npm run capture:case-list` | Export 181 cases from app.ccscases.com (needs `step3/ccs_credentials.json`) |
| `npm run capture:presentations` | Capture more intro/vitals text |
| `npm run build:data` | Same as refresh (used by predev) |

**Current state:**

- **181 cases** in catalog and preparedCases — playable today
- **8 presentation intros** in `step3/ccs_presentations/` (~56 cases share those titles via `hasIntro`)
- Remaining cases use **title + category template vitals** until more presentations are captured
- `ccs_case_list.json` is **gitignored**; build falls back to checked-in catalog if missing (see `scripts/build-ccs-catalog.mjs`)

See `DATA.md` and `step3/CCS_LOCAL_PROXY.md` for full pipeline docs.

---

## Playbooks & order counts

- **`src/data/playbooks.json`** — interventions per presentation title + `default` fallback
- **`src/data/caseSpecificPlaybooks.json`** — overrides by case id
- **`src/data/resolvePlaybook.js`** — `getCaseOrderCount(ccsCase)` is source of truth for stack count (not fixed at 5; supports 3–20+)
- Most of the 89 unique titles still use the **default** playbook unless overridden

---

## UI rules (user cares about these)

1. **Stacks list = vertical column only** — never horizontal wrap/grouping (e.g. no "Office / clinic" parent grouping)
2. **Expanded stack** shows **one order’s** rationale/guideline — not the full sequence inline (full sequence stays in Teach Me)
3. **Command dock** must be **draggable and resizable** (gold grips: right, bottom, corner)
4. **Surface Pro / small screens** — performance matters; avoid huge DOM (SceneGridOverlay uses one surface div, not 1500+ buttons). See `src/lib/deviceProfile.js`, `usePlayDockLayout.js`, compact CSS in `index.css`

Key files: `src/components/Play.jsx`, `src/hooks/usePlayDockLayout.js`, `src/index.css`

---

## Launch gotchas (already fixed — don’t regress)

| Issue | Fix location |
|-------|----------------|
| `predev` failed without external Step 3 folder | `scripts/build-ccs-catalog.mjs` — uses in-repo `step3/`, catalog fallback |
| Node 24 JSON imports | `with { type: 'json' }` on JSON imports in data files |
| Smoke test expected 80% completion | `scripts/smoke-test.mjs` reads `gameConfig.json` threshold (99) |
| Blank welcome screen (TDZ) | `WelcomeScreen.jsx` — declare `panel` state before `useMemo` that uses it |

---

## Git / auth

- Remote: **SSH** `git@github.com:BeizaPlus/TheSchoonMaker.git`
- Push/pull as **BeizaPlus** (SSH key in `~/.ssh/id_ed25519`)
- Commit author in git config may still show personal email — that’s metadata only; repo is under BeizaPlus org
- **Uncommitted local changes** (as of last agent session): case-bank integration in `DATA.md`, `package.json`, `build-ccs-catalog.mjs`, regenerated `ccsCatalog.json` / `preparedCases.json`, `step3/CCS_LOCAL_PROXY.md`

---

## Suggested next work (priority order)

1. **Commit & push** uncommitted case-bank integration if user wants it on GitHub
2. **Capture more case bank depth:** `step3/ccs_credentials.json` → `npm run capture:case-list` → `npm run capture:presentations` → `npm run refresh:case-bank`
3. **Expand playbooks** for high-volume presentation titles still on `default`
4. **Verify on Surface Pro** — vertical stacks, dock resize, perf after changes
5. Optional: longer cases (up to ~20 orders) — add interventions in JSON playbooks; UI already supports variable counts

---

## Key paths

| Path | Role |
|------|------|
| `src/App.jsx` | Routes, welcome / play / browser |
| `src/data/gameData.js` | Merges catalog + preparedCases + playbooks → game case |
| `src/data/useCcsCatalog.js` | Catalog hook |
| `src/components/Play.jsx` | Main play UI + command dock |
| `scripts/smoke-test.mjs` | Pre-dev sanity checks |
| `step3/` | CCS capture toolchain + mirror cache |

---

## Do not

- Change stacks to horizontal layout or nest orders under category headers
- Require `C:\Users\steve\Step 3` external path — use in-repo `step3/`
- Commit `step3/ccs_credentials.json`, `.env`, or browser profiles
- Force-push `main` without explicit user request
