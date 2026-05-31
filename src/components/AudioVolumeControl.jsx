import { useEffect, useState } from 'react';
import { FiVolume2, FiVolumeX } from 'react-icons/fi';
import {
  applyMonitorVolume,
  subscribeAudioPrefs,
  unlockAmbience,
} from '../lib/audio.js';
import { patchAudioPrefs, readAudioPrefs } from '../lib/audioPrefs.js';

export default function AudioVolumeControl({ label = 'Monitor' }) {
  const [prefs, setPrefs] = useState(() => readAudioPrefs());

  useEffect(() => subscribeAudioPrefs(setPrefs), []);

  const bump = (patch) => {
    const next = patchAudioPrefs(patch);
    setPrefs(next);
    applyMonitorVolume();
    unlockAmbience();
  };

  const muted = prefs.monitorMuted;
  const pct = Math.round((prefs.monitorVolume || 0) * 100);

  return (
    <div
      className="audio-volume-control compact"
      title={`${label} volume — ${muted ? 'muted' : `${pct}%`}`}
    >
      <button
        type="button"
        className="audio-volume-mute"
        onClick={() => {
          if (prefs.monitorMuted) {
            bump({
              monitorMuted: false,
              monitorVolume: prefs.monitorVolume > 0 ? prefs.monitorVolume : 0.38,
            });
          } else {
            bump({ monitorMuted: true });
          }
        }}
        aria-label={muted ? 'Unmute monitor' : 'Mute monitor'}
        aria-pressed={muted}
      >
        {muted ? <FiVolumeX aria-hidden /> : <FiVolume2 aria-hidden />}
      </button>
      <input
        type="range"
        className="audio-volume-slider"
        min={0}
        max={100}
        value={pct}
        onChange={(e) => {
          const monitorVolume = Number(e.target.value) / 100;
          bump({
            monitorVolume,
            monitorMuted: monitorVolume === 0,
          });
        }}
        aria-label={`${label} volume`}
      />
    </div>
  );
}
