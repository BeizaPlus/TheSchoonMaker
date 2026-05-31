import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import fsp from 'fs/promises';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { fileURLToPath } from 'url';
import {
  appendChatHistory,
  appendTimelineEvent,
  endCaseSession,
  ensureUserDirs,
  getOverallStats,
  readCaseUser,
  saveRecording,
  startCaseSession,
} from './userCaseStore.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env'), override: true });

const app = express();
app.use(cors());
app.use(express.json({ limit: '12mb' }));

const SCENE_CACHE_DIR = path.join(__dirname, '../../.scene-cache');
if (!fs.existsSync(SCENE_CACHE_DIR)) {
  fs.mkdirSync(SCENE_CACHE_DIR, { recursive: true });
}
app.use('/scene-cache', express.static(SCENE_CACHE_DIR));

const CAPTURES_DIR = path.join(__dirname, '../../captures');
if (!fs.existsSync(CAPTURES_DIR)) {
  fs.mkdirSync(CAPTURES_DIR, { recursive: true });
}
const MAGIC_DIR = path.join(__dirname, '../../.magic-links');
if (!fs.existsSync(MAGIC_DIR)) {
  fs.mkdirSync(MAGIC_DIR, { recursive: true });
}

function createMailer() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || user;
  if (!host || !user || !pass || !from) return null;
  return {
    from,
    transporter: nodemailer.createTransport({
      host,
      port,
      secure: Boolean(process.env.SMTP_SECURE === '1' || port === 465),
      auth: { user, pass },
    }),
  };
}

async function sendMagicEmail(toEmail, magicLink) {
  const mailer = createMailer();
  if (!mailer || !toEmail) return { sent: false, reason: 'SMTP not configured or email missing' };
  await mailer.transporter.sendMail({
    from: mailer.from,
    to: toEmail,
    subject: 'Your personalized Schoonmaker link',
    text: `Your personalized case experience is ready.\n\nOpen this magic link:\n${magicLink}\n\nThis link expires in 48 hours.`,
    html: `<p>Your personalized case experience is ready.</p>
<p><a href="${magicLink}">Open your magic link</a></p>
<p>This link expires in 48 hours.</p>`,
  });
  return { sent: true };
}

function pad3(n) {
  return String(n).padStart(3, '0');
}

const VISION_PROMPT = `Medical training game: return ONLY JSON with keys zone-monitor, zone-iv-bag, zone-blood, zone-arm, zone-icu.
Each value: { "cx": 0-1, "cy": 0-1, "w": 0.05-0.2, "h": 0.05-0.15 } (center + size as fraction of image).`;

const CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini';
const caseChatSessions = new Map();

function openAiKeyOrError(res) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    res.status(400).json({
      error: 'Add OPENAI_API_KEY to .env in the project root (see .env.example)',
    });
    return null;
  }
  return key;
}

function pruneCaseChatSessions() {
  const maxAge = 1000 * 60 * 60 * 2;
  const now = Date.now();
  for (const [id, session] of caseChatSessions) {
    if (now - session.lastUsed > maxAge) caseChatSessions.delete(id);
  }
}

function buildCaseChatSystemPrompt(caseContext) {
  const role = caseContext?.playRole === 'patient' ? 'patient' : 'doctor';
  const roleLine =
    role === 'patient'
      ? 'Respond in first person as the patient in this case. Stay in character and only use facts from the case JSON.'
      : 'Respond as a clinical tutor helping the learner work through this case. Use only the case JSON — no outside facts.';
  return `${roleLine}

Rules:
- Answer ONLY from the CASE JSON below. If something is not in the JSON, say it is not documented in this case.
- Keep answers concise and practical for emergency medicine training.
- Do not invent labs, imaging results, or outcomes not present in the JSON unless clearly labeled as teaching speculation.

CASE JSON:
${JSON.stringify(caseContext, null, 2)}`;
}

async function callCaseChatCompletion(key, messages) {
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: CHAT_MODEL,
      max_tokens: 700,
      temperature: 0.35,
      messages,
    }),
  });
  if (!r.ok) {
    const err = await r.text();
    throw new Error(err || `OpenAI error ${r.status}`);
  }
  const data = await r.json();
  return data.choices?.[0]?.message?.content?.trim() || 'No response.';
}

