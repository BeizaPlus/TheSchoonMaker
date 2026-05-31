const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function ensureLoggedIn(page) {
  const caseRow = () => page.locator('.caseListRowContainer');

  if (await caseRow().first().isVisible().catch(() => false)) {
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
    return;
  }

  await page.locator('input[autocomplete="email"]').fill(creds.email);
  await page.locator('input[type="password"]').fill(creds.password);
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await caseRow().first().waitFor({ state: 'visible', timeout: 60000 });
}

function parseCaseLines(lines) {
  return {
    caseNumber: lines[0] || '',
    title: lines[1] || '',
    completionDate: lines[2] || '',
    highYield: lines[3] || '',
    timeLimit: lines[4] || '',
    averageGrade: lines[lines.length - 1] || ''
  };
}

function toMarkdown(data) {
  const lines = [];

  lines.push('# CCS Cases — Study Prep List');
  lines.push('');
  lines.push(`Exported: ${data.exportedAt}`);
  lines.push(`Total cases: ${data.cases.length}`);
  lines.push('');

  lines.push('## Sidebar / Filters (from case list screen)');
  lines.push('');
  lines.push(`- **Sort by:** ${data.sidebar.sortBy}`);
  lines.push(`- **Case list style:** ${data.sidebar.listStyle}`);
  lines.push(`- **Categories:** ${data.sidebar.categories.join(', ')}`);
  lines.push(`- **Other filters:** ${data.sidebar.otherFilters.join(', ') || 'None active'}`);
  lines.push(`- **Timed exam:** ${data.sidebar.timedExam}`);
  lines.push(`- **Custom time limit:** ${data.sidebar.customTimeLimit}`);
  lines.push(`- **Simulate network lag:** ${data.sidebar.networkLag}`);
  lines.push('');

  lines.push('## All Cases (Case Number order)');
  lines.push('');
  lines.push(
    '| # | Topic | Completion | Time | Avg Grade | High Yield | Review Later |'
  );
  lines.push(
    '|---|-------|------------|------|-----------|------------|--------------|'
  );

  for (const c of data.cases) {
    lines.push(
      `| ${c.caseNumber} | ${c.title} | ${c.completionDate} | ${c.timeLimit} | ${c.averageGrade} | ${c.highYield} | ${c.reviewLater ? 'Yes' : ''} |`
    );
  }

  lines.push('');
  lines.push('## Topics only (for quick prep)');
  lines.push('');

  for (const c of data.cases) {
    lines.push(`${c.caseNumber}. ${c.title}`);
  }

  lines.push('');
  lines.push('## Weak scores (< 50%) — prioritize review');
  lines.push('');

  const weak = data.cases.filter((c) => {
    const pct = parseFloat(String(c.averageGrade).replace('%', ''));

    return !Number.isNaN(pct) && pct < 50;
  });

  if (weak.length === 0) {
    lines.push('None');
  } else {
    for (const c of weak) {
      lines.push(`- **${c.caseNumber}. ${c.title}** — ${c.averageGrade}`);
    }
  }

  return lines.join('\n');
}

(async () => {
  const profileDir = path.join(__dirname, 'ccs_browser_profile');
  const outDir = path.join(__dirname, 'ccs_screenshots');

  const context = await chromium.launchPersistentContext(profileDir, {
    headless: true,
    viewport: { width: 1600, height: 1200 }
  });

  const page = context.pages()[0] || (await context.newPage());

  await page.goto('https://app.ccscases.com/', {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  });

  await ensureLoggedIn(page);

  const data = await page.evaluate(() => {
    const getLabel = (text) => {
      const el = [...document.querySelectorAll('*')].find(
        (n) => n.childElementCount === 0 && n.textContent?.trim() === text
      );

      if (!el) return '';

      const parent = el.parentElement;

      return parent?.innerText?.split('\n').map((s) => s.trim()).filter(Boolean).slice(0, 3).join(' | ') || text;
    };

    const categories = [
      'Internal Medicine',
      'Neurology',
      'OB/GYN',
      'Pediatrics',
      'Emergency Medicine',
      'Psychiatry'
    ].filter((name) => {
      const label = [...document.querySelectorAll('label')].find((l) =>
        l.textContent?.includes(name)
      );

      if (!label) return true;

      const cb = label.querySelector('input[type="checkbox"]');

      return !cb || cb.checked;
    });

    const otherFilters = [];

    for (const name of [
      'Show Case Diagnosis',
      'Hide Case Title',
      'Hide Completed',
      'Hide Incomplete'
    ]) {
      const label = [...document.querySelectorAll('label')].find((l) =>
        l.textContent?.includes(name)
      );
      const cb = label?.querySelector('input[type="checkbox"]');

      if (cb?.checked) otherFilters.push(name);
    }

    const cases = [...document.querySelectorAll('.caseListRowContainer')].map((row) => {
      const lines = row.innerText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);

      const checkbox = row.querySelector('input[type="checkbox"]');

      return {
        caseNumber: lines[0] || '',
        title: lines[1] || '',
        completionDate: lines[2] || '',
        highYield: lines[3] || '',
        timeLimit: lines[4] || '',
        averageGrade: lines[lines.length - 1] || '',
        reviewLater: !!checkbox?.checked
      };
    });

    return {
      sidebar: {
        sortBy: 'Case Number',
        listStyle: document.querySelector('.caseListRowStyleListContainer')
          ? 'List'
          : 'Card',
        categories,
        otherFilters,
        timedExam: document.body.innerText.includes('Timed Exam') ? 'On' : 'Unknown',
        customTimeLimit: 'None',
        networkLag: 'None'
      },
      cases
    };
  });

  data.exportedAt = new Date().toISOString();

  const jsonPath = path.join(outDir, 'ccs_case_list.json');
  const mdPath = path.join(outDir, 'ccs_case_list_prep.md');
  const txtPath = path.join(outDir, 'ccs_topics.txt');

  fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2));
  fs.writeFileSync(mdPath, toMarkdown(data));
  fs.writeFileSync(
    txtPath,
    data.cases.map((c) => `${c.caseNumber}. ${c.title}`).join('\n')
  );

  console.log(`Exported ${data.cases.length} cases`);
  console.log(jsonPath);
  console.log(mdPath);
  console.log(txtPath);

  await context.close();
})();
