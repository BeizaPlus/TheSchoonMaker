import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import fsp from 'fs/promises';
import crypto from 'crypto';
import { spawn } from 'child_process';
import nodemailer from 'nodemailer';
import { fileURLToPath } from 'url';
import {
  buildOrLoadManifest,
  countReadyChunks,
  manifestToPlaylist,
  readManifest,
  syncManifestWithDisk,
} from './caseTtsCache.js';
import {
  appendChatHistory,
  appendTimelineEvent,
  endCaseSession,
  getOverallStats,
  readCaseUser,
  saveRecording,
  startCaseSession,
} from './userCaseStore.js';
import { chatCompletion, chatAvailableSync, llmHealthSnapshot, pingOllama } from './llmProvider.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GAME_ROOT = path.join(__dirname, '..');
const REPO_ROOT = path.join(__dirname, '../..');
const PORT = Number(process.env.SPORTMAKER_API_PORT || 3001);
dotenv.config({ path: path.join(GAME_ROOT, '.env') });
dotenv.config({ path: path.join(REPO_ROOT, '.env') });

const app = express();
app.use(cors());
app.use(express.json({ limit: '12mb' }));

const SCENE_CACHE_DIR = path.join(GAME_ROOT, '.scene-cache');
if (!fs.existsSync(SCENE_CACHE_DIR)) {
  fs.mkdirSync(SCENE_CACHE_DIR, { recursive: true });
}
app.use('/scene-cache', express.static(SCENE_CACHE_DIR));

const CAPTURES_DIR = path.join(GAME_ROOT, 'captures');
if (!fs.existsSync(CAPTURES_DIR)) {
  fs.mkdirSync(CAPTURES_DIR, { recursive: true });
}
const MAGIC_DIR = path.join(GAME_ROOT, '.magic-links');
if (!fs.existsSync(MAGIC_DIR)) {
  fs.mkdirSync(MAGIC_DIR, { recursive: true });
}

const CASE_TTS_DIR = path.join(GAME_ROOT, '.case-tts-cache');
if (!fs.existsSync(CASE_TTS_DIR)) {
  fs.mkdirSync(CASE_TTS_DIR, { recursive: true });
}
app.use('/case-tts', express.static(CASE_TTS_DIR));

const CHATTERBOX_ROOT = process.env.CHATTERBOX_ROOT || path.join(process.env.USERPROFILE || process.env.HOME || '', 'chatterbox');
const CHATTERBOX_PYTHON =
  process.env.CHATTERBOX_PYTHON ||
  path.join(CHATTERBOX_ROOT, '.venv', 'Scripts', 'python.exe');
const READ_CASE_SCRIPT = path.join(GAME_ROOT, 'tools', 'chatterbox', 'read_case_tts.py');

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

const caseChatSessions = new Map();

function chatProviderOrError(res) {
  if (!chatAvailableSync()) {
    res.status(400).json({
      error:
        'No chat LLM configured. Add OPENAI_API_KEY to .env or run Ollama locally (ollama serve — Llama already installed).',
    });
    return false;
  }
  return true;
}

function extractJsonObject(text) {
  const raw = String(text || '').trim();
  try {
    return JSON.parse(raw);
  } catch {
    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenced) {
      try {
        return JSON.parse(fenced[1].trim());
      } catch {
        /* continue */
      }
    }
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(raw.slice(start, end + 1));
    }
    throw new Error('LLM did not return valid JSON');
  }
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

const FAL_SCENE_MODEL = process.env.FAL_SCENE_MODEL || 'fal-ai/joyai-image-edit';

function sceneImageProvider() {
  const pref = String(process.env.SCENE_IMAGE_PROVIDER || 'auto').toLowerCase();
  if (pref === 'openai') return 'openai';
  if (pref === 'fal') return process.env.FAL_KEY ? 'fal' : 'openai';
  if (process.env.FAL_KEY) return 'fal';
  return process.env.OPENAI_API_KEY ? 'openai' : null;
}