async function analyzePatientFromCase(key, imageBase64, mimeType, caseContext) {
  const caseSummary = {
    id: caseContext?.id,
    title: caseContext?.title,
    category: caseContext?.category,
    chief_complaint: caseContext?.chief_complaint,
    historyText: caseContext?.historyText,
    vitalsText: caseContext?.vitalsText,
    patientSex: caseContext?.patientSex,
    exam: caseContext?.exam,
    vitals: caseContext?.vitals,
    clinical_tip: caseContext?.clinical_tip,
  };

  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: CHAT_MODEL,
      max_tokens: 900,
      temperature: 0.2,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'text',
            text: `Analyze this hospital patient reference image together with the emergency medicine case below.
Return ONLY valid JSON (no markdown) with keys:
- pose: bed pose, camera angle, limb positions that must stay fixed
- equipmentLayout: where monitor, IV, blood, arm, ICU zones appear in frame
- patientAppearance: age, sex, build, distress, skin findings, clothing from CASE TEXT ONLY
- clinicalContext: one sentence chief issue from the case
- editInstructions: 2-3 sentences for an image editor — what to change in the patient while preserving exact pose and layout

CASE:
${JSON.stringify(caseSummary, null, 2)}`,
          },
          {
            type: 'image_url',
            image_url: { url: `data:${mimeType};base64,${imageBase64}` },
          },
        ],
      }],
    }),
  });
  if (!r.ok) {
    const err = await r.text();
    throw new Error(err || `Vision analysis failed ${r.status}`);
  }
  const data = await r.json();
  const text = data.choices?.[0]?.message?.content || '';
  const clean = text.replace(/```json|```/g, '').trim();
  return JSON.parse(clean);
}

function buildRegeneratePatientPrompt(analysis, caseContext) {
  return `Reconstruct this photorealistic ER hospital patient training scene to match the clinical case presentation.

CRITICAL CONSTRAINTS — preserve from the reference image:
- Exact same patient pose, bed angle, and camera framing
- Same compositional layout for monitor, IV lines, blood products, and arm access zones
- Photorealistic emergency department resuscitation bay — no cartoon style, no text, no watermark, no extra people

PATIENT TO DEPICT (from case presentation):
${analysis?.patientAppearance || caseContext?.historyText || caseContext?.chief_complaint || 'Match case demographics'}

CLINICAL CONTEXT:
${analysis?.clinicalContext || caseContext?.chief_complaint || caseContext?.title || ''}

POSE (do not change):
${analysis?.pose || 'Supine in hospital bed, same angle as reference'}

EQUIPMENT LAYOUT (keep zones aligned):
${analysis?.equipmentLayout || 'Standard ER bedside equipment placement'}

EDITOR NOTES:
${analysis?.editInstructions || 'Adapt patient appearance to match the case while keeping pose identical.'}`;
}

ensureUserDirs();
const USER_DATA_DIR = path.join(__dirname, '../user-data');
app.use('/user-data', express.static(USER_DATA_DIR));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, openai: Boolean(process.env.OPENAI_API_KEY) });
});

