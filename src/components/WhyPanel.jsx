/** RE4-style rationale slide-in (medgame-single #screen-why). */
export default function WhyPanel({ open, intervention, ok, onClose }) {
  const iv = intervention;
  if (!iv) return null;

  return (
    <div className={`why-screen ${open ? 'open' : ''}`} aria-hidden={!open}>
      <button
        type="button"
        className="why-backdrop"
        onClick={onClose}
        aria-label="Close rationale panel"
      />
      <div className="why-panel" role="dialog" aria-label="Clinical rationale panel">
        <div className="why-head">
          <button type="button" className="why-back" onClick={onClose} aria-label="Close">
            ←
          </button>
          <div className="why-title">{iv.label}</div>
          <span className={`why-badge ${ok ? 'ok' : ''}`}>{ok ? '✓ Correct' : 'Review'}</span>
        </div>

        <p className="sect-label">Clinical rationale</p>
        <p className="why-text">{iv.why}</p>

        <p className="sect-label">Guideline reference</p>
        <span className="why-guideline-pill">{iv.guideline}</span>

        <div className="why-footer">
          <button type="button" className="gotit" onClick={onClose}>
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
