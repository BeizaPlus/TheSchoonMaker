# Cursor Rules — ER Doc / Schoonmaker
# READ THIS BEFORE EVERY TASK

## THE REAL APP
The only real app is at:
C:\Users\steve\ER doc\game\

Start it with:
C:\Users\steve\ER doc\START-GAME.bat

Do not create files outside this folder.
Do not rebuild anything from scratch.
Do not create a new index.html anywhere.
Do not create a new React app anywhere.
Do not run npm create, npx create-*, or vite anywhere.

---

## GIT RULES
Every change gets its own commit immediately.
Never batch multiple changes into one commit.
Always push after every commit.

Commit order for any task:
1. git add -A && git commit -m "snapshot before [task]" && git push
2. Make ONE change
3. git add [changed files only] && git commit -m "[what changed]" && git push
4. Repeat for next change

Never commit node_modules.
Never commit .env files.
Check file sizes before committing videos — 
anything over 95MB must NOT be pushed to GitHub.

---

## CHANGE RULES
Only touch files directly related to the task.
If the task says "replace icons" — touch only the toolbar component.
If the task says "wire videos" — touch only the video config file.
If the task says "plug in cases" — touch only the data files.

Before making any change:
1. Print the file you are about to modify
2. Print the specific lines you are changing
3. Make the change
4. Print the diff
5. Commit

If a change requires touching more than 3 files —
stop and ask Master before proceeding.

---

## NEVER DO THESE THINGS
- Never rebuild the UI from scratch
- Never create a parallel version of the app
- Never create files in Downloads\ as the primary output
- Never use OpenAI API — use Anthropic API or Ollama only
- Never use absolute paths like C:\Users\steve\ in source code
- Never overwrite preparedCases.json without backing it up first
- Never run a script that modifies all 181 cases without
  Master confirming a 5-case test run first
- Never install new npm packages without asking first
- Never change layout, CSS, or component structure
  unless that is the explicit task
- Never combine a UI change with a data change in one commit

---

## DATA RULES
Case bank source of truth:
C:\Users\steve\ER doc\data\ccs_cases_master.json

Game data files:
C:\Users\steve\ER doc\game\src\data\preparedCases.json
C:\Users\steve\ER doc\game\src\data\ccsCatalog.json

Before overwriting any data file:
copy [file] [file]_backup_[date].json

Always run a 5-case test before processing all 181.
Always save progress every 10 cases.
Never stop the whole run for one case failure —
skip, flag, continue.

---

## FOLDER STRUCTURE
C:\Users\steve\ER doc\
├── game\              ← THE REAL APP. Work here only.
│   ├── src\           ← React components and logic
│   ├── public\        ← Static assets (videos, audio, images)
│   └── src\data\      ← Case data files
├── data\              ← Case bank source files (not the app)
├── scripts\           ← Standalone utility scripts
├── Step 3\            ← CCS screenshots and MultiCaRe
└── CURSOR_RULES.md    ← THIS FILE

---

## VIDEO ASSETS
Videos live at:
C:\Users\steve\ER doc\game\public\assets\video\

Naming convention:
breathing_01.mp4, breathing_02.mp4 etc
death.mp4

To add new breathing videos:
1. Copy to public\assets\video\
2. Name as breathing_XX.mp4 (next number)
3. Add to idleVideos array in the video config file
4. Commit

All video elements must have muted and playsinline.
No video should ever play audio.
ICU ambient audio is the only sound in the scene.

---

## IF SOMETHING BREAKS
1. git log --oneline -10
2. Identify last good commit
3. git revert HEAD (undoes last commit only)
4. Tell Master what broke before doing anything else

Never force push.
Never reset --hard without Master's explicit instruction.

---

## BEFORE STARTING ANY TASK
Read this file.
State which rule applies to this task.
State which files you will touch.
State which files you will NOT touch.
Then proceed.
