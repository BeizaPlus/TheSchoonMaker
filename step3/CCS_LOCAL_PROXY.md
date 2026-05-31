# CCS Cases — intercept & serve locally

The live site uses **`*.webapi`** endpoints on `app.ccscases.com` (not a simple static site). You **can** intercept those responses and replay them locally.

## How it works

1. **`record_ccs_cache.js`** — opens the real site and saves every response into `ccs_mirror/`
2. **`serve_ccs_local.js`** — runs `http://localhost:8765` and serves cached API + static files

## Record (do this first)

```bash
cd "C:\Users\steve\Step 3"
node record_ccs_cache.js
```

- Chromium opens → log in if needed
- **Use the site normally** for a while: case list, View Grades, start cases, OK through intros
- Each call (e.g. `listcasesupdate.webapi`, `viewcasegrade.webapi`, `startcase.webapi`) is saved
- Press **Ctrl+C** when done

## Serve locally

```bash
node serve_ccs_local.js
```

Open **http://localhost:8765**

- **Hybrid mode (default):** cached = instant; missing = fetched from live site and saved
- **Offline only:** `set CCS_HYBRID=0` then `node serve_ccs_local.js` — only recorded data works

## Limits (important)

- You only get what you **recorded** (each case/grades/sim step needs that session captured once)
- **Login tokens expire** — re-record `login.webapi` or use hybrid mode
- This is for **your account / study** — not a full pirated clone of their product

## APIs seen on the site

- `login.webapi`, `listcasesupdate.webapi`, `getsavedfilters.webapi`
- `startcase.webapi`, `vitals.webapi` (simulation)
- `viewcasegrade.webapi`, `retreivecasegrade.webapi` (grades)
