/**
 * Records all traffic to/from app.ccscases.com into ccs_mirror/
 * Run once while logged in; browse cases you want cached.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { saveResponse, listCached, MIRROR_DIR } = require('./ccs_cache_lib');

const HOST = 'app.ccscases.com';

async function recordResponse(response) {
  const req = response.request();
  const url = response.url();

  if (!url.includes(HOST)) return;

  const method = req.method();
  const postBody = req.postData() || '';
  let body;

  try {
    body = await response.body();
  } catch {
    return;
  }

  const file = saveResponse(method, url, postBody, response.status(), response.headers(), body);
  console.log('  cached', method, new URL(url).pathname, '→', path.basename(file));
}

(async () => {
  const creds = JSON.parse(fs.readFileSync(path.join(__dirname, 'ccs_credentials.json'), 'utf8'));

  console.log('Recording to', MIRROR_DIR);
  console.log('(Browse the site in the window — everything is saved for local replay)\n');

  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1200 } });

  page.on('response', (res) => {
    recordResponse(res).catch(() => {});
  });

  await page.goto(`https://${HOST}/`, { waitUntil: 'domcontentloaded' });

  const loginVisible = await page.locator('input[autocomplete="email"]').isVisible().catch(() => false);

  if (loginVisible) {
    await page.locator('input[autocomplete="email"]').fill(creds.email);
    await page.locator('input[type="password"]').fill(creds.password);
    await page.getByRole('button', { name: 'Login', exact: true }).click();
    await page.locator('.caseListRowContainer').first().waitFor({ timeout: 60000 });
    console.log('Logged in — case list loaded.\n');
  }

  console.log('>>> Use the app normally for 10+ minutes:');
  console.log('    - open cases, View Grades, start simulations');
  console.log('    - each .webapi call is saved to ccs_mirror/');
  console.log('>>> Press Ctrl+C here when done recording.\n');

  await new Promise(() => {}); // until user stops
})();

process.on('SIGINT', () => {
  console.log('\nStopped. Cached files:', listCached().length);
  console.log('Start local server: node serve_ccs_local.js');
  process.exit(0);
});
