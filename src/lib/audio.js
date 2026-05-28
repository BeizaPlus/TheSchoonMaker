const AUDIO_SUPPORTED = typeof AudioContext !== 'undefined' || typeof webkitAudioContext !== 'undefined';

function tone(freq, durMs, type = 'sine', gain = 0.06) {
  if (!AUDIO_SUPPORTED) return;
  const Ctx = AudioContext || webkitAudioContext;
  const ctx = new Ctx();
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.value = gain;
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

export { AUDIO_SUPPORTED };

