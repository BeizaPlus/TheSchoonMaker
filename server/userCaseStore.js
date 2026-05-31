import path from 'path';
import fs from 'fs';
import fsp from 'fs/promises';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const USER_ROOT = path.join(__dirname, '../user-data');
const USER_CASES_DIR = path.join(USER_ROOT, 'cases');
const USER_RECORDINGS_DIR = path.join(USER_ROOT, 'recordings');

export function ensureUserDirs() {
  for (const dir of [USER_ROOT, USER_CASES_DIR, USER_RECORDINGS_DIR]) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }
}

function caseFilePath(caseId) {
  return path.join(USER_CASES_DIR, `${String(caseId).padStart(3, '0')}.json`);
}

function defaultCaseUser(caseId, meta = {}) {
  return {
    caseId: String(caseId),
    caseNumber: meta.caseNumber ?? caseId,
    title: meta.title || '',
    diagnosis: meta.diagnosis || null,
    updatedAt: new Date().toISOString(),
    stats: {
      sessions: 0,
      chatMessages: 0,
      recordings: 0,
      noteEvents: 0,
      stacksPlaced: 0,
      bestAccuracy: 0,
      lastPlayedAt: null,
    },
    chatHistory: [],
    sessions: [],
  };
}

export async function readCaseUser(caseId) {
  ensureUserDirs();
  try {
    const raw = await fsp.readFile(caseFilePath(caseId), 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function writeCaseUser(caseId, data) {
  ensureUserDirs();
  const next = { ...data, updatedAt: new Date().toISOString() };
  await fsp.writeFile(caseFilePath(caseId), JSON.stringify(next, null, 2), 'utf8');
  return next;
}

export async function getOrCreateCaseUser(caseId, meta = {}) {
  let data = (await readCaseUser(caseId)) || defaultCaseUser(caseId, meta);
  if (meta.title) data.title = meta.title;
  if (meta.caseNumber != null) data.caseNumber = meta.caseNumber;
  if (meta.diagnosis != null) data.diagnosis = meta.diagnosis;
  return data;
}

export async function startCaseSession(caseId, meta = {}) {
  const data = await getOrCreateCaseUser(caseId, meta);
  const sessionId = crypto.randomBytes(12).toString('hex');
  const startedAt = new Date().toISOString();
  const session = {
    id: sessionId,
    startedAt,
    endedAt: null,
    attempt: data.sessions.length + 1,
    result: null,
    timeline: [{ at: startedAt, type: 'session_start', attempt: data.sessions.length + 1 }],
    recordings: [],
  };
  data.sessions.push(session);
  data.stats.sessions = data.sessions.length;
  data.stats.lastPlayedAt = startedAt;
  await writeCaseUser(caseId, data);
  return { sessionId, attempt: session.attempt, session, data };
}

export async function appendTimelineEvent(caseId, sessionId, event = {}) {
  const data = await readCaseUser(caseId);
  if (!data) return null;
  const session = data.sessions.find((s) => s.id === sessionId);
  if (!session) return null;
  const entry = { at: new Date().toISOString(), ...event };
  session.timeline.push(entry);
  if (event.type === 'note') data.stats.noteEvents = (data.stats.noteEvents || 0) + 1;
  if (event.type === 'stack') data.stats.stacksPlaced = (data.stats.stacksPlaced || 0) + 1;
  await writeCaseUser(caseId, data);
  return entry;
}

export async function appendChatHistory(caseId, sessionId, role, content) {
  const data = await getOrCreateCaseUser(caseId);
  const msg = {
    at: new Date().toISOString(),
    sessionId: sessionId || null,
    role,
    content: String(content || ''),
  };
  if (!Array.isArray(data.chatHistory)) data.chatHistory = [];
  data.chatHistory.push(msg);
  data.stats.chatMessages = data.chatHistory.length;
  if (sessionId) {
    const session = data.sessions.find((s) => s.id === sessionId);
    if (session) {
      session.timeline.push({ at: msg.at, type: 'chat', role, text: msg.content });
    }
  }
  await writeCaseUser(caseId, data);
  return msg;
}

export async function endCaseSession(caseId, sessionId, result = {}) {
  const data = await readCaseUser(caseId);
  if (!data) return null;
  const session = data.sessions.find((s) => s.id === sessionId);
  if (!session || session.endedAt) return session;
  session.endedAt = new Date().toISOString();
  session.result = result;
  session.timeline.push({ at: session.endedAt, type: 'session_end', result });
  if (result.accuracy != null) {
    data.stats.bestAccuracy = Math.max(data.stats.bestAccuracy || 0, Number(result.accuracy) || 0);
  }
  data.stats.lastPlayedAt = session.endedAt;
  await writeCaseUser(caseId, data);
  return session;
}

export async function saveRecording(caseId, sessionId, buffer, { durationMs, mimeType }) {
  ensureUserDirs();
  const recId = crypto.randomBytes(8).toString('hex');
  const caseDir = path.join(USER_RECORDINGS_DIR, String(caseId).padStart(3, '0'));
  if (!fs.existsSync(caseDir)) fs.mkdirSync(caseDir, { recursive: true });
  const ext = mimeType?.includes('mp4') ? 'mp4' : 'webm';
  const filename = `${recId}.${ext}`;
  const relPath = `recordings/${String(caseId).padStart(3, '0')}/${filename}`;
  await fsp.writeFile(path.join(caseDir, filename), buffer);

  const data = await readCaseUser(caseId);
  if (!data) return null;
  const rec = {
    id: recId,
    at: new Date().toISOString(),
    durationMs: durationMs || 0,
    mimeType: mimeType || 'audio/webm',
    file: relPath,
  };
  const session = data.sessions.find((s) => s.id === sessionId);
  if (session) {
    session.recordings.push(rec);
    session.timeline.push({
      at: rec.at,
      type: 'recording',
      recordingId: recId,
      durationMs: rec.durationMs,
      file: relPath,
    });
  }
  data.stats.recordings = (data.stats.recordings || 0) + 1;
  await writeCaseUser(caseId, data);
  return rec;
}

export async function getOverallStats() {
  ensureUserDirs();
  let files = [];
  try {
    files = await fsp.readdir(USER_CASES_DIR);
  } catch {
    return {
      casesWithData: 0,
      totalSessions: 0,
      totalChatMessages: 0,
      totalRecordings: 0,
      totalNoteEvents: 0,
      totalStacksPlaced: 0,
      lastPlayedAt: null,
    };
  }

  const agg = {
    casesWithData: 0,
    totalSessions: 0,
    totalChatMessages: 0,
    totalRecordings: 0,
    totalNoteEvents: 0,
    totalStacksPlaced: 0,
    lastPlayedAt: null,
  };

  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    try {
      const data = JSON.parse(await fsp.readFile(path.join(USER_CASES_DIR, file), 'utf8'));
      agg.casesWithData += 1;
      agg.totalSessions += data.stats?.sessions || 0;
      agg.totalChatMessages += data.stats?.chatMessages || 0;
      agg.totalRecordings += data.stats?.recordings || 0;
      agg.totalNoteEvents += data.stats?.noteEvents || 0;
      agg.totalStacksPlaced += data.stats?.stacksPlaced || 0;
      if (
        data.stats?.lastPlayedAt &&
        (!agg.lastPlayedAt || data.stats.lastPlayedAt > agg.lastPlayedAt)
      ) {
        agg.lastPlayedAt = data.stats.lastPlayedAt;
      }
    } catch {
      /* skip corrupt file */
    }
  }
  return agg;
}
