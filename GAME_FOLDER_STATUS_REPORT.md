# TheSchoonMaker — Game Folder Status Report

**Generated:** 2026-06-02  
**Path:** `C:\Users\steve\ER doc\game\`  
**Repo:** Git lives in `game/` — `C:\Users\steve\ER doc` itself is **not** a git repo.

---

## 1. Game folder tree

**Total files:** ~6,808 (includes `node_modules` with ~6,290 files)

### Top-level structure (excluding `node_modules` and `.git`)

```
C:\Users\steve\ER doc\game\
├── .case-tts-cache/
├── .magic-links/
├── .scene-cache/
├── captures/
├── dist/                    (built app — welcome.png, index.html, assets/)
├── public/                  (welcome.png, welcome-light.png, patient-scene.png, assets/)
├── scripts/                 (build-ccs-catalog, build-prepared-cases, smoke-test, etc.)
├── server/                  (index.js, caseTtsCache.js, userCaseStore.js)
├── src/
│   ├── components/          (WelcomeScreen.jsx, Home.jsx, Play.jsx, Briefing.jsx, +30 more)
│   ├── data/                (preparedCases.json, ccsCatalog.json, playbooks.json, etc.)
│   ├── hooks/
│   ├── lib/
│   ├── App.jsx
│   ├── index.css
│   ├── main.jsx
│   └── ui-overrides.css     ← UNTRACKED (local UI work)
├── step3/                   (CCS capture tools, presentations, ccs_mirror/)
├── test-results/
├── tools/chatterbox/         (read_case_tts.py)
├── user-data/cases/
├── welcome.png, welcome-light.png, welcome-plate.png
├── index.html, studio.html, vite.config.js
└── package.json
```

### Top-level folder file counts

| Folder | Files |
|--------|-------|
| `node_modules/` | 6,290 |
| `src/` | 101 |
| `step3/` | 77 |
| `dist/` | 21 |
| `public/` | 17 |
| `scripts/` | 9 |
| `server/` | 3 |
| `tools/` | 3 |
| `user-data/` | 3 |

---

## 2. Git log (last 20 commits)

```
219390f gitignore python cache under tools/chatterbox          ← HEAD / origin/main
b716e57 fix standalone Read aloud — correct tools path, ship script, browser voice fallback
0b1b703 v11 — review checkmarks, reviewed state, progress counter
c5d188e Integrate step3 case bank into build pipeline and refresh game data
8a971ab Add AGENTS.md handoff summary for cross-machine development
8d3cdd1 Add Step 3 CCS capture tools to the repo and wire catalog build to local step3 path
7913b2b Fix vertical stack list and restore resizable command dock
9b36205 Use per-case order counts instead of assuming five stacks
ba3294b Improve mobile command dock: resizable panels, text wrap, adaptive perf
99cb66e Stable release: fix launch blockers, session features, and tablet perf
f3f3271 Initial commit: Schoonmaker medical training game with 181 prepared CCS cases
```

---

## 3. Git status (snapshot at report time)

**Branch:** `main` @ `219390f` — up to date with `origin/main`

### Modified — 22 files (not committed)

| Area | Files |
|------|-------|
| **App shell** | `src/App.jsx`, `src/main.jsx` |
| **Play / Welcome** | `src/components/Play.jsx`, `src/components/WelcomeScreen.jsx`, `src/components/Complete.jsx` |
| **Data** | `preparedCases.json` (+16,923 lines), `playbooks.json`, `caseFlows.js`, `ccsCatalog.json`, `gameConfig.json`, `gameData.js`, `resolvePlaybook.js` |
| **Audio / layout** | `src/lib/audio.js` (+468 lines), `playDockLayout.js`, `usePlayDockLayout.js`, `audienceProfile.js`, `caseNarrative.js`, `casePresentation.js`, `storageKeys.js` |
| **Build** | `package.json`, `scripts/build-prepared-cases.mjs`, `scripts/smoke-test.mjs` |

### Untracked — 27 items (new local work)

| Area | Files |
|------|-------|
| **New UI components** | `AudioSettingsPanel.jsx`, `AudioVolumeControl.jsx`, `CaseContextPanel.jsx`, `CasePresentationPanel.jsx`, `CaseTeachingVideoOverlay.jsx`, `ClinicalFontControls.jsx`, `ClinicalTextControls.jsx`, `GlobalUiSettingsPanel.jsx`, `IcuMonitorStrip.jsx`, `TeachMeSceneOverlay.jsx` |
| **New lib modules** | `audioPrefs.js`, `briefingUiLayout.js`, `caseBriefing.js`, `caseExam.js`, `caseTeachingVideo.js`, `clinicalTextFormat.js`, `clinicalTextPrefs.js`, `examPrep.js`, `narrativeRefine.js`, `patientLife.js`, `uiPrefs.js` |
| **CSS override** | `src/ui-overrides.css` |
| **Scripts / server** | `capture-case-bank-smoke.mjs`, `capture-live-screenshot.mjs`, `caseBankLoader.mjs`, `compress-icu-audio.mjs`, `server/caseTtsCache.js` |
| **Assets** | `public/assets/audio/` |

### Diff summary (modified vs HEAD)

```
 package.json                     |     1 +
 scripts/build-prepared-cases.mjs |    51 +-
 scripts/smoke-test.mjs           |    48 +
 src/App.jsx                      |    14 +
 src/components/Complete.jsx      |    34 +
 src/components/Play.jsx          |     6 +-
 src/components/WelcomeScreen.jsx |     4 +
 src/data/caseFlows.js            |   194 +-
 src/data/ccsCatalog.json         |     2 +-
 src/data/gameConfig.json         |     4 +-
 src/data/gameData.js             |     3 +-
 src/data/playbooks.json          |   128 +-
 src/data/preparedCases.json      | 16923 +++++++++++++++++++++++++++++--------
 src/data/resolvePlaybook.js      |    77 +-
 src/hooks/usePlayDockLayout.js   |    32 +-
 src/lib/audienceProfile.js       |     7 +
 src/lib/audio.js                 |   468 +-
 src/lib/caseNarrative.js         |    38 +
 src/lib/casePresentation.js      |    38 +-
 src/lib/playDockLayout.js        |    31 +-
 src/lib/storageKeys.js           |    13 +-
 src/main.jsx                     |     1 +
 22 files changed, 14497 insertions(+), 3620 deletions(-)
