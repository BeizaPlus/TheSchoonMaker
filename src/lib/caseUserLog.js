import { STORAGE } from './storageKeys.js';

const API = 'http://127.0.0.1:3001';

function readLocalChatMap() {
  try {
    const raw = localStorage.getItem(STORAGE.caseChatHistory);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeLocalChatMap(map) {
  try {
    localStorage.setItem(STORAGE.caseChatHistory, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

export function readLocalChatHistory(caseId) {
  if (caseId == null || caseId === '') return [];
  const rows = readLocalChatMap()[String(caseId)];
  return Array.isArray(rows) ? rows : [];
}

export function writeLocalChatHistory(caseId, messages) {
  if (caseId == null || caseId === '') return;
  const map = readLocalChatMap();
  map[String(caseId)] = messages;
  writeLocalChatMap(map);
}

async function apiJson(path, options = {}) {
  const r = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || `Request failed (${r.status})`);
  return data;
}

export async function fetchOverallUserStats() {
  try {
    const data = await apiJson('/api/user/stats');
    return data.stats || null;
  } catch {
    return null;
  }
}

export async function fetchCaseUserData(caseId) {
  try {
    return await apiJson(`/api/user/case/${encodeURIComponent(caseId)}`);
  } catch {
    return null;
  }
}

export async function startPlaySession(caseId, meta = {}) {
  try {
    const data = await apiJson(`/api/user/case/${encodeURIComponent(caseId)}/session/start`, {
      method: 'POST',
      body: JSON.stringify(meta),
    });
    return data.sessionId;
  } catch {
    return null;
  }
}

export async function endPlaySession(caseId, sessionId, result = {}) {
  if (!caseId || !sessionId) return null;
  try {
    return await apiJson(
      `/api/user/case/${encodeURIComponent(caseId)}/session/${encodeURIComponent(sessionId)}/end`,
      { method: 'POST', body: JSON.stringify({ result }) },
    );
  } catch {
    return null;
  }
}

export async function logPlayEvent(caseId, sessionId, event = {}) {
  if (!caseId || !sessionId) return null;
  try {
    return await apiJson(
      `/api/user/case/${encodeURIComponent(caseId)}/session/${encodeURIComponent(sessionId)}/event`,
      { method: 'POST', body: JSON.stringify({ event }) },
    );
  } catch {
    return null;
  }
}

export async function logChatMessage(caseId, sessionId, role, content) {
  const id = String(caseId || '');
  if (!id || !content) return null;

  const local = readLocalChatHistory(id);
  const row = { role, content, at: new Date().toISOString(), sessionId: sessionId || null };
  writeLocalChatHistory(id, [...local, row]);

  try {
    return await apiJson(`/api/user/case/${encodeURIComponent(id)}/chat`, {
      method: 'POST',
      body: JSON.stringify({ sessionId, role, content }),
    });
  } catch {
    return row;
  }
}

export async function uploadCaseRecording(caseId, sessionId, blob, durationMs) {
  if (!caseId || !sessionId || !blob) return null;
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  const audioBase64 = btoa(binary);
  try {
    const data = await apiJson(
      `/api/user/case/${encodeURIComponent(caseId)}/session/${encodeURIComponent(sessionId)}/recording`,
      {
        method: 'POST',
        body: JSON.stringify({
          audioBase64,
          mimeType: blob.type || 'audio/webm',
          durationMs,
        }),
      },
    );
    return data.recording || null;
  } catch {
    return null;
  }
}

export function recordingPublicUrl(relativePath) {
  if (!relativePath) return '';
  return `${API}/user-data/${relativePath.replace(/^\/+/, '')}`;
}

export async function loadPersistedChatHistory(caseId) {
  const local = readLocalChatHistory(caseId);
  if (local.length) return local;
  try {
    const data = await fetchCaseUserData(caseId);
    const remote = data?.chatHistory || [];
    if (remote.length) {
      writeLocalChatHistory(
        caseId,
        remote.map((m) => ({
          role: m.role,
          content: m.content,
          at: m.at,
          sessionId: m.sessionId,
        })),
      );
    }
    return remote.map((m) => ({ role: m.role, content: m.content, at: m.at, sessionId: m.sessionId }));
  } catch {
    return local;
  }
}
