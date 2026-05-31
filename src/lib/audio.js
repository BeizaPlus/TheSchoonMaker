import { readAudioPrefs, patchAudioPrefs } from './audioPrefs.js';
import { STORAGE } from './storageKeys.js';

const AUDIO_SUPPORTED = typeof AudioContext !== 'undefined' || typeof webkitAudioContext !== 'undefined';
const ICU_MONITOR_LITE = '/assets/audio/icu-monitor-lite.mp3';
const ICU_MONITOR_BOOT = '/assets/audio/icu-monitor-boot.mp3';

let bootEl = null;
let sessionEl = null;
let monitorEl = null;
let usingBoot = false;
let sessionReady = false;
let audioCtx = null;
let monitorGain = null;
let monitorSource = null;
let fadeRaf = null;
let blocked = false;
let playing = false;
let positionHooked = false;
const prefListeners = new Set();
const stateListeners = new Set();

function getSfxGain() {
  return readAudioPrefs().sfxVolume;
}

function tone(freq, durMs, type = 'sine', gain = 0.06) {
  if (!AUDIO_SUPPORTED) return;
  const Ctx = AudioContext || webkitAudioContext;
  const ctx = new Ctx();
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.value = gain * getSfxGain();
  osc.connect(g);
  g.connect(ctx.destination);
  osc.start();
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + durMs / 1000);
  setTimeout(() => {
    try {
      osc.stop();
      ctx.close();
    } catch {
      /* ignore */
    }
  }, durMs + 30);
}

function readSavedPosition() {
  if (typeof window === 'undefined') return 0;
  try {
    const raw = sessionStorage.getItem(STORAGE.monitorPosition);
    const value = Number(raw);
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
}

function writeSavedPosition(seconds) {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(STORAGE.monitorPosition, String(Math.max(0, seconds)));
  } catch {
    /* ignore */
  }
}

function clearSavedPosition() {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(STORAGE.monitorPosition);
  } catch {
    /* ignore */
  }
}

function restoreSavedPosition(el) {
  const saved = readSavedPosition();
  if (!saved || !el.duration || saved >= el.duration - 2) return;
  el.currentTime = saved;
}

function hookMonitorPosition(el) {
  if (positionHooked) return;
  positionHooked = true;

  el.addEventListener('loadedmetadata', () => restoreSavedPosition(el), { once: true });

  let lastSavedSecond = -1;
  el.addEventListener('timeupdate', () => {
    const sec = Math.floor(el.currentTime);
    if (sec !== lastSavedSecond && sec % 4 === 0) {
      lastSavedSecond = sec;
      writeSavedPosition(el.currentTime);
    }
  });

  el.addEventListener('ended', () => {
    writeSavedPosition(0);
    el.currentTime = 0;
    const replay = el.play();
    if (replay?.catch) {
      replay.catch(() => {
        blocked = true;
        playing = false;
        notifyStateListeners();
      });
    }
  });
}

function getBootElement() {
  if (!bootEl) {
    bootEl = new Audio(ICU_MONITOR_BOOT);
    bootEl.loop = true;
    bootEl.preload = 'auto';
  }
  return bootEl;
}

function getSessionElement() {
  if (!sessionEl) {
    sessionEl = new Audio(ICU_MONITOR_LITE);
    sessionEl.loop = false;
    sessionEl.preload = 'none';
    sessionEl.crossOrigin = 'anonymous';
    hookMonitorPosition(sessionEl);
  }
  return sessionEl;
}

function isSessionBuffered() {
  const session = getSessionElement();
  return sessionReady || session.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA;
}

function ensureMonitorGraph() {
  if (!AUDIO_SUPPORTED) return null;
  if (audioCtx) return audioCtx;
  const Ctx = AudioContext || webkitAudioContext;
  audioCtx = new Ctx();
  const el = getSessionElement();
  try {
    monitorSource = audioCtx.createMediaElementSource(el);
    monitorGain = audioCtx.createGain();
    monitorSource.connect(monitorGain);
    monitorGain.connect(audioCtx.destination);
  } catch {
    /* already connected after hot reload */
  }
  return audioCtx;
}

function targetMonitorVolume() {
  const prefs = readAudioPrefs();
  if (prefs.monitorMuted) return 0;
  return Math.max(0, Math.min(1, prefs.monitorVolume));
}

function notifyPrefListeners() {
  prefListeners.forEach((fn) => fn(readAudioPrefs()));
}

function notifyStateListeners() {
  stateListeners.forEach((fn) => fn(getMonitorState()));
}

