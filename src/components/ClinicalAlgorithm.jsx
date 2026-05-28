/** Fixed-height clinical flow — order comes from JSON `algorithm.steps`. */
export default function ClinicalAlgorithm({ algorithm, placed, zoneColors }) {
  const steps = algorithm?.steps || [];
  const firstOpen = steps.find((s) => !placed[s.interventionId])?.interventionId;

  return (
    <div className="algo-panel">
      <p className="algo-panel-title">{algorithm?.title || 'Clinical algorithm'}</p>
      <ol className="algo-steps">
        {steps.map((step) => {
          const done = Boolean(placed[step.interventionId]);
          const active = step.interventionId === firstOpen;
          const color = zoneColors[step.zone] || 'var(--gold)';
          return (
            <li
              key={step.interventionId}
              className={`algo-step ${done ? 'done' : ''} ${active ? 'active' : ''}`}
            >
              <span className="algo-num">{String(step.order).padStart(2, '0')}</span>
              <div className="algo-step-body">
                <span className="algo-step-label" title={step.label}>
                  {step.label}
                </span>
                <span className="algo-step-zone" style={{ color }}>
                  → {step.zoneLabel || step.zone}
                </span>
              </div>
              {done && <span className="algo-check">✓</span>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
