import { getCatalog, getCaseById, getAllGameCases } from './useCcsCatalog.js';
import { getGameConfig } from './gameData.js';
import {
  readProgress,
  clearProgress,
  recordCaseComplete,
  startShuffleQueue,
  nextInQueue,
  pickRandomId,
} from './caseProgress.js';

function ok(cond, name, detail = '') {
  const mark = cond ? '✅' : '❌';
  // eslint-disable-next-line no-console
  console.log(`${mark} ${name}${detail ? ' — ' + detail : ''}`);
  return cond;
}

export function runEvalSuite() {
  const totalSuites = 8;
  let pass = 0;

  const catalog = getCatalog();
  const gameCfg = getGameConfig();
  const zoneKeys = Object.keys(gameCfg.zones || {});

  // 1) Config zones sanity
  const zoneRangesOk = zoneKeys.every((k) => {
    const z = gameCfg.zones[k];
    return [z.cx, z.cy, z.w, z.h].every((v) => typeof v === 'number' && v >= 0 && v <= 1);
  });
  pass += ok(zoneKeys.length >= 5, 'config: has zones', String(zoneKeys.length)) ? 1 : 0;
  pass += ok(zoneRangesOk, 'config: zones fractions 0..1') ? 1 : 0;

  // 2) Catalog size
  pass += ok(Array.isArray(catalog.cases) && catalog.cases.length > 0, 'catalog: cases loaded', String(catalog.cases.length)) ? 1 : 0;

  // 3) Interventions integrity on a sample (count varies by case — not fixed at 5)
  const sample = catalog.cases.slice(0, 20);
  let bad = 0;
  for (const c of sample) {
    const gc = getCaseById(c.id);
    if (!gc) {
      bad += 1;
      continue;
    }
    const ivs = gc.interventions || [];
    if (ivs.length < 3) bad += 1;
    for (const iv of ivs) {
      if (!zoneKeys.includes(iv.correct_zone)) bad += 1;
      if (!iv.guideline || String(iv.guideline).trim().length < 2) bad += 1;
    }
  }
  pass += ok(bad === 0, 'playbook: interventions valid on sample (variable count)', String(bad)) ? 1 : 0;

  // 4) Shuffle queue logic
  clearProgress();
  const allIds = catalog.cases.map((c) => c.id);
  const first = startShuffleQueue(allIds.slice(0, 12));
  const p1 = readProgress();
  const okShuffle =
    Boolean(first) &&
    p1.queue.length === p1.queueIndex >= 0
      ? p1.queue[0] === first
      : false;
  pass += ok(okShuffle, 'queue: startShuffleQueue returns first id') ? 1 : 0;
  const next = nextInQueue();
  pass += ok(typeof next === 'string' && next.length > 0, 'queue: nextInQueue returns id') ? 1 : 0;

  // 5) Completion threshold
  clearProgress();
  const id0 = catalog.cases[0].id;
  const threshold = gameCfg.branding?.completionThreshold ?? 99;
  recordCaseComplete(id0, { accuracy: threshold - 1, attempts: 10, seconds: 30 });
  const recLow = readProgress().cases[id0];
  const lowOk = recLow && recLow.completed === false;
  recordCaseComplete(id0, { accuracy: threshold, attempts: 5, seconds: 10 });
  const recHi = readProgress().cases[id0];
  const hiOk = recHi && recHi.completed === true;
  pass += ok(lowOk && hiOk, `progress: recordCaseComplete uses >=${threshold} threshold`) ? 1 : 0;

  console.log(`runEvalSuite: ${pass}/${totalSuites} suites passed`);
  return pass === totalSuites;
}

