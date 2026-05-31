import crypto from 'crypto';
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';

export function padCaseId(caseId) {
  return String(caseId || '').padStart(3, '0');
}

/** Match Chatterbox chunking in read_case_tts.py */
export function splitIntoChunks(text = '', maxChars = 380) {
  let t = String(text).trim();
  if (!t) return [];

  const blocks = t.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  const chunks = [];

  for (const block of blocks) {
    if (block.length <= maxChars) {
      chunks.push(block);
      continue;
    }
    const parts = block.split(/(?<=[.!?])\s+/);
    let buf = '';
    for (const p of parts) {
      if (!p.trim()) continue;
      if (buf.length + p.length + 1 <= maxChars) {
        buf = `${buf} ${p}`.trim();
      } else {
        if (buf) chunks.push(buf);
        buf = p.trim();
        while (buf.length > maxChars) {
          chunks.push(buf.slice(0, maxChars));
          buf = buf.slice(maxChars).trim();
        }
      }
    }
    if (buf) chunks.push(buf);
  }

  return chunks.filter(Boolean);
}

export function hashText(text = '') {
  return crypto.createHash('sha256').update(String(text).trim()).digest('hex').slice(0, 16);
}

export function hashVoiceRef(voiceRef = '') {
  const key = String(voiceRef || 'default').trim().toLowerCase();
  return crypto.createHash('sha256').update(key).digest('hex').slice(0, 12);
}

export function caseTtsLayout({ cacheRoot, caseId, section, textHash }) {
  const id = padCaseId(caseId);
  const sec = String(section || 'hpi').toLowerCase();
  const base = path.join(cacheRoot, `case-${id}`, sec, textHash);
  return {
    base,
    manifestPath: path.join(base, 'manifest.json'),
    sourcePath: path.join(base, 'source.txt'),
    chunksDir: path.join(base, 'chunks'),
  };
}

export function chunkFileName(index) {
  return `${String(index).padStart(3, '0')}.wav`;
}

export function chunkPublicUrl({ caseId, section, textHash, fileName }) {
  const id = padCaseId(caseId);
  const sec = String(section || 'hpi').toLowerCase();
  return `/case-tts/case-${id}/${sec}/${textHash}/chunks/${fileName}`;
}

export async function readManifest(manifestPath) {
  try {
    const raw = await fsp.readFile(manifestPath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function writeManifest(manifestPath, manifest) {
  manifest.updatedAt = new Date().toISOString();
  await fsp.writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
}

export async function buildOrLoadManifest({
  cacheRoot,
  caseId,
  section,
  text,
  voiceRef = '',
}) {
  const textHash = hashText(text);
  const voiceHash = hashVoiceRef(voiceRef);
  const layout = caseTtsLayout({ cacheRoot, caseId, section, textHash });
  await fsp.mkdir(layout.chunksDir, { recursive: true });

  let manifest = await readManifest(layout.manifestPath);
  const chunkTexts = splitIntoChunks(text);

  if (
    manifest &&
    manifest.textHash === textHash &&
    manifest.voiceHash === voiceHash &&
    manifest.chunks?.length === chunkTexts.length
  ) {
    return { manifest, layout, textHash };
  }

  manifest = {
    version: 1,
    caseId: padCaseId(caseId),
    section: String(section || 'hpi').toLowerCase(),
    textHash,
    voiceHash,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    chunks: chunkTexts.map((chunkText, index) => ({
      index,
      file: chunkFileName(index),
      text: chunkText,
      status: 'pending',
      durationSec: null,
    })),
  };

  await fsp.writeFile(layout.sourcePath, String(text).trim(), 'utf8');
  await writeManifest(layout.manifestPath, manifest);
  return { manifest, layout, textHash };
}

export function syncManifestWithDisk(manifest, chunksDir) {
  for (const chunk of manifest.chunks || []) {
    const fp = path.join(chunksDir, chunk.file);
    if (fs.existsSync(fp)) {
      chunk.status = 'ready';
    }
  }
}

export function countReadyChunks(manifest, chunksDir) {
  let ready = 0;
  for (const chunk of manifest.chunks || []) {
    const fp = path.join(chunksDir, chunk.file);
    if (chunk.status === 'ready' && fs.existsSync(fp)) ready += 1;
  }
  return ready;
}

export function manifestToPlaylist(manifest, apiOrigin = '') {
  const origin = apiOrigin.replace(/\/$/, '');
  const ready = (manifest.chunks || []).filter((c) => c.status === 'ready');
  return ready.map((chunk) => ({
    index: chunk.index,
    url: `${origin}${chunkPublicUrl({
      caseId: manifest.caseId,
      section: manifest.section,
      textHash: manifest.textHash,
      fileName: chunk.file,
    })}`,
    durationSec: chunk.durationSec,
  }));
}