```

---

## 4. Where the broken UI lives

Uncommitted local work is in:

**`C:\Users\steve\ER doc\game\src\`**

Most likely sources of UI breakage:

- **`src/ui-overrides.css`** — untracked global CSS overrides
- **`src/components/Play.jsx`** — play scene changes
- **`src/components/WelcomeScreen.jsx`** — welcome screen tweaks
- **`src/App.jsx`** — routing / screen flow
- **New overlay/panel components** — `CaseContextPanel`, `CasePresentationPanel`, `IcuMonitorStrip`, `GlobalUiSettingsPanel`, etc.

### Revert candidates

| Commit | Description |
|--------|-------------|
| `219390f` | Current HEAD — last pushed good state |
| `0b1b703` | v11 — review checkmarks |
| `99cb66e` | Stable release — launch blockers fixed, session features |

---

## Related projects

| Project | Path | Git |
|---------|------|-----|
| **TheSchoonMaker (game)** | `C:\Users\steve\ER doc\game\` | Yes — `BeizaPlus/TheSchoonMaker` |
| **clinical-scene** | `C:\Users\steve\Downloads\clinical-scene\` | Yes — separate repo |
| **ER doc (parent)** | `C:\Users\steve\ER doc\` | No git repo |

---

## Notes

- Welcome screen assets: `welcome.png`, `welcome-light.png`, `welcome-plate.png` (root + `public/` + `dist/`)
- Welcome screen component: `src/components/WelcomeScreen.jsx`, `src/components/Home.jsx`
- To launch game dev server: `cd "C:\Users\steve\ER doc\game"` then `npm run dev`
- clinical-scene (separate app) serves at `http://127.0.0.1:8080/` — goes straight to Case 1, no welcome screen