app.get('/api/user/stats', async (_req, res) => {
  try {
    const stats = await getOverallStats();
    return res.json({ ok: true, stats });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
});

app.get('/api/user/case/:caseId', async (req, res) => {
  const caseId = String(req.params.caseId || '').trim();
  if (!caseId) return res.status(400).json({ error: 'Missing caseId' });
  try {
    const data = await readCaseUser(caseId);
    if (!data) return res.json({ ok: true, caseId, data: null });
    return res.json({ ok: true, caseId, ...data });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
});

app.post('/api/user/case/:caseId/session/start', async (req, res) => {
  const caseId = String(req.params.caseId || '').trim();
  if (!caseId) return res.status(400).json({ error: 'Missing caseId' });
  try {
    const out = await startCaseSession(caseId, req.body || {});
    return res.json({
      ok: true,
      caseId,
      sessionId: out.sessionId,
      attempt: out.attempt,
    });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
});

app.post('/api/user/case/:caseId/session/:sessionId/end', async (req, res) => {
  const caseId = String(req.params.caseId || '').trim();
  const sessionId = String(req.params.sessionId || '').trim();
  if (!caseId || !sessionId) return res.status(400).json({ error: 'Missing caseId or sessionId' });
  try {
    const session = await endCaseSession(caseId, sessionId, req.body?.result || {});
    return res.json({ ok: true, session });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
});

app.post('/api/user/case/:caseId/session/:sessionId/event', async (req, res) => {
  const caseId = String(req.params.caseId || '').trim();
  const sessionId = String(req.params.sessionId || '').trim();
  const event = req.body?.event;
  if (!caseId || !sessionId) return res.status(400).json({ error: 'Missing caseId or sessionId' });
  if (!event || typeof event !== 'object') return res.status(400).json({ error: 'Missing event' });
  try {
    const entry = await appendTimelineEvent(caseId, sessionId, event);
    return res.json({ ok: true, entry });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
});

app.post('/api/user/case/:caseId/chat', async (req, res) => {
  const caseId = String(req.params.caseId || '').trim();
  const { sessionId, role, content } = req.body || {};
  if (!caseId) return res.status(400).json({ error: 'Missing caseId' });
  if (!role || !content) return res.status(400).json({ error: 'Missing role or content' });
  try {
    const msg = await appendChatHistory(caseId, sessionId, role, content);
    return res.json({ ok: true, message: msg });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
});

app.post('/api/user/case/:caseId/session/:sessionId/recording', async (req, res) => {
  const caseId = String(req.params.caseId || '').trim();
  const sessionId = String(req.params.sessionId || '').trim();
  const { audioBase64, mimeType, durationMs } = req.body || {};
  if (!caseId || !sessionId) return res.status(400).json({ error: 'Missing caseId or sessionId' });
  if (!audioBase64) return res.status(400).json({ error: 'Missing audioBase64' });
  try {
    const buffer = Buffer.from(audioBase64, 'base64');
    const recording = await saveRecording(caseId, sessionId, buffer, { durationMs, mimeType });
    return res.json({ ok: true, recording });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
});

app.post('/api/case-chat/start', async (req, res) => {
  const key = openAiKeyOrError(res);
  if (!key) return;

  const { caseContext } = req.body || {};
  if (!caseContext?.id) {
    return res.status(400).json({ error: 'Missing caseContext.id' });
  }

  try {
    pruneCaseChatSessions();
    const sessionId = crypto.randomBytes(16).toString('hex');
    const systemPrompt = buildCaseChatSystemPrompt(caseContext);
    caseChatSessions.set(sessionId, {
      caseId: String(caseContext.id),
      messages: [{ role: 'system', content: systemPrompt }],
      lastUsed: Date.now(),
    });
    return res.json({ ok: true, sessionId, caseId: caseContext.id });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
});

app.post('/api/case-chat/message', async (req, res) => {
  const key = openAiKeyOrError(res);
  if (!key) return;

  const { sessionId, message } = req.body || {};
  const text = String(message || '').trim();
  if (!sessionId) return res.status(400).json({ error: 'Missing sessionId' });
  if (!text) return res.status(400).json({ error: 'Missing message' });

  const session = caseChatSessions.get(sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Chat session expired — close and reopen case chat' });
  }

  try {
    session.messages.push({ role: 'user', content: text });
    const window = session.messages.slice(0, 1).concat(session.messages.slice(-24));
    const reply = await callCaseChatCompletion(key, window);
    session.messages.push({ role: 'assistant', content: reply });
    session.lastUsed = Date.now();
    return res.json({ ok: true, reply });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
});

app.post('/api/detect-zones', async (req, res) => {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    return res.status(400).json({ error: 'Add OPENAI_API_KEY to ER doc/.env' });
  }
  const { imageBase64, mimeType = 'image/jpeg' } = req.body || {};
  if (!imageBase64) return res.status(400).json({ error: 'Missing image' });

  try {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 400,
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: VISION_PROMPT },
            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
          ],
        }],
      }),
    });
    if (!r.ok) {
      const err = await r.text();
      return res.status(r.status).json({ error: err });
    }
    const data = await r.json();
    const text = data.choices?.[0]?.message?.content || '';
    const clean = text.replace(/```json|```/g, '').trim();
    const zones = JSON.parse(clean);
    res.json({ zones });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

app.post('/api/regenerate-patient-from-case', async (req, res) => {
  const key = openAiKeyOrError(res);
  if (!key) return;

  const { imageBase64, mimeType = 'image/png', caseContext } = req.body || {};
  if (!imageBase64) return res.status(400).json({ error: 'Missing image' });
  if (!caseContext?.id) return res.status(400).json({ error: 'Missing caseContext.id' });

  try {
    const contextHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(caseContext))
      .digest('hex')
      .slice(0, 16);
    const imageHash = crypto.createHash('sha256').update(imageBase64).digest('hex').slice(0, 16);
    const fileName = `regen-case-${pad3(caseContext.id)}-${contextHash}-${imageHash}.png`;
    const outPath = path.join(SCENE_CACHE_DIR, fileName);
    const publicUrl = `http://127.0.0.1:3001/scene-cache/${fileName}`;

    try {
      await fsp.access(outPath);
      return res.json({ ok: true, cached: true, url: publicUrl, caseId: caseContext.id });
    } catch {
      // cache miss
    }

    const analysis = await analyzePatientFromCase(key, imageBase64, mimeType, caseContext);
    const prompt = buildRegeneratePatientPrompt(analysis, caseContext);
    const outB64 = await generateLikenessImage({ imageBase64, mimeType, prompt });
    await fsp.writeFile(outPath, Buffer.from(outB64, 'base64'));

    return res.json({
      ok: true,
      cached: false,
      url: publicUrl,
      dataUrl: `data:image/png;base64,${outB64}`,
      caseId: caseContext.id,
      analysis,
    });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
});

app.post('/api/generate-scene', async (req, res) => {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    return res.status(400).json({ error: 'Add OPENAI_API_KEY to ER doc/.env' });
  }

  const { imageBase64, mimeType = 'image/png', location = 'ER' } = req.body || {};
  const unit = String(location || 'ER').toUpperCase();
  if (!imageBase64) return res.status(400).json({ error: 'Missing image' });
  if (!['ER', 'OBS', 'ICU', 'WARD'].includes(unit)) {
    return res.status(400).json({ error: 'Invalid location' });
  }

  try {
    const imageHash = crypto.createHash('sha256').update(imageBase64).digest('hex');
    const fileName = `${imageHash}-${unit.toLowerCase()}.png`;
    const outPath = path.join(SCENE_CACHE_DIR, fileName);
    const publicUrl = `http://127.0.0.1:3001/scene-cache/${fileName}`;

    try {
      await fsp.access(outPath);
      return res.json({ cached: true, url: publicUrl, imageHash, location: unit });
    } catch {
      // no cache hit, continue
    }

    const prompt = `Transform this exact same patient photo into a ${unit} hospital setting.
Keep the same person, same pose, same camera angle, same bed alignment, and same likeness.
Only change environmental context and room equipment to match ${unit}.
No text overlays, no extra people, no style transfer. Photorealistic hospital scene.`;

    const form = new FormData();
    form.append('model', 'gpt-image-1');
    form.append('prompt', prompt);
    form.append('size', '1024x1024');
    form.append('response_format', 'b64_json');
    form.append('image', new Blob([Buffer.from(imageBase64, 'base64')], { type: mimeType }), 'patient.png');

    const r = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
      },
      body: form,
    });
    if (!r.ok) {
      const err = await r.text();
      return res.status(r.status).json({ error: err });
    }
    const data = await r.json();
    const outB64 = data?.data?.[0]?.b64_json;
    if (!outB64) {
      return res.status(500).json({ error: 'No image returned from OpenAI' });
    }
    await fsp.writeFile(outPath, Buffer.from(outB64, 'base64'));
    return res.json({ cached: false, url: publicUrl, imageHash, location: unit });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
});

