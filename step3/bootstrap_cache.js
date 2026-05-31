/** One-shot: cache login + case list + static assets (quick start). */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { saveResponse, listCached, MIRROR_DIR } = require('./ccs_cache_lib');

(async () => {
  const creds = JSON.parse(fs.readFileSync('ccs_credentials.json', 'utf8'));

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  page.on('response', async (res) => {
    const req = res.request();
    if (!res.url().includes('app.ccscases.com')) return;

    try {
      saveResponse(req.method(), res.url(), req.postData() || '', res.status(), res.headers(), await res.body());
    } catch {}
  });

  await page.goto('https://app.ccscases.com/', { waitUntil: 'networkidle', timeout: 90000 });
  await page.locator('input[autocomplete="email"]').fill(creds.email);
  await page.locator('input[type="password"]').fill(creds.password);
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await page.locator('.caseListRowContainer').first().waitFor({ timeout: 60000 });

  await browser.close();

  console.log('Bootstrap done. Cached', listCached().length, 'files in', MIRROR_DIR);
  console.log('Run: node serve_ccs_local.js');
  console.log('Open: http://localhost:8765');
})();
