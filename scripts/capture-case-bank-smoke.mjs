/** Smoke test + screenshots verifying case-bank treatments in live UI. */
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCaseBank } from './caseBankLoader.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'src/data/ccsCatalog.json'), 'utf8'));
const shotsDir = path.join(process.env.USERPROFILE || '', 'Downloads', 'schoonmaker-case-bank-smoke');

async function runSmoke() {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ['scripts/smoke-test.mjs'], {
      cwd: root,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let outText = '';
    child.stdout.on('data', (d) => {
      outText += String(d);
      process.stdout.write(d);
    });
    child.stderr.on('data', (d) => {
      outText += String(d);
      process.stderr.write(d);
    });
    child.on('close', (code) => resolve({ code: code ?? 1, outText }));
  });
}

async function waitForUrl(url, ms = 20000) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    try {
      const r = await fetch(url);
      if (r.ok) return url;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return null;
}

async function resolveWebBase() {
  const hosts = ['127.0.0.1', 'localhost'];
  for (const port of [5173, 5174, 5175]) {
    for (const host of hosts) {
      const base = `http://${host}:${port}/`;
      const hit = await waitForUrl(base, 5000);
      if (hit) return hit.replace(/\/$/, '');
    }
  }
  return null;
}

async function ensureDevServer() {
  let webBase = await resolveWebBase();
  if (webBase) return webBase;

  console.log('Starting dev servers for screenshots…');
  const child = spawn('npm', ['run', 'dev'], {
    cwd: root,
    stdio: 'ignore',
    shell: true,
    detached: true,
  });
  child.unref();

  webBase = await resolveWebBase();
  if (!webBase) {
    // give vite a bit longer on cold start
    await new Promise((r) => setTimeout(r, 3000));
    webBase = await resolveWebBase();
  }
  return webBase;
}

const PHYSICIAN_PROFILE = JSON.stringify({
  level: 'advanced',
  condition: 'diabetes',
  playRole: 'doctor',
  difficulty: 'standard',
  timerSeconds: 150,
});

async function dismissOnboarding(page) {
  const cta = page.getByRole('button', { name: /Continue as physician/i });
  if (await cta.isVisible({ timeout: 2000 }).catch(() => false)) {
    await cta.click();
    await page.waitForTimeout(400);
  }
}

async function openCaseBrowser(page) {
  await dismissOnboarding(page);
  await page.getByRole('button', { name: 'Profiles' }).click();
  await page.getByRole('button', { name: /Browse all cases/i }).click();
  await page.waitForSelector('.case-row', { timeout: 20000 });
}

async function selectCaseCategory(page, caseNum) {
  const meta = catalog.cases.find((c) => String(c.caseNumber) === String(caseNum));
  if (!meta) return;
  const cat = catalog.categories.find((c) => c.caseIds?.includes(meta.id));
  if (!cat) return;
  await page.getByRole('button', { name: new RegExp(`All ${catalog.totalCases} cases`) }).click();
  await page.getByRole('button', { name: new RegExp(`^${cat.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`) }).click();
  await page.waitForTimeout(400);
}

async function openCase(page, caseNum) {
  await openCaseBrowser(page);
  await selectCaseCategory(page, caseNum);

  const bank = loadCaseBank();
  const bankCase = bank.get(caseNum);
  const title = bankCase?.topic || `Case ${caseNum}`;

  const row = page.locator('.case-row').filter({ hasText: new RegExp(title, 'i') }).first();
  if (await row.isVisible({ timeout: 5000 }).catch(() => false)) {
    await row.click();
  } else {
    const byNum = page.locator('.case-row').filter({ hasText: new RegExp(`#${caseNum}(?!\\d)`) }).first();
    await byNum.click();
  }

  await page.locator('.btn-play-block').click();
  await page.waitForSelector('.briefing-back-btn', { timeout: 20000 });
  await page.waitForTimeout(800);
}

async function captureCase(page, caseNum, label) {
  await openCase(page, caseNum);
  fs.mkdirSync(shotsDir, { recursive: true });

  const bank = loadCaseBank().get(caseNum);
  const briefingPath = path.join(shotsDir, `case-${caseNum}-briefing.png`);
  await page.screenshot({ path: briefingPath, fullPage: false });

  await page.getByRole('button', { name: /Begin case/i }).click();
  await page.waitForSelector('.play-hud', { timeout: 20000 });

  const treatmentTab = page.getByRole('button', { name: 'Treatment' });
  await treatmentTab.click();
  await page.waitForSelector('#pill-list', { timeout: 20000 });
  await page.waitForTimeout(600);

  const uiOrders = await page.locator('#pill-list .pill-text').allTextContents();
  const bankOrders = bank?.correct_orders || [];
  const bankSet = new Set(bankOrders.map((o) => String(o).toLowerCase()));
  const uiCore = uiOrders.filter((t) => bankSet.has(t.toLowerCase()));
  const overlap = uiCore.length / Math.max(bankOrders.length, 1);
  console.log(`   bank orders (${bankOrders.length}): ${bankOrders.slice(0, 4).join(' · ')}${bankOrders.length > 4 ? '…' : ''}`);
  console.log(`   UI treatment stack overlap: ${Math.round(overlap * 100)}% (${uiCore.length}/${bankOrders.length})`);

  const treatmentPath = path.join(shotsDir, `case-${caseNum}-treatment-${label}.png`);
  await page.screenshot({ path: treatmentPath, fullPage: false });

  console.log(`📸 Case ${caseNum} (${bank?.diagnosis || '?'})`);
  console.log(`   ${briefingPath}`);
  console.log(`   ${treatmentPath}`);
  return { briefingPath, treatmentPath, overlap };
}

async function main() {
  console.log('--- Rebuild prepared cases from case bank ---');
  const build = spawn(process.execPath, ['scripts/build-prepared-cases.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
  await new Promise((r) => build.on('close', r));

  console.log('\n--- Smoke test ---');
  const smoke = await runSmoke();
  if (!smoke.outText.includes('Smoke test complete.')) {
    console.error('Smoke test did not complete cleanly');
    process.exit(1);
  }

  console.log('\n--- Live server check ---');
  const webBase = await ensureDevServer();
  if (!webBase) {
    console.error('Could not reach Vite (5173–5175). Run: npm run dev');
    process.exit(1);
  }
  console.log(`✅ Web app at ${webBase}`);

  const bank = loadCaseBank();
  const ids = [1, 10, 23, 91].filter((id) => bank.has(id));
  const randomExtra = [...bank.keys()]
    .sort(() => Math.random() - 0.5)
    .filter((id) => !ids.includes(id))
    .slice(0, 2);
  const sample = [...ids, ...randomExtra];

  console.log('\n--- Screenshots ---');
  console.log(`Output folder: ${shotsDir}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript((profile) => {
    localStorage.setItem('schoonmaker_audience_profile', profile);
  }, PHYSICIAN_PROFILE);
  const page = await context.newPage();

  const results = [];
  for (const caseNum of sample) {
    await page.goto(`${webBase}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    results.push(await captureCase(page, caseNum, 'orders'));
  }

  await browser.close();
  const avgOverlap =
    results.reduce((s, r) => s + (r.overlap || 0), 0) / Math.max(results.length, 1);
  console.log(`\n✅ Case bank smoke + screenshots complete (avg overlap ${Math.round(avgOverlap * 100)}%)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