async function generateLikenessImage({ imageBase64, mimeType, prompt }) {
  const key = process.env.OPENAI_API_KEY;
  const form = new FormData();
  form.append('model', 'gpt-image-1');
  form.append('prompt', prompt);
  form.append('size', '1024x1024');
  form.append('response_format', 'b64_json');
  form.append('image', new Blob([Buffer.from(imageBase64, 'base64')], { type: mimeType }), 'person.png');

  const r = await fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  });
  if (!r.ok) {
    const err = await r.text();
    throw new Error(`OpenAI edit failed: ${err}`);
  }
  const data = await r.json();
  const outB64 = data?.data?.[0]?.b64_json;
  if (!outB64) throw new Error('No image returned from OpenAI');
  return outB64;
}

app.post('/api/magic/create', async (req, res) => {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    return res.status(400).json({ error: 'Add OPENAI_API_KEY to ER doc/.env' });
  }
  const { imageBase64, mimeType = 'image/png', email = '', origin = '' } = req.body || {};
  if (!imageBase64) return res.status(400).json({ error: 'Missing image' });

  try {
    const token = crypto.randomBytes(18).toString('hex');
    const prompt = `Create a photorealistic hospital patient scene using the same person in this photo.
Preserve facial likeness, skin tone, age, and identity. Keep realism and dignity.
Place this person in a clinical bed scene appropriate for emergency medicine training.
No text, no watermark, no extra people, no cartoon style.`;
    const editedB64 = await generateLikenessImage({ imageBase64, mimeType, prompt });
    const payload = {
      token,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 48).toISOString(),
      email: String(email || '').trim().toLowerCase(),
      mimeType: 'image/png',
      personalizedImageBase64: editedB64,
    };
    await fsp.writeFile(path.join(MAGIC_DIR, `${token}.json`), JSON.stringify(payload, null, 2), 'utf8');

    const base = String(origin || '').startsWith('http')
      ? String(origin).replace(/\/$/, '')
      : 'http://127.0.0.1:5173';
    const magicLink = `${base}/?magic=${token}`;
    let sent = false;
    let note = 'Magic link generated.';
    if (payload.email) {
      try {
        const status = await sendMagicEmail(payload.email, magicLink);
        sent = status.sent;
        if (!sent && status.reason) note = `Magic link generated. ${status.reason}.`;
      } catch (mailErr) {
        note = `Magic link generated. Email failed: ${String(mailErr.message || mailErr)}`;
      }
    } else {
      note = 'Magic link generated. Add an email to send automatically.';
    }

    return res.json({
      ok: true,
      magicLink,
      sent,
      note,
    });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
});

