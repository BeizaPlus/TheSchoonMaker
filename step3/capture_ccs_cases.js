const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function ensureLoggedIn(page) {
  const caseRow = () => page.locator('.caseListRowContainer');

  if (await caseRow().first().isVisible().catch(() => false)) {
    console.log('Already logged in — on case list.');
    return;
  }

  const creds = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'ccs_credentials.json'), 'utf8')
  );

  const loginVisible = await page
    .locator('input[autocomplete="email"]')
    .isVisible()
    .catch(() => false);

  if (!loginVisible) {
    await caseRow().first().waitFor({ state: 'visible', timeout: 60000 });
    console.log('Case list loaded.');
    return;
  }

  console.log('Signing in...');
  await page.locator('input[autocomplete="email"]').fill(creds.email);
  await page.locator('input[type="password"]').fill(creds.password);
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await caseRow().first().waitFor({ state: 'visible', timeout: 60000 });
  console.log('Signed in — case list ready.');
}

function parseRowText(innerText) {
  const lines = innerText
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);

  return { caseNumber: lines[0] || 'unknown', caseTitle: lines[1] || 'unknown' };
}

function screenshotPath(outputDir, caseNumber, caseTitle) {
  const safeTitle = caseTitle
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 40);

  return path.join(outputDir, `case_${caseNumber}_${safeTitle}.png`);
}

(async () => {
  const profileDir = path.join(__dirname, 'ccs_browser_profile');
  const outputDir = path.join(__dirname, 'ccs_screenshots');

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
  }

  const context = await chromium.launchPersistentContext(profileDir, {
    headless: false,
    viewport: { width: 1600, height: 1200 }
  });

  const page = context.pages()[0] || (await context.newPage());

  await page.goto('https://app.ccscases.com/', {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  });

  try {
    await ensureLoggedIn(page);
  } catch (err) {
    await page.screenshot({
      path: path.join(outputDir, 'debug_login_failed.png'),
      fullPage: true
    });
    console.log('Could not reach case list:', err.message);
    await context.close();
    return;
  }

  const caseRow = () => page.locator('.caseListRowContainer');
  const total = await caseRow().count();
  const existing = fs.readdirSync(outputDir).filter((f) => f.startsWith('case_') && f.endsWith('.png'));

  console.log(`Found ${total} cases. Already saved: ${existing.length} screenshots.`);
  console.log('Continuing...');

  for (let i = 0; i < total; i++) {
    try {
      if (!(await caseRow().first().isVisible().catch(() => false))) {
        const back = page.getByRole('button', { name: /Back To Case List/i }).first();

        if (await back.isVisible().catch(() => false)) {
          await back.click();
          await caseRow().first().waitFor({ state: 'visible', timeout: 30000 });
        }
      }

      const row = caseRow().nth(i);
      const { caseNumber, caseTitle } = parseRowText(await row.innerText());
      const outPath = screenshotPath(outputDir, caseNumber, caseTitle);

      if (fs.existsSync(outPath)) {
        console.log(`[${i + 1}/${total}] Skip case ${caseNumber} (already saved)`);
        continue;
      }

      console.log(`[${i + 1}/${total}] Case ${caseNumber}: ${caseTitle}`);

      await row.locator('button').click();
      await page.waitForTimeout(500);
      await page.getByRole('button', { name: 'View Grades' }).click();

      const backBtn = page.getByRole('button', { name: /Back To Case List/i }).first();
      await backBtn.waitFor({ state: 'visible', timeout: 30000 });
      await page.waitForTimeout(2000);

      await page.screenshot({ path: outPath, fullPage: true });
      console.log(`Saved ${path.basename(outPath)}`);

      await backBtn.click();
      await caseRow().first().waitFor({ state: 'visible', timeout: 30000 });
      await page.waitForTimeout(1000);
    } catch (err) {
      console.log(`Error on row ${i + 1}:`, err.message);

      try {
        const back = page.getByRole('button', { name: /Back To Case List/i }).first();

        if (await back.isVisible()) {
          await back.click();
          await caseRow().first().waitFor({ state: 'visible', timeout: 30000 });
        }
      } catch {}
    }
  }

  console.log('DONE');
  await context.close();
})();
