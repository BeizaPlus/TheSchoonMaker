const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const MIRROR_DIR = path.join(__dirname, 'ccs_mirror');

function ensureMirror() {
  if (!fs.existsSync(MIRROR_DIR)) fs.mkdirSync(MIRROR_DIR, { recursive: true });
}

function bodyHash(body) {
  return crypto.createHash('sha256').update(body || '').digest('hex').slice(0, 16);
}

function cacheFilePath(method, pathname, postBody) {
  const safePath = pathname.replace(/^\//, '').replace(/\//g, '__') || 'root';
  const hash = method === 'POST' || method === 'PUT' ? bodyHash(postBody) : '';
  const name = `${method}__${safePath}${hash ? '__' + hash : ''}.json`;

  return path.join(MIRROR_DIR, name);
}

function saveResponse(method, url, postBody, status, headers, bodyBuffer) {
  ensureMirror();
  const { pathname } = new URL(url);
  const file = cacheFilePath(method, pathname, postBody);

  const entry = {
    method,
    url,
    pathname,
    status,
    headers,
    bodyBase64: bodyBuffer.toString('base64'),
    savedAt: new Date().toISOString()
  };

  fs.writeFileSync(file, JSON.stringify(entry, null, 2));
  return file;
}

function loadResponse(method, pathname, postBody) {
  const file = cacheFilePath(method, pathname, postBody);

  if (!fs.existsSync(file)) return null;

  const entry = JSON.parse(fs.readFileSync(file, 'utf8'));

  return {
    status: entry.status,
    headers: entry.headers,
    body: Buffer.from(entry.bodyBase64, 'base64')
  };
}

function listCached() {
  ensureMirror();

  return fs.readdirSync(MIRROR_DIR).filter((f) => f.endsWith('.json'));
}

module.exports = {
  MIRROR_DIR,
  saveResponse,
  loadResponse,
  listCached,
  bodyHash,
  cacheFilePath
};
