import { useMemo } from 'react';

function spreadOverlappingSteps(steps) {
  const byZone = {};
  steps.forEach((s) => {
    if (!byZone[s.zoneId]) byZone[s.zoneId] = [];
    byZone[s.zoneId].push(s);
  });

  return steps.map((step) => {
    const group = byZone[step.zoneId];
    if (!group || group.length <= 1) return step;
    const index = group.indexOf(step);
    const angle = ((index / group.length) * 360 - 90) * (Math.PI / 180);
    const radius = 3.4;
    return {
      ...step,
      x: step.x + Math.cos(angle) * radius,
      y: step.y + Math.sin(angle) * radius,
    };
  });
}

export default function TeachMeSceneOverlay({
  interventions = [],
  zones = {},
  placed = {},
  nextExpectedId = null,
  focusedStepId = null,
  frame = { left: 0, top: 0, w: 100, h: 100 },
  onSelectStep,
}) {
  const steps = useMemo(() => {
    const raw = interventions
      .map((iv, idx) => {
        const zone = zones[iv.correct_zone];
        if (!zone) return null;
        return {
          id: iv.id,
          seq: idx + 1,
          label: iv.label,
          zoneId: iv.correct_zone,
          x: frame.left + zone.cx * frame.w,
          y: frame.top + zone.cy * frame.h,
          done: Boolean(placed[iv.id]),
          next: iv.id === nextExpectedId,
        };
      })
      .filter(Boolean);

    return spreadOverlappingSteps(raw);
  }, [interventions, zones, placed, nextExpectedId, frame]);

  if (!steps.length) return null;

  return (
    <div className="teach-scene-overlay" aria-label="Teach Me clinical flow on patient">
      <svg className="teach-scene-arrows" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
        <defs>
          <marker
            id="teach-flow-arrowhead"
            markerWidth="8"
            markerHeight="8"
            refX="6"
            refY="4"
            orient="auto"
          >
            <path d="M0,0 L8,4 L0,8 Z" fill="rgba(232, 184, 75, 0.95)" />
          </marker>
        </defs>
        {steps.slice(0, -1).map((step, index) => {
          const next = steps[index + 1];
          return (
            <line
              key={`${step.id}-${next.id}`}
              className={`teach-scene-arrow ${step.done && next.done ? 'done' : ''} ${next.next ? 'to-next' : ''}`}
              x1={step.x}
              y1={step.y}
              x2={next.x}
              y2={next.y}
              markerEnd="url(#teach-flow-arrowhead)"
            />
          );
        })}
      </svg>

      {steps.map((step) => (
        <button
          key={step.id}
          type="button"
          className={`teach-step-marker ${step.done ? 'done' : ''} ${step.next ? 'next' : ''} ${focusedStepId === step.id ? 'focused' : ''}`}
          style={{ left: `${step.x}%`, top: `${step.y}%` }}
          onClick={() => onSelectStep?.(step.id)}
          title={`Step ${step.seq}: ${step.label}`}
          aria-label={`Step ${step.seq}, ${step.label}`}
        >
          <span className="teach-step-num">{step.seq}</span>
          <span className="teach-step-tag">{step.label}</span>
        </button>
      ))}
    </div>
  );
}
