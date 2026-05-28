/** Parse CCS-style vitals blocks and free-text vitals into structured numbers. */

function pickNum(text, re, fallback) {
  const m = text?.match(re);
  if (!m?.[1]) return fallback;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : fallback;
}

/** CCS export format: labeled lines with values on following lines. */
export function parseCcsVitalsBlock(vitalsText = '') {
  const t = vitalsText || '';
  const temp =
    pickNum(t, /Temperature:\s*\n+\s*([\d.]+)/i, null) ??
    pickNum(t, /(?:temp(?:erature)?)[^\d]{0,8}(\d{2,3}(?:\.\d)?)/i, 37.0);
  const hr =
    pickNum(t, /Pulse:\s*\n+\s*(\d{2,3})/i, null) ??
    pickNum(t, /(?:heart rate|hr|pulse)[^\d]{0,8}(\d{2,3})/i, 100);
  const rr =
    pickNum(t, /Respiratory rate:\s*\n+\s*(\d{1,2})/i, null) ??
    pickNum(t, /(?:resp(?:iratory)? rate|rr)[^\d]{0,8}(\d{1,2})/i, 18);
  const sbp =
    pickNum(t, /systolic:\s*\n+\s*(\d{2,3})/i, null) ??
    (t.match(/(?:bp|blood pressure)[^\d]{0,8}(\d{2,3})\s*\/\s*(\d{2,3})/i)?.[1]
      ? Number(t.match(/(?:bp|blood pressure)[^\d]{0,8}(\d{2,3})\s*\/\s*(\d{2,3})/i)[1])
      : 110);
  const dbp =
    pickNum(t, /diastolic:\s*\n+\s*(\d{2,3})/i, null) ??
    (t.match(/(?:bp|blood pressure)[^\d]{0,8}(\d{2,3})\s*\/\s*(\d{2,3})/i)?.[2]
      ? Number(t.match(/(?:bp|blood pressure)[^\d]{0,8}(\d{2,3})\s*\/\s*(\d{2,3})/i)[2])
      : 70);
  const spo2 = pickNum(t, /(?:spo2|o2 sat(?:uration)?)[^\d]{0,8}(\d{2,3})/i, 96);
  const lactate = pickNum(t, /lactate[^\d]{0,8}(\d(?:\.\d)?)/i, 1.8);

  return { sbp, dbp, hr, rr, temp, spo2, lactate };
}

const CATEGORY_VITALS = {
  Cardiopulmonary: { sbp: 98, dbp: 62, hr: 112, rr: 24, temp: 37.2, spo2: 91, lactate: 2.4 },
  'GI & Abdomen': { sbp: 108, dbp: 68, hr: 104, rr: 20, temp: 38.1, spo2: 97, lactate: 2.0 },
  Neurology: { sbp: 148, dbp: 88, hr: 88, rr: 16, temp: 38.4, spo2: 98, lactate: 1.6 },
  'OB/GYN': { sbp: 118, dbp: 74, hr: 108, rr: 20, temp: 37.4, spo2: 98, lactate: 1.9 },
  Genitourinary: { sbp: 122, dbp: 78, hr: 96, rr: 18, temp: 38.6, spo2: 98, lactate: 1.7 },
  'ID & Dermatology': { sbp: 102, dbp: 64, hr: 118, rr: 22, temp: 39.1, spo2: 94, lactate: 2.8 },
  Pediatrics: { sbp: 96, dbp: 58, hr: 128, rr: 28, temp: 38.8, spo2: 95, lactate: 2.2 },
  'Psychiatry & Social': { sbp: 128, dbp: 82, hr: 92, rr: 16, temp: 37.0, spo2: 99, lactate: 1.4 },
  'Trauma & Toxicology': { sbp: 88, dbp: 54, hr: 124, rr: 26, temp: 36.8, spo2: 89, lactate: 4.2 },
  'MSK & General': { sbp: 132, dbp: 84, hr: 98, rr: 18, temp: 37.1, spo2: 98, lactate: 1.5 },
  'Emergency Medicine': { sbp: 110, dbp: 70, hr: 102, rr: 20, temp: 37.5, spo2: 96, lactate: 2.0 },
};

export function vitalsForCategory(category, seed = 0) {
  const base = { ...(CATEGORY_VITALS[category] || CATEGORY_VITALS['Emergency Medicine']) };
  const jitter = (n, spread) => Math.max(1, Math.round(n + ((seed % 7) - 3) * spread));
  return {
    sbp: jitter(base.sbp, 3),
    dbp: jitter(base.dbp, 2),
    hr: jitter(base.hr, 4),
    rr: jitter(base.rr, 1),
    temp: Math.round((base.temp + ((seed % 5) - 2) * 0.2) * 10) / 10,
    spo2: jitter(base.spo2, 1),
    lactate: Math.round((base.lactate + ((seed % 3) - 1) * 0.3) * 10) / 10,
  };
}

export function parseVitalsFromText(vitalsText = '', category = 'Emergency Medicine', seed = 0) {
  if (!vitalsText?.trim()) return vitalsForCategory(category, seed);
  const parsed = parseCcsVitalsBlock(vitalsText);
  const hasSignal =
    /systolic|diastolic|Pulse:|Temperature:/i.test(vitalsText) ||
    /bp|blood pressure|heart rate|spo2/i.test(vitalsText);
  return hasSignal ? parsed : vitalsForCategory(category, seed);
}