async function downloadImageAsBase64(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Failed to download fal image (${r.status})`);
  const buf = Buffer.from(await r.arrayBuffer());
  return buf.toString('base64');
}

function extractFalImageUrl(payload) {
  if (!payload || typeof payload !== 'object') return null;
  const images = payload.images || payload.image || payload.output?.images;
  if (Array.isArray(images) && images[0]?.url) return images[0].url;
  if (typeof payload.url === 'string') return payload.url;
  if (typeof payload.image?.url === 'string') return payload.image.url;
  return null;
}

async function generateSceneWithFal({ imageBase64, mimeType, prompt }) {
  const key = process.env.FAL_KEY;
  if (!key) throw new Error('FAL_KEY not configured');

  const r = await fetch(`https://fal.run/${FAL_SCENE_MODEL}`, {
    method: 'POST',
    headers: {
      Authorization: `Key ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt,
      image_url: `data:${mimeType};base64,${imageBase64}`,
    }),
  });

  if (!r.ok) {
    const err = await r.text();
    throw new Error(`fal scene failed: ${err || r.status}`);
  }

  const data = await r.json();
  const imageUrl = extractFalImageUrl(data);
  if (!imageUrl) throw new Error('No image returned from fal');
  return downloadImageAsBase64(imageUrl);
}

async function generateSceneWithOpenAI({ imageBase64, mimeType, prompt }) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY not configured');

  const form = new FormData();
  form.append('model', 'gpt-image-1');
  form.append('prompt', prompt);
  form.append('size', '1024x1024');
  form.append('response_format', 'b64_json');
  form.append('image', new Blob([Buffer.from(imageBase64, 'base64')], { type: mimeType }), 'patient.png');

  const r = await fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  });
  if (!r.ok) {
    const err = await r.text();
    throw new Error(`OpenAI edit failed: ${err || r.status}`);
  }
  const data = await r.json();
  const outB64 = data?.data?.[0]?.b64_json;
  if (!outB64) throw new Error('No image returned from OpenAI');
  return outB64;
}

async function generateSceneImage({ imageBase64, mimeType, prompt }) {
  const provider = sceneImageProvider();
  if (!provider) throw new Error('Add FAL_KEY or OPENAI_API_KEY to ER doc/.env');
  if (provider === 'fal') {
    try {
      return { outB64: await generateSceneWithFal({ imageBase64, mimeType, prompt }), provider: 'fal' };
    } catch (falErr) {
      if (!process.env.OPENAI_API_KEY) throw falErr;
      console.warn('[generate-scene] fal failed, falling back to OpenAI:', falErr.message);
    }
  }
  return {
    outB64: await generateSceneWithOpenAI({ imageBase64, mimeType, prompt }),
    provider: 'openai',
  };
}

app.get('/api/health', async (_req, res) => {
  const scriptReady = fs.existsSync(READ_CASE_SCRIPT);
  const pythonReady = fs.existsSync(CHATTERBOX_PYTHON);
  const llm = llmHealthSnapshot();
  const ollamaReachable = llm.ollama ? await pingOllama() : false;
  res.json({
    ok: true,
    openai: llm.openai,
    ollama: llm.ollama,
    ollamaReachable,
    ollamaModel: llm.ollamaModel,
    llmProvider: llm.llmProvider,
    chatAvailable: llm.chatAvailable && (llm.openai || ollamaReachable),
    fal: Boolean(process.env.FAL_KEY),
    sceneProvider: sceneImageProvider(),
    falSceneModel: FAL_SCENE_MODEL,
    chatterbox: pythonReady && scriptReady,
    chatterboxPython: CHATTERBOX_PYTHON,
    readCaseScript: READ_CASE_SCRIPT,
    readCaseScriptFound: scriptReady,
    gameRoot: GAME_ROOT,
  });
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
  if (!chatProviderOrError(res)) return;

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
  if (!chatProviderOrError(res)) return;

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
    const { reply, provider } = await chatCompletion(window, { maxTokens: 700 });
    session.messages.push({ role: 'assistant', content: reply || 'No response.' });
    session.lastUsed = Date.now();
    return res.json({ ok: true, reply, provider });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
});

function runReadCaseTts({ cacheDir, voiceRef }) {
  return new Promise((resolve, reject) => {
    const args = [READ_CASE_SCRIPT, '--cache-dir', cacheDir];
    if (voiceRef) {
      args.push('--voice-ref', voiceRef);
    }
    const child = spawn(CHATTERBOX_PYTHON, args, {
      cwd: path.dirname(READ_CASE_SCRIPT),
      env: {
        ...process.env,
        CHATTERBOX_ROOT,
        PYTHONUNBUFFERED: '1',
      },
      windowsHide: true,
    });
    let stderr = '';
    child.stderr.on('data', (d) => {
      stderr += String(d);
    });
    child.on('error', (err) => reject(err));
    child.on('close', (code) => {
      if (code === 0) resolve(stderr);
      else reject(new Error(stderr.trim() || `Chatterbox exited ${code}`));
    });
  });
}

app.post('/api/read-case', async (req, res) => {
  const { caseId = '', section = 'hpi', text = '' } = req.body || {};
  const trimmed = String(text).trim();
  if (!trimmed) {
    return res.status(400).json({ error: 'Missing text' });
  }
  if (!fs.existsSync(CHATTERBOX_PYTHON)) {
    return res.status(503).json({
      error: `Chatterbox Python not found at ${CHATTERBOX_PYTHON}. Set CHATTERBOX_PYTHON in .env`,
    });
  }
  if (!fs.existsSync(READ_CASE_SCRIPT)) {
    return res.status(503).json({ error: 'Missing tools/chatterbox/read_case_tts.py' });
  }

  const voiceRef = process.env.CHATTERBOX_VOICE_REF || '';
  const apiOrigin = `http://127.0.0.1:${PORT}`;

  try {
    const { manifest, layout } = await buildOrLoadManifest({
      cacheRoot: CASE_TTS_DIR,
      caseId,
      section,
      text: trimmed.slice(0, 12000),
      voiceRef,
    });
    syncManifestWithDisk(manifest, layout.chunksDir);

    const readyBefore = countReadyChunks(manifest, layout.chunksDir);
    const total = manifest.chunks.length;
    const needsGeneration = readyBefore < total;

    if (needsGeneration) {
      await runReadCaseTts({ cacheDir: layout.base, voiceRef });
      const updated = await readManifest(layout.manifestPath);
      if (updated) Object.assign(manifest, updated);
      syncManifestWithDisk(manifest, layout.chunksDir);
    }

    const playlist = manifestToPlaylist(manifest, apiOrigin);

    return res.json({
      playlist,
      cached: readyBefore === total,
      partial: readyBefore > 0 && readyBefore < total,
      ready: playlist.length,
      total,
      cachePath: layout.base,
    });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e).slice(0, 600) });
  }
});