export function getMonitorState() {
  const el = usingBoot ? bootEl : sessionEl;
  return {
    blocked,
    playing,
    booting: usingBoot,
    sessionReady,
    src: usingBoot ? ICU_MONITOR_BOOT : ICU_MONITOR_LITE,
    currentTime: el?.currentTime ?? 0,
    duration: el?.duration ?? 0,
  };
}

export function subscribeAudioPrefs(listener) {
  prefListeners.add(listener);
  return () => prefListeners.delete(listener);
}

export function subscribeMonitorState(listener) {
  stateListeners.add(listener);
  listener(getMonitorState());
  return () => stateListeners.delete(listener);
}

/** Preload the tiny boot clip immediately; buffer the full lite track in background. */
export function prefetchMonitorAudio() {
  getBootElement();
  const session = getSessionElement();
  if (session.preload !== 'none') return;
  session.preload = 'auto';
  session.load();
  session.addEventListener(
    'canplaythrough',
    () => {
      sessionReady = true;
      if (usingBoot && playing) {
        swapBootToSession({ fadeMs: 1000 }).catch(() => {});
      }
      notifyStateListeners();
    },
    { once: true },
  );
}

function cancelFade() {
  if (fadeRaf) {
    cancelAnimationFrame(fadeRaf);
    fadeRaf = null;
  }
}

function setSessionGain(value) {
  const vol = Math.max(0, Math.min(1, value));
  ensureMonitorGraph();
  if (monitorGain) {
    monitorGain.gain.value = vol;
  } else {
    getSessionElement().volume = vol;
  }
}

function setBootVolume(value) {
  if (!bootEl) return;
  bootEl.volume = Math.max(0, Math.min(1, value));
}

function setOutputVolume(value) {
  if (usingBoot) {
    setBootVolume(value);
    setSessionGain(0);
  } else {
    setBootVolume(0);
    setSessionGain(value);
  }
}

function fadeVolume(to, ms = 1400) {
  cancelFade();
  const from = usingBoot ? (bootEl?.volume ?? 0) : (monitorGain?.gain.value ?? 0);
  if (ms <= 0 || Math.abs(from - to) < 0.01) {
    setOutputVolume(to);
    return Promise.resolve();
  }
  const t0 = performance.now();
  return new Promise((resolve) => {
    const step = (now) => {
      const t = Math.min(1, (now - t0) / ms);
      const eased = t * t * (3 - 2 * t);
      setOutputVolume(from + (to - from) * eased);
      if (t < 1) {
        fadeRaf = requestAnimationFrame(step);
      } else {
        fadeRaf = null;
        resolve();
      }
    };
    fadeRaf = requestAnimationFrame(step);
  });
}

async function swapBootToSession({ fadeMs = 1000 } = {}) {
  const boot = getBootElement();
  const session = getSessionElement();
  const target = targetMonitorVolume();
  const saved = readSavedPosition();

  if (saved > 0 && session.duration && saved < session.duration - 2) {
    session.currentTime = saved;
  } else if (boot.currentTime > 0) {
    session.currentTime = boot.currentTime % Math.max(session.duration || 75, 75);
  }

  ensureMonitorGraph();
  usingBoot = false;
  monitorEl = sessionEl;

  try {
    await session.play();
  } catch {
    blocked = true;
    playing = false;
    notifyStateListeners();
    return;
  }

  blocked = false;
  playing = true;

  const bootStart = boot.volume;
  setSessionGain(0);
  const t0 = performance.now();
  await new Promise((resolve) => {
    const step = (now) => {
      const t = Math.min(1, (now - t0) / fadeMs);
      const eased = t * t * (3 - 2 * t);
      boot.volume = bootStart * (1 - eased);
      setSessionGain(target * eased);
      if (t < 1) {
        requestAnimationFrame(step);
      } else {
        boot.pause();
        boot.currentTime = 0;
        setBootVolume(0);
        setSessionGain(target);
        resolve();
      }
    };
    requestAnimationFrame(step);
  });
  notifyStateListeners();
}

function playBootTrack({ fadeMs, target }) {
  const boot = getBootElement();
  usingBoot = true;
  monitorEl = bootEl;
  setSessionGain(0);
  if (fadeMs > 0) setBootVolume(0);
  else setBootVolume(target);

  return Promise.resolve(boot.play())
    .then(async () => {
      blocked = false;
      playing = true;
      notifyStateListeners();
      if (isSessionBuffered()) {
        await swapBootToSession({ fadeMs: Math.min(fadeMs || 800, 1000) });
        return undefined;
      }
      if (fadeMs > 0 && target > 0) {
        await fadeVolume(target, fadeMs);
      }
      return undefined;
    })
    .catch(() => {
      blocked = true;
      playing = false;
      notifyStateListeners();
    });
}