app.get('/api/magic/:token', async (req, res) => {
  const { token } = req.params;
  if (!token) return res.status(400).json({ error: 'Missing token' });
  const file = path.join(MAGIC_DIR, `${token}.json`);
  try {
    const raw = await fsp.readFile(file, 'utf8');
    const payload = JSON.parse(raw);
    if (!payload?.personalizedImageBase64) {
      return res.status(404).json({ error: 'Magic token invalid' });
    }
    if (payload.expiresAt && Date.now() > Date.parse(payload.expiresAt)) {
      return res.status(410).json({ error: 'Magic link expired' });
    }
    return res.json({
      ok: true,
      mimeType: payload.mimeType || 'image/png',
      personalizedImageBase64: payload.personalizedImageBase64,
    });
  } catch {
    return res.status(404).json({ error: 'Magic link not found' });
  }
});

app.post('/api/capture-screenshot', async (req, res) => {
  const { imageBase64, caseNumber, attempt, meta = {} } = req.body || {};
  if (!imageBase64) return res.status(400).json({ error: 'Missing image' });
  if (caseNumber == null || caseNumber === '') {
    return res.status(400).json({ error: 'Missing caseNumber' });
  }
  const attemptNum = Number(attempt) || 1;
  const caseFolder = `case-${pad3(caseNumber)}`;
  const attemptFolder = `attempt-${pad3(attemptNum)}`;
  const dir = path.join(CAPTURES_DIR, caseFolder, attemptFolder);

  try {
    await fsp.mkdir(dir, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const pngName = `screenshot-${ts}.png`;
    const pngPath = path.join(dir, pngName);
    await fsp.writeFile(pngPath, Buffer.from(imageBase64, 'base64'));

    const metaPath = path.join(dir, 'meta.json');
    const payload = {
      caseNumber: String(caseNumber),
      attempt: attemptNum,
      screenshot: pngName,
      savedAt: new Date().toISOString(),
      ...meta,
    };
    await fsp.writeFile(metaPath, JSON.stringify(payload, null, 2));

    const relative = `${caseFolder}/${attemptFolder}`;
    return res.json({
      ok: true,
      relative,
      absolute: dir,
      screenshot: pngName,
      meta: metaPath,
    });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
});

const PORT = 3001;
app.listen(PORT, () => console.log(`Schoonmaker API → http://127.0.0.1:${PORT}`));
