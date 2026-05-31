import { useState } from 'react';
import { readClinicalTextPrefs, writeClinicalTextPrefs } from '../lib/clinicalTextPrefs.js';
import { STORAGE } from '../lib/storageKeys.js';
import { readUiPrefs, writeUiPrefs } from '../lib/uiPrefs.js';
import ClinicalFontControls from './ClinicalFontControls.jsx';

function readShowCues() {
  try {
    const raw = localStorage.getItem(STORAGE.showCues);
    return raw !== '0';
  } catch {
    return true;
  }
}

function readDropMode() {
  try {
    const raw = localStorage.getItem(STORAGE.dropMode);
    return raw === 'strict' ? 'strict' : 'free';
  } catch {
    return 'free';
  }
}

export default function GlobalUiSettingsPanel() {
  const [textPrefs, setTextPrefs] = useState(() => readClinicalTextPrefs());
  const [showCues, setShowCues] = useState(readShowCues);
  const [dropMode, setDropMode] = useState(readDropMode);
  const [timedMode, setTimedMode] = useState(() => readUiPrefs().timedMode);

  const persistShowCues = (next) => {
    setShowCues(next);
    try {
      localStorage.setItem(STORAGE.showCues, next ? '1' : '0');
    } catch {
      /* ignore */
    }
  };

  const persistDropMode = (next) => {
    setDropMode(next);
    try {
      localStorage.setItem(STORAGE.dropMode, next);
    } catch {
      /* ignore */
    }
  };

  const persistTimedMode = (next) => {
    setTimedMode(next);
    writeUiPrefs({ timedMode: next });
  };

  const resetAllUi = () => {
    const defaults = { fontScale: 1.12, weight: 600 };
    writeClinicalTextPrefs(defaults);
    setTextPrefs(defaults);
    persistShowCues(true);
    persistDropMode('free');
    persistTimedMode('timed');
  };

  return (
    <section className="global-ui-settings" aria-label="Global UI settings">
      <h3 className="global-ui-settings-heading">Global UI</h3>
      <p className="global-ui-settings-note">
        Text size and gameplay defaults apply across briefing, case play, and notes.
      </p>

      <div className="global-ui-settings-block">
        <p className="global-ui-settings-label">Clinical text size</p>
        <ClinicalFontControls prefs={textPrefs} onChange={setTextPrefs} showPreview />
      </div>

      <label className="global-ui-toggle">
        <input
          type="checkbox"
          checked={showCues}
          onChange={(e) => persistShowCues(e.target.checked)}
        />
        <span>Show zone cues on patient by default</span>
      </label>

      <div className="global-ui-settings-block">
        <p className="global-ui-settings-label">Case timer</p>
        <div className="global-ui-segment">
          <button
            type="button"
            className={timedMode === 'timed' ? 'active' : ''}
            onClick={() => persistTimedMode('timed')}
          >
            Timed
          </button>
          <button
            type="button"
            className={timedMode === 'untimed' ? 'active' : ''}
            onClick={() => persistTimedMode('untimed')}
          >
            Untimed
          </button>
        </div>
      </div>

      <div className="global-ui-settings-block">
        <p className="global-ui-settings-label">Default drop mode</p>
        <div className="global-ui-segment">
          <button
            type="button"
            className={dropMode === 'free' ? 'active' : ''}
            onClick={() => persistDropMode('free')}
          >
            Practice
          </button>
          <button
            type="button"
            className={dropMode === 'strict' ? 'active' : ''}
            onClick={() => persistDropMode('strict')}
          >
            Exam
          </button>
        </div>
      </div>

      <button type="button" className="welcome-panel-btn" onClick={resetAllUi}>
        Reset global UI defaults
      </button>
    </section>
  );
}
