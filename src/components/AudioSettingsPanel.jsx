import { useEffect, useState } from 'react';
import { FiVolume2, FiVolumeX } from 'react-icons/fi';
import {
  applyMonitorVolume,
  subscribeAudioPrefs,
  subscribeMonitorState,
  unlockAmbience,
} from '../lib/audio.js';
import { patchAudioPrefs, readAudioPrefs } from '../lib/audioPrefs.js';

function VolumeRow({ label, muted, pct, onMute, onChange, ariaPrefix }) {
  return (
    <div className="audio-settings-row">
      <span className="audio-settings-row-label">{label}</span>
      <button
        type="button"
        className="audio-volume-mute"
        onClick={onMute}
        aria-label={muted ? `Unmute ${ariaPrefix}` : `Mute ${ariaPrefix}`}
        aria-pressed={muted}
      >
        {muted ? <FiVolumeX aria-hidden /> : <FiVolume2 aria-hidden />}
      </button>
      <input
        type="range"
        className="audio-volume-slider audio-settings-slider"
        min={0}
        max={100}
        value={pct}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        aria-label={`${label} volume`}
      />
      <span className="audio-settings-pct">{muted ? '—' : `${pct}%`}</span>
    </div>
  );
}

export default function AudioSettingsPanel() {
  const [prefs, setPrefs] = useState(() => readAudioPrefs());
  const [monitor, setMonitor] = useState({ playing: false });

  useEffect(() => subscribeAudioPrefs(setPrefs), []);
  useEffect(() => subscribeMonitorState(setMonitor), []);

  const bump = (patch) => {
    const next = patchAudioPrefs(patch);
    setPrefs(next);
    applyMonitorVolume();
    unlockAmbience();
  };

  const monitorPct = Math.round((prefs.monitorVolume || 0) * 100);
  const sfxPct = Math.round((prefs.sfxVolume || 0) * 100);

  return (
    <section className="audio-settings-panel" aria-label="Audio settings">
      <h3 className="audio-settings-heading">
        Audio
        {monitor.playing && <span className="audio-settings-live">Monitor live</span>}
      </h3>
      <VolumeRow
        label="ICU monitor"
        ariaPrefix="ICU monitor"
        muted={prefs.monitorMuted}
        pct={monitorPct}
        onMute={() => {
          if (prefs.monitorMuted) {
            bump({
              monitorMuted: false,
              monitorVolume: prefs.monitorVolume > 0 ? prefs.monitorVolume : 0.38,
            });
          } else {
            bump({ monitorMuted: true });
          }
        }}
        onChange={(monitorVolume) => {
          bump({ monitorVolume, monitorMuted: monitorVolume === 0 });
        }}
      />
      <VolumeRow
        label="Game sounds"
        ariaPrefix="game sounds"
        muted={prefs.sfxVolume === 0}
        pct={sfxPct}
        onMute={() => {
          bump({
            sfxVolume: prefs.sfxVolume > 0 ? 0 : 0.55,
          });
        }}
        onChange={(sfxVolume) => bump({ sfxVolume })}
      />
    </section>
  );
}
