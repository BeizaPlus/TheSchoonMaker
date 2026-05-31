#!/usr/bin/env node
/**
 * Build lightweight ICU monitor audio for fast web load.
 * Source: public/assets/audio/icu-monitor.mp3 (full ~65 min capture)
 * Outputs:
 *   icu-monitor-lite.mp3  — full session, mono 32kbps (~15 MB)
 *   icu-monitor-boot.mp3  — first 75s at 48kbps (~440 KB) for instant start
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const audioDir = path.join(root, 'public', 'assets', 'audio');
const source = path.join(audioDir, 'icu-monitor.mp3');

function runFfmpeg(args) {
  const result = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', ...args], {
    stdio: 'inherit',
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

if (!fs.existsSync(source)) {
  console.error('Missing source file:', source);
  console.error('Download first: yt-dlp -x --audio-format mp3 -o icu-monitor.%(ext)s <youtube-url>');
  process.exit(1);
}

const lite = path.join(audioDir, 'icu-monitor-lite.mp3');
const boot = path.join(audioDir, 'icu-monitor-boot.mp3');

console.log('→ icu-monitor-lite.mp3 (mono 32kbps, full length)');
runFfmpeg(['-y', '-i', source, '-ac', '1', '-b:a', '32k', lite]);

console.log('→ icu-monitor-boot.mp3 (first 75s, mono 48kbps)');
runFfmpeg(['-y', '-i', source, '-t', '75', '-ac', '1', '-b:a', '48k', boot]);

for (const file of [lite, boot]) {
  const mb = (fs.statSync(file).size / (1024 * 1024)).toFixed(2);
  console.log(`  ${path.basename(file)} — ${mb} MB`);
}

console.log('Done. App uses lite + boot; keep icu-monitor.mp3 local only (gitignored).');
