// Smoke test for Schoonmaker (ER doc/game)
// Runs in Node (no browser). Validates queue/reorder logic + config sanity.

import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function ok(cond, name, detail = "") {
  const mark = cond ? "✅" : "❌";
  console.log(`${mark} ${name}${detail ? " — " + detail : ""}`);
  return cond;
}

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(root, rel), "utf8"));
}

// Minimal localStorage polyfill for caseProgress.js
function makeLocalStorage() {
  const m = new Map();
  return {
    getItem(k) {
      return m.has(k) ? m.get(k) : null;
    },
    setItem(k, v) {
      m.set(k, String(v));
    },
    removeItem(k) {
      m.delete(k);
    },
    clear() {
      m.clear();
    },
    _dump() {
      return Object.fromEntries(m.entries());
    },
  };
}

async function main() {
  const gameCfg = readJson("src/data/gameConfig.json");
  const catalog = readJson("src/data/ccsCatalog.json");
  const playbooks = readJson("src/data/playbooks.json");
  const prepared = readJson("src/data/preparedCases.json");

  const zones = gameCfg.zones;
  const zoneKeys = Object.keys(zones);
  ok(zoneKeys.length >= 5, "config: zones exist", `${zoneKeys.length} zones`);
  ok(
    typeof gameCfg.drag?.overlap !== "undefined",
    "config: drag.overlap set",
    String(gameCfg.drag?.overlap),
  );
  ok(gameCfg.drag?.overlap === "pointer" || typeof gameCfg.drag?.overlap === "number", "config: overlap valid");

  // Zone sanity
  const zoneRangesOk = zoneKeys.every((k) => {
    const z = zones[k];
    return [z.cx, z.cy, z.w, z.h].every((v) => typeof v === "number" && v >= 0 && v <= 1);
  });
  ok(zoneRangesOk, "config: zone fractions 0..1");

  ok(Array.isArray(catalog.cases) && catalog.cases.length > 0, "catalog: cases loaded", `${catalog.cases.length} cases`);
  ok(
    prepared.totalCases === catalog.cases.length,
    "preparedCases: count matches catalog",
    `${prepared.totalCases} vs ${catalog.cases.length}`,
  );
  const parsedVitals = Object.values(prepared.cases || {}).filter((c) => c.vitalsSource === "parsed").length;
  ok(parsedVitals >= 8, "preparedCases: CCS vitals parsed", `${parsedVitals} parsed`);

  const { resolvePlaybook, getCaseSpecificPlaybookIds } = await import(
    url.pathToFileURL(path.join(root, "src/data/resolvePlaybook.js")).href
  );
  const specificIds = getCaseSpecificPlaybookIds();
  ok(specificIds.length >= 20, "case-specific playbooks seeded from study guides", `${specificIds.length} cases`);

  // Validate playbook interventions match what the drag UI expects.
  const bad = { zones: 0, count: 0, guideline: 0, why: 0 };
  for (const c of catalog.cases) {
    const pb = resolvePlaybook(c);
    const ivs = pb?.interventions || [];
    if (ivs.length < 3) bad.count += 1;
    for (const iv of ivs) {
      if (!zoneKeys.includes(iv.correct_zone)) bad.zones += 1;
      if (!iv.guideline || String(iv.guideline).trim().length < 2) bad.guideline += 1;
      if (!iv.why || String(iv.why).trim().length < 5) bad.why += 1;
    }
  }
  ok(bad.count === 0, "catalog: every case has at least 3 interventions", `bad.count=${bad.count}`);
  ok(bad.zones === 0, "catalog: correct_zone always valid zone key", `bad.zones=${bad.zones}`);
  ok(bad.guideline === 0, "catalog: guideline present", `bad.guideline=${bad.guideline}`);

  // Queue/reorder logic via caseProgress.js
  globalThis.localStorage = makeLocalStorage();
  const progress = await import(url.pathToFileURL(path.join(root, "src/data/caseProgress.js")).href);

  const ids = catalog.cases.slice(0, 20).map((c) => c.id);
  ok(ids.length >= 10, "queue: have ids pool", `${ids.length}`);

  // startShuffleQueue should create a permuted queue and return first id
  const first = progress.startShuffleQueue(ids);
  const p1 = progress.readProgress();
  ok(p1.queue.length === ids.length, "shuffle: queue length matches");
  ok(Boolean(first) && p1.queue[0] === first, "shuffle: start returns first id");
  ok(p1.lastMode === "shuffle", "shuffle: lastMode set");

  // nextInQueue should advance and wrap
  const seen = new Set([first]);
  for (let i = 0; i < ids.length + 2; i++) {
    const n = progress.nextInQueue();
    seen.add(n);
  }
  ok(seen.size >= Math.min(ids.length, 6), "shuffle: nextInQueue advances");

  // pickRandomId should pick from set
  const r = progress.pickRandomId(ids);
  ok(ids.includes(r), "random: pickRandomId returns member");

  // recordCaseComplete should mark completed at >= completionThreshold
  const threshold = gameCfg.branding?.completionThreshold ?? 99;
  progress.clearProgress();
  progress.recordCaseComplete(ids[0], { accuracy: threshold - 1, attempts: 10, seconds: 30 });
  const recLow = progress.getCaseRecord(ids[0]);
  ok(recLow && recLow.completed === false, `progress: <${threshold} not completed`);
  progress.recordCaseComplete(ids[0], { accuracy: threshold, attempts: 5, seconds: 20 });
  const recHi = progress.getCaseRecord(ids[0]);
  ok(recHi && recHi.completed === true, `progress: >=${threshold} completed`);
  ok(recHi.bestAccuracy >= threshold, "progress: bestAccuracy updated");

  console.log("\nSmoke test complete.");

  // --- Case bank vs preparedCases (random sample) ---
  const { loadCaseBank } = await import(
    url.pathToFileURL(path.join(root, "scripts/caseBankLoader.mjs")).href
  );
  const bank = loadCaseBank();
  ok(bank.size >= 100, "case bank: loaded scraped cases", `${bank.size} entries`);

  const catalogIds = catalog.cases.map((c) => Number(c.caseNumber));
  const sampleSize = Math.min(12, catalogIds.length);
  const shuffled = [...catalogIds].sort(() => Math.random() - 0.5).slice(0, sampleSize);
  let matchOk = 0;
  let matchFail = 0;
  const failSamples = [];

  for (const caseNum of shuffled) {
    const key = String(caseNum).padStart(3, "0");
    const prep = prepared.cases?.[key];
    const bankCase = bank.get(caseNum);
    if (!prep || !bankCase?.correct_orders?.length) {
      matchFail += 1;
      failSamples.push({ caseNum, reason: "missing prep or bank orders" });
      continue;
    }
    const prepLabels = new Set((prep.interventions || []).map((iv) => iv.label.toLowerCase()));
    const bankLabels = bankCase.correct_orders.map((o) => String(o).toLowerCase());
    const overlap = bankLabels.filter((l) => prepLabels.has(l)).length;
    const ratio = overlap / Math.max(bankLabels.length, 1);
    if (ratio >= 0.8) {
      matchOk += 1;
    } else {
      matchFail += 1;
      failSamples.push({
        caseNum,
        topic: bankCase.topic,
        diagnosis: bankCase.diagnosis,
        overlap,
        bankTotal: bankLabels.length,
        prepTotal: prepLabels.size,
      });
    }
  }

  ok(
    matchOk >= Math.floor(sampleSize * 0.85),
    "case bank: random sample matches prepared treatments",
    `${matchOk}/${sampleSize} matched` + (failSamples.length ? ` fails=${JSON.stringify(failSamples.slice(0, 3))}` : ""),
  );
}

main().catch((e) => {
  console.error("Smoke test failed:", e);
  process.exitCode = 1;
});