function playSessionTrack({ fadeMs, target }) {
  const session = getSessionElement();
  usingBoot = false;
  monitorEl = sessionEl;
  ensureMonitorGraph();

  if (fadeMs > 0) setSessionGain(0);
  else setSessionGain(target);
  setBootVolume(0);

  return Promise.resolve(session.play())
    .then(async () => {
      blocked = false;
      playing = true;
      notifyStateListeners();
      if (fadeMs > 0 && target > 0) {
        await fadeVolume(target, fadeMs);
      } else {
        setSessionGain(target);
      }
      return undefined;
    })
    .catch(() => {
      blocked = true;
      playing = false;
      notifyStateListeners();
    });
}

export async function unlockAmbience() {
  prefetchMonitorAudio();
  ensureMonitorGraph();
  if (audioCtx?.state === 'suspended') {
    try {
      await audioCtx.resume();
    } catch {
      /* ignore */
    }
  }
  return startIcuMonitor({ fadeMs: 0 });
}

export function applyMonitorVolume() {
  if (playing) {
    setOutputVolume(targetMonitorVolume());
  }
  notifyPrefListeners();
}

/** Start or resume the ~1h session track without resetting playback position. */
export function startIcuMonitor({ fadeMs = 1600 } = {}) {
  prefetchMonitorAudio();
  ensureMonitorGraph();
  if (audioCtx?.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }

  const target = targetMonitorVolume();
  const session = getSessionElement();
  const active = usingBoot ? bootEl : sessionEl;
  const alreadyPlaying = playing && active && !active.paused;

  if (alreadyPlaying) {
    if (target > 0) return fadeVolume(target, Math.min(fadeMs, 600));
    setOutputVolume(target);
    return Promise.resolve();
  }

  if (playing && active?.paused) {
    setOutputVolume(fadeMs > 0 ? 0 : target);
    return Promise.resolve(active.play())
      .then(async () => {
        blocked = false;
        playing = true;
        notifyStateListeners();
        if (fadeMs > 0 && target > 0) await fadeVolume(target, fadeMs);
        else setOutputVolume(target);
      })
      .catch(() => {
        blocked = true;
        playing = false;
        notifyStateListeners();
      });
  }

  if (isSessionBuffered()) {
    return playSessionTrack({ fadeMs, target });
  }
  return playBootTrack({ fadeMs, target });
}

export function pauseSessionMonitor({ fadeMs = 700 } = {}) {
  const active = usingBoot ? bootEl : sessionEl;
  if (!active) return Promise.resolve();
  return fadeVolume(0, fadeMs).then(() => {
    active.pause();
    if (!usingBoot && sessionEl) writeSavedPosition(sessionEl.currentTime);
    playing = false;
    notifyStateListeners();
  });
}

export function endSessionMonitor({ fadeMs = 900 } = {}) {
  return fadeVolume(0, fadeMs).then(() => {
    bootEl?.pause();
    sessionEl?.pause();
    if (bootEl) bootEl.currentTime = 0;
    if (sessionEl) sessionEl.currentTime = 0;
    clearSavedPosition();
    playing = false;
    usingBoot = false;
    sessionReady = false;
    notifyStateListeners();
  });
}

/** @deprecated Use endSessionMonitor. */
export function stopIcuMonitor(opts = {}) {
  return endSessionMonitor(opts);
}

export function setMonitorVolume(volume) {
  patchAudioPrefs({
    monitorVolume: Math.max(0, Math.min(1, volume)),
    monitorMuted: volume === 0,
    monitorEnabled: volume > 0,
  });
  if (playing) setOutputVolume(targetMonitorVolume());
  notifyPrefListeners();
}

export function playCorrect() {
  tone(880, 380, 'sine', 0.055);
}

export function playWrong() {
  tone(160, 120, 'sine', 0.07);
}

export function playComplete() {
  if (!AUDIO_SUPPORTED) return;
  playCorrect();
  setTimeout(() => tone(659, 220, 'sine', 0.055), 160);
  setTimeout(() => tone(784, 240, 'sine', 0.055), 320);
}

if (typeof window !== 'undefined') {
  prefetchMonitorAudio();
  const unlockOnce = () => {
    if (blocked) unlockAmbience();
  };
  window.addEventListener('pointerdown', unlockOnce, { passive: true });
  window.addEventListener('keydown', unlockOnce, { passive: true });
}

export { AUDIO_SUPPORTED, ICU_MONITOR_LITE as ICU_MONITOR_SRC };
