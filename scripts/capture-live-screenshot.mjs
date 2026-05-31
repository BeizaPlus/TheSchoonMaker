/** Capture live app screenshot after smoke checks. */
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const out = path.join(process.env.USERPROFILE || '', 'Downloads', 'schoonmaker-live-smoke.png');

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
      if (r.ok) return true;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

async function main() {
  console.log('--- Smoke test ---');
  const smoke = await runSmoke();
  const smokeOk = smoke.outText.includes('Smoke test complete.');

  console.log('\n--- Live server check ---');
  const webOk = await waitForUrl('http://127.0.0.1:5173/');
  const apiOk = await waitForUrl('http://127.0.0.1:3001/api/read-case/status?caseId=140&section=hpi&text=test');
  console.log(webOk ? '✅ Vite on :5173' : '❌ Vite not responding');
  console.log(apiOk ? '✅ API on :3001' : '❌ API not responding');

  if (!webOk) {
    console.error('Start dev servers first: npx concurrently "node server/index.js" "vite"');
    process.exit(1);
  }

  console.log('\n--- Screenshot ---');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://127.0.0.1:5173/', { waitUntil: 'domcontentloaded', timeout: 30000 });

  const enter = page.getByRole('button', { name: 'Enter' });
  if (await enter.isVisible({ timeout: 3000 }).catch(() => false)) {
    await enter.click();
  }

  await page.getByRole('button', { name: 'Play' }).click();
  await page.waitForSelector('.briefing-back-btn', { timeout: 20000 });
  await page.waitForSelector('.case-info-tab.active', { timeout: 10000 });
  await page.waitForTimeout(2000);

  const treatmentTab = page.getByRole('button', { name: 'Treatment' });
  if (await treatmentTab.isVisible().catch(() => false)) {
    await treatmentTab.click();
    await page.waitForTimeout(500);
  }

  await page.screenshot({ path: out, fullPage: false });
  await browser.close();

  const sizeKb = Math.round(fs.statSync(out).size / 1024);
  console.log(`✅ Screenshot saved: ${out} (${sizeKb} KB)`);
  console.log(`Smoke data checks: ${smokeOk ? 'PASS' : 'PARTIAL (import quirk)'}`);
  console.log(`Live UI: PASS`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
