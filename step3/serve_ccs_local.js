/**
 * Local server: replays cached .webapi + static files from ccs_mirror/
 * Missing requests can forward to live site (hybrid mode).
 *
 * Open: http://localhost:8765
 */
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { loadResponse, listCached, MIRROR_DIR } = require('./ccs_cache_lib');

const PORT = 8765;
const LIVE_HOST = 'app.ccscases.com';
const HYBRID = process.env.CCS_HYBRID !== '0'; // set CCS_HYBRID=0 for offline-only

function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];

    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

function proxyToLive(method, pathname, query, headers, body) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: LIVE_HOST,
      port: 443,
      path: pathname + query,
      method,
      headers: {
        ...headers,
        host: LIVE_HOST,
        origin: `https://${LIVE_HOST}`,
        referer: `https://${LIVE_HOST}/`
      }
    };

    const r = https.request(options, (res) => {
      const chunks = [];

      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: Buffer.concat(chunks)
        });
      });
    });

    r.on('error', reject);
    if (body.length) r.write(body);
    r.end();
  });
}

function send(res, status, headers, body) {
  const h = {};

  for (const [k, v] of Object.entries(headers || {})) {
    const key = k.toLowerCase();

    if (['transfer-encoding', 'content-encoding', 'connection', 'keep-alive'].includes(key)) {
      continue;
    }

    h[key] = v;
  }

  h['content-length'] = String(body.length);

  res.writeHead(status, h);
  res.end(body);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;
  const query = url.search;
  const body = await readBody(req);

  const cached = loadResponse(req.method, pathname, body.toString());

  if (cached) {
    return send(res, cached.status, cached.headers, cached.body);
  }

  if (HYBRID) {
    try {
      const live = await proxyToLive(req.method, pathname, query, req.headers, body);
      const { saveResponse } = require('./ccs_cache_lib');

      saveResponse(req.method, `https://${LIVE_HOST}${pathname}`, body.toString(), live.status, live.headers, live.body);
      console.log('live+saved', req.method, pathname);

      return send(res, live.status, live.headers, live.body);
    } catch (e) {
      console.error('proxy error', pathname, e.message);
    }
  }

  res.writeHead(404, { 'content-type': 'text/plain' });
  res.end(`Not cached: ${req.method} ${pathname}\nRecord with: node record_ccs_cache.js`);
});

server.listen(PORT, () => {
  const n = listCached().length;

  console.log(`CCS local proxy: http://localhost:${PORT}`);
  console.log(`Cached responses: ${n} files in ${MIRROR_DIR}`);
  console.log(HYBRID ? 'Hybrid ON — misses fetch live site and cache automatically' : 'Offline only — misses return 404');
  console.log('\nNote: Open localhost in browser. Login/cases only work for APIs you already recorded.');
});
