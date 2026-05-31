const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const WAIT = 200; // ms between OK clicks — keep fast

async function ensureLoggedIn(page) {
  const caseRow = () => page.locator('.caseListRowContainer');

  if (await caseRow().first().isVisible().catch(() => false)) return;

  const creds = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'ccs_credentials.json'), 'utf8')
  );

  await page.locator('input[autocomplete="email"]').fill(creds.email);
  await page.locator('input[type="password"]').fill(creds.password);
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await caseRow().first().waitFor({ state: 'visible', timeout: 60000 });
}

function parseRowText(innerText) {
  const lines = innerText
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);

  return { caseNumber: lines[0] || '', caseTitle: lines[1] || '' };
}

function fileBase(caseNumber, caseTitle) {
  const safeTitle = caseTitle
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 40);

  return `presentation_${caseNumber}_${safeTitle}`;
}

function safeName(title) {
  return title.replace(/[^\w\s-]/g, '').replace(/\s+/g, '_').slice(0, 50);
}

function isComplete(outputDir, base) {
  const pngs = fs.readdirSync(outputDir).filter((f) => f.startsWith(base) && f.endsWith('.png'));

  return pngs.length >= 3 && fs.existsSync(path.join(outputDir, `${base}.txt`));
}

async function hasIntroPopup(page) {
  const text = await page.locator('.simulation-popup').first().innerText().catch(() => '');

  return text.trim().length > 15;
}

/** Screenshot popup → click OK/Next → repeat until intro done. */
async function captureIntroScreens(page, outputDir, base) {
  const steps = [];
  let step = 0;

  while (await hasIntroPopup(page)) {
    const popup = page.locator('.simulation-popup').first();
    let sub = 0;

    while (true) {
      const text = (await popup.innerText()).trim();
      if (text.length < 15) break;

      const title =
        text
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean)[0] || `Screen_${step + 1}`;

      const suffix = sub > 0 ? `_p${sub + 1}` : '';
      const fileId = `${base}_${String(step).padStart(2, '0')}_${safeName(title)}${suffix}`;

      const pngPath = path.join(outputDir, `${fileId}.png`);
      const box = await popup.boundingBox().catch(() => null);

      if (box && box.width > 0 && box.height > 0) {
        await page.screenshot({ path: pngPath, clip: box, timeout: 3000 }).catch(() => {});
      }

      if (!fs.existsSync(pngPath)) {
        await page.screenshot({ path: pngPath, fullPage: true, timeout: 3000 });
      }
      steps.push({ step, sub, title, text });

      const next = popup.locator('input[value="Next"]');
      const ok = popup.locator('input[value="OK"]');

      if (await next.count()) {
        await next.click({ force: true });
        sub++;
        await page.waitForTimeout(WAIT);
        continue;
      }

      if (await ok.count()) {
        await ok.click({ force: true });
        await page.waitForTimeout(WAIT);
      }

      break;
    }

    step++;
    if (step > 15) break;
  }

  return steps;
}

async function returnToCaseList(page) {
  try {
    const exit = page.locator('input[value="Exit Case"]');

    if (await exit.isVisible().catch(() => false)) {
      await exit.click({ force: true });
      const yes = page.locator('input[value="Yes"]');

      if (await yes.isVisible().catch(() => false)) {
        await yes.click({ force: true });
      }
    }
  } catch {}

  await page.goto('https://app.ccscases.com/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.locator('.caseListRowContainer').first().waitFor({ state: 'visible', timeout: 30000 });
}

async function openCase(page, row) {
  await row.click({ position: { x: 200, y: 20 } });
  await page.getByRole('button', { name: 'Start Case', exact: true }).click();
  await page.waitForTimeout(WAIT);

  const startNew = page.getByRole('button', { name: 'Start New Case' });

  if (await startNew.isVisible().catch(() => false)) {
    await startNew.click();
  } else {
    const cont = page.getByRole('button', { name: 'Continue Case' });

    if (await cont.isVisible().catch(() => false)) await cont.click();
  }

  await page.getByText('Case Introduction').waitFor({ state: 'visible', timeout: 30000 });
}

(async () => {
  const profileDir = path.join(__dirname, 'ccs_browser_profile');
  const outputDir = path.join(__dirname, 'ccs_presentations');

  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

  const context = await chromium.launchPersistentContext(profileDir, {
    headless: false,
    viewport: { width: 1600, height: 1200 }
  });

  const page = context.pages()[0] || (await context.newPage());

  await page.goto('https://app.ccscases.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await ensureLoggedIn(page);

  const caseRow = () => page.locator('.caseListRowContainer');
  const total = await caseRow().count();

  console.log(`FAST mode: OK through intro for ${total} cases...`);

  for (let i = 0; i < total; i++) {
    const row = caseRow().nth(i);
    const { caseNumber, caseTitle } = parseRowText(await row.innerText());
    const base = fileBase(caseNumber, caseTitle);

    if (isComplete(outputDir, base)) {
      console.log(`[${i + 1}/${total}] Skip ${caseNumber}`);
      continue;
    }

    try {
      console.log(`[${i + 1}/${total}] Case ${caseNumber}: ${caseTitle}`);

      await openCase(page, row);
      const steps = await captureIntroScreens(page, outputDir, base);

      const txt = [
        `Case ${caseNumber}: ${caseTitle}`,
        '',
        ...steps.flatMap((s) => [`--- ${s.title} ---`, s.text, ''])
      ].join('\n');

      fs.writeFileSync(path.join(outputDir, `${base}.txt`), txt);
      console.log(`OK ${steps.length} screens → ${steps.map((s) => s.title).join(' | ')}`);

      await returnToCaseList(page);
    } catch (err) {
      console.log(`Error ${caseNumber}:`, err.message);

      try {
        await returnToCaseList(page);
      } catch {}
    }
  }

  console.log('DONE');
  await context.close();
})();
