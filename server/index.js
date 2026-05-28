import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import fsp from 'fs/promises';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../.env') });

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

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, openai: Boolean(process.env.OPENAI_API_KEY) });
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