app.get('/api/read-case/status', async (req, res) => {
  const caseId = req.query.caseId || '';
  const section = req.query.section || 'hpi';
  const text = String(req.query.text || '').trim();
  if (!text) return res.status(400).json({ error: 'Missing text' });

  try {
    const voiceRef = process.env.CHATTERBOX_VOICE_REF || '';
    const { manifest, layout } = await buildOrLoadManifest({
      cacheRoot: CASE_TTS_DIR,
      caseId,
      section,
      text: text.slice(0, 12000),
      voiceRef,
    });
    syncManifestWithDisk(manifest, layout.chunksDir);
    const ready = countReadyChunks(manifest, layout.chunksDir);
    const playlist = manifestToPlaylist(manifest, `http://127.0.0.1:${PORT}`);
    return res.json({
      ready,
      total: manifest.chunks.length,
      complete: ready === manifest.chunks.length,
      playlist,
      cachePath: layout.base,
    });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e).slice(0, 400) });
  }
});

app.post('/api/refine-narrative', async (req, res) => {
  if (!chatProviderOrError(res)) return;

  const {
    rawText = '',
    playRole = 'doctor',
    title = '',
    category = '',
    clinicalTip = '',
    objective = '',
  } = req.body || {};

  if (!String(rawText).trim()) {
    return res.status(400).json({ error: 'Missing rawText' });
  }

  const voice =
    playRole === 'patient'
      ? 'first-person patient voice (I/me/my), consistent grammar'
      : 'third-person clinical charting (the patient...), consistent grammar';

  try {
    const { reply, provider } = await chatCompletion(
      [
        {
          role: 'system',
          content: `You clean CCS case presentation text for a medical training game. Return JSON only.
- Fix grammar, pronouns, and flow. Remove chart tab junk and screenshot references.
- Use clear section breaks in hpi (HPI, PMH, meds, allergies, social, ROS).
- ${voice}
- Do not invent new clinical facts.`,
        },
        {
          role: 'user',
          content: `Case: ${title} (${category})
Clinical tip: ${clinicalTip}
Objective: ${objective}

Raw text:
${String(rawText).slice(0, 6000)}

Return JSON:
{
  "intro": "one-line chief complaint / opening",
  "hpi": "full formatted narrative with section breaks",
  "vitalsText": "clean vitals paragraph or empty",
  "clinicalTip": "optional cleaned tip",
  "objective": "optional cleaned objective"
}`,
        },
      ],
      { maxTokens: 2200, jsonMode: true },
    );
    const parsed = extractJsonObject(reply);
    res.json({ ...parsed, provider });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
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

app.post('/api/generate-scene', async (req, res) => {
  if (!sceneImageProvider()) {
    return res.status(400).json({ error: 'Add FAL_KEY or OPENAI_API_KEY to ER doc/.env' });
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

    const { outB64, provider } = await generateSceneImage({ imageBase64, mimeType, prompt });
    await fsp.writeFile(outPath, Buffer.from(outB64, 'base64'));
    return res.json({ cached: false, url: publicUrl, imageHash, location: unit, provider });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
});

async function generateLikenessImage({ imageBase64, mimeType, prompt }) {
  if (process.env.FAL_KEY && sceneImageProvider() === 'fal') {
    try {
      return await generateSceneWithFal({ imageBase64, mimeType, prompt });
    } catch (falErr) {
      if (!process.env.OPENAI_API_KEY) throw falErr;
      console.warn('[magic/create] fal failed, falling back to OpenAI:', falErr.message);
    }
  }
  return generateSceneWithOpenAI({ imageBase64, mimeType, prompt });
}

app.post('/api/magic/create', async (req, res) => {
  if (!sceneImageProvider()) {
    return res.status(400).json({ error: 'Add FAL_KEY or OPENAI_API_KEY to ER doc/.env' });
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

app.listen(PORT, () => console.log(`Schoonmaker API → http://127.0.0.1:${PORT}`));
