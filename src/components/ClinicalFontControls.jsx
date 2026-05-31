import { clinicalTextStyle, writeClinicalTextPrefs } from '../lib/clinicalTextPrefs.js';

const PREVIEW_TEXT =
  'A 58-year-old man presents to the emergency department with acute chest pain that began 20 minutes ago while at rest. He describes the pain as sharp and worsening with deep breaths.';

export default function ClinicalFontControls({
  prefs,
  onChange,
  compact = false,
  showLabel = true,
  showBold = true,
  showPreview = false,
}) {
  const bump = (patch) => {
    const next = { ...prefs, ...patch };
    writeClinicalTextPrefs(next);
    onChange?.(next);
  };

  const sizeLabel = `${Math.round(prefs.fontScale * 100)}%`;
  const previewStyle = clinicalTextStyle(prefs);

  return (
    <div className={`clinical-font-controls-wrap ${compact ? 'compact' : ''}`}>
      <div className={`clinical-font-controls ${compact ? 'compact' : ''}`}>
      {showLabel && <span className="clinical-font-controls-label">Text</span>}
      <button
        type="button"
        className="clinical-font-btn"
        onClick={() => bump({ fontScale: Math.max(0.9, Number((prefs.fontScale - 0.08).toFixed(2))) })}
        aria-label="Decrease text size"
        title="Smaller text"
      >
        A−
      </button>
      <span className="clinical-font-size-pill" aria-live="polite">
        {sizeLabel}
      </span>
      <button
        type="button"
        className="clinical-font-btn"
        onClick={() => bump({ fontScale: Math.min(1.5, Number((prefs.fontScale + 0.08).toFixed(2))) })}
        aria-label="Increase text size"
        title="Larger text"
      >
        A+
      </button>
      {showBold && (
        <button
          type="button"
          className={`clinical-font-btn ${prefs.weight === 700 ? 'active' : ''}`}
          onClick={() => bump({ weight: prefs.weight === 700 ? 600 : 700 })}
          aria-label="Toggle bold clinical text"
          title="Bold text"
        >
          B
        </button>
      )}
      <button
        type="button"
        className="clinical-font-btn reset"
        onClick={() => bump({ fontScale: 1.12, weight: 600 })}
        aria-label="Reset text size"
        title="Reset text size"
      >
        ↺
      </button>
      </div>
      {showPreview && (
        <div className="clinical-text-preview" style={previewStyle} aria-live="polite">
          <p className="clinical-text-preview-label">Preview</p>
          <p className="clinical-text-preview-body clinical-text-block">{PREVIEW_TEXT}</p>
        </div>
      )}
    </div>
  );
}
