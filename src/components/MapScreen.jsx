import { useState, useMemo, useCallback } from 'react';
import {
  getErMap,
  enrichAlgorithmSteps,
  getMapPathNodeIds,
  getTargetDispositionId,
  isDispositionNode,
} from '../data/mapData.js';

export default function MapScreen({ caseData, onEnterPlay, onBack }) {
  const erMap = getErMap();
  const steps = useMemo(
    () => enrichAlgorithmSteps(caseData.algorithm),
    [caseData.algorithm],
  );
  const pathIds = useMemo(() => getMapPathNodeIds(caseData.algorithm), [caseData.algorithm]);

  const [patientAt, setPatientAt] = useState(erMap.patientStart);
  const [activeStep, setActiveStep] = useState(0);
  const [visited, setVisited] = useState(() => new Set([erMap.patientStart]));
  const [zoom, setZoom] = useState(1);

  const currentStep = steps[activeStep] || null;
  const patientNode = erMap.nodes[patientAt];
  const playNode = erMap.nodes[erMap.playNode];
  const targetDispoId = useMemo(
    () => getTargetDispositionId(caseData.algorithm),
    [caseData.algorithm],
  );
  const targetDispo = erMap.nodes[targetDispoId];

  const objectiveText = (() => {
    if (!currentStep) {
      return caseData.objective || 'Walk the clinical path through the ED';
    }
    if (currentStep.zone === 'zone-icu' || isDispositionNode(currentStep.mapNodeId)) {
      const dest = currentStep.mapNode?.label || targetDispo?.label || 'disposition';
      return `Admit / disposition → ${dest} (or ward · obs · transfer as indicated)`;
    }
    return `Move patient to ${currentStep.mapNode?.label || currentStep.label}`;
  })();

  const goToNode = useCallback((nodeId, stepIdx = null) => {
    setPatientAt(nodeId);
    setVisited((v) => new Set([...v, nodeId]));
    if (stepIdx !== null) setActiveStep(stepIdx);
  }, []);

  const walkFullPath = () => {
    let delay = 0;
    pathIds.forEach((nodeId) => {
      setTimeout(() => {
        const stepIdx = steps.findIndex((s) => s.mapNodeId === nodeId);
        goToNode(nodeId, stepIdx >= 0 ? stepIdx : activeStep);
      }, delay);
      delay += 700;
    });
  };

  const nextStep = () => {
    if (activeStep < steps.length - 1) {
      const next = activeStep + 1;
      setActiveStep(next);
      goToNode(steps[next].mapNodeId, next);
    }
  };

  const nodeList = Object.entries(erMap.nodes);
  const stepProgress = steps.length
    ? Math.round(((activeStep + 1) / steps.length) * 100)
    : 0;

  const dispoVisited = (id) => visited.has(id);
  const anyDispoVisited = (erMap.dispositionNodeIds || []).some(dispoVisited);

  const statusBars = [
    { key: 'triage', label: 'TRIAGE', pct: visited.has('triage') ? 100 : patientAt === 'triage' ? 40 : 0 },
    { key: 'lab', label: 'LABS', pct: visited.has('lab') ? 100 : 0 },
    { key: 'meds', label: 'MEDS', pct: visited.has('meds') || visited.has('pharmacy') ? 100 : 0 },
    ...(erMap.dispositionNodeIds || []).map((id) => ({
      key: id,
      label: erMap.nodes[id]?.shortLabel || id.toUpperCase(),
      pct: dispoVisited(id) ? 100 : id === targetDispoId && anyDispoVisited ? 50 : 0,
      isTarget: id === targetDispoId,
    })),
  ];

  return (
    <div className="map-screen map-screen--ed">
      <header className="ed-map-top">
        <button type="button" className="ed-map-back" onClick={onBack} aria-label="Back to cases">
          ←
        </button>
        <div className="ed-objective">
          <span className="ed-objective-mark" aria-hidden>◆</span>
          <div className="ed-objective-text">
            <p className="ed-objective-main">{objectiveText}</p>
            {currentStep?.why && (
              <p className="ed-objective-sub">{currentStep.why}</p>
            )}
          </div>
        </div>
        <div className="ed-map-top-actions">
          <span className="ed-map-tab ed-map-tab--active">MAP</span>
          <span className="ed-map-tab">CASE #{caseData.ccsNumber}</span>
          <button type="button" className="ed-map-icon-btn" onClick={walkFullPath} title="Walk full path">
            ▶
          </button>
        </div>
      </header>

      <div className="ed-map-body">
        <aside className="ed-map-rail ed-map-rail--left" aria-label="Path steps">
          <button
            type="button"
            className="ed-rail-arrow"
            disabled={activeStep <= 0}
            onClick={() => {
              const prev = activeStep - 1;
              if (prev >= 0) {
                setActiveStep(prev);
                goToNode(steps[prev].mapNodeId, prev);
              }
            }}
          >
            ▲
          </button>
          <ol className="ed-rail-steps">
            {pathIds.map((nodeId) => {
              const node = erMap.nodes[nodeId];
              const stepForNode = steps.find((s) => s.mapNodeId === nodeId);
              const isActive = nodeId === patientAt;
              const isDone = visited.has(nodeId) && !isActive;
              return (
                <li key={nodeId}>
                  <button
                    type="button"
                    className={`ed-rail-step ${isActive ? 'active' : ''} ${isDone ? 'done' : ''}`}
                    onClick={() => {
                      goToNode(nodeId);
                      if (stepForNode) setActiveStep(steps.indexOf(stepForNode));
                    }}
                    title={node?.hint}
                  >
                    <span className="ed-rail-diamond" />
                    <span className="ed-rail-label">{node?.label}</span>
                  </button>
                </li>
              );
            })}
          </ol>
          <button
            type="button"
            className="ed-rail-arrow"
            disabled={activeStep >= steps.length - 1}
            onClick={nextStep}
          >
            ▼
          </button>
        </aside>

        <div className="ed-map-center">
          <div
            className="map-canvas-wrap ed-map-canvas"
            style={{ transform: `scale(${zoom})` }}
          >
            <div className="ed-map-grid" aria-hidden />
            <img className="map-bg" src={erMap.mapImage} alt="ED floor plan" draggable={false} />
            <svg className="map-paths" viewBox="0 0 100 100" preserveAspectRatio="none">
              {pathIds.slice(0, -1).map((from, i) => {
                const to = pathIds[i + 1];
                const a = erMap.nodes[from];
                const b = erMap.nodes[to];
                if (!a || !b) return null;
                return (
                  <line
                    key={`${from}-${to}`}
                    x1={a.cx * 100}
                    y1={a.cy * 100}
                    x2={b.cx * 100}
                    y2={b.cy * 100}
                    className="map-path-line"
                  />
                );
              })}
            </svg>
            {nodeList.map(([id, node]) => {
              const isPatient = id === patientAt;
              const isOnPath = pathIds.includes(id);
              const isVisited = visited.has(id);
              const isTargetDispo = id === targetDispoId;
              const stepForNode = steps.find((s) => s.mapNodeId === id);
              return (
                <div key={id} className="ed-map-room" style={{ left: `${node.cx * 100}%`, top: `${node.cy * 100}%` }}>
                  <span
                    className={`ed-room-label ${isOnPath ? 'on-path' : ''} ${isVisited ? 'visited' : ''} ${node.isPlay ? 'play-room' : ''} ${node.isDisposition && isTargetDispo ? 'dispo-target' : ''} ${node.isDisposition ? 'dispo-node' : ''}`}
                  >
                    {node.label}
                  </span>
                  <button
                    type="button"
                    className={`map-node ed-map-pin ${isPatient ? 'patient-here' : ''} ${isOnPath ? 'on-path' : ''} ${isVisited ? 'visited' : ''} ${node.isPlay ? 'play-room' : ''} ${isTargetDispo ? 'dispo-target' : ''}`}
                    onClick={() => {
                      goToNode(id);
                      if (stepForNode) setActiveStep(steps.indexOf(stepForNode));
                    }}
                    title={node.hint}
                    aria-label={node.label}
                  />
                  {stepForNode && (
                    <span className="ed-map-step-badge">{stepForNode.order}</span>
                  )}
                </div>
              );
            })}
            <div
              className="map-patient-token ed-patient-arrow"
              style={{
                left: `${erMap.nodes[patientAt]?.cx * 100}%`,
                top: `${erMap.nodes[patientAt]?.cy * 100}%`,
              }}
              aria-label={`Patient at ${patientNode?.label}`}
            />
          </div>
          <footer className="ed-map-area-label">
            <span>Emergency Department</span>
            <span className="ed-map-area-sub">
              {patientNode?.label}
              {playNode && patientAt !== erMap.playNode ? ` → ${playNode.label}` : ''}
              {targetDispo ? ` · goal: ${targetDispo.label}` : ''}
            </span>
          </footer>
        </div>

        <aside className="ed-map-rail ed-map-rail--right" aria-label="Status">
          <div className="ed-status-bars">
            {statusBars.map((bar) => (
              <div key={bar.key} className={`ed-status-row ${bar.isTarget ? 'ed-status-row--target' : ''}`}>
                <span className="ed-status-label">{bar.label}</span>
                <div className="ed-status-track">
                  <div className="ed-status-fill" style={{ width: `${bar.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="ed-status-bundle">
            <span className="ed-status-label">BUNDLE</span>
            <div className="ed-status-track">
              <div className="ed-status-fill ed-status-fill--gold" style={{ width: `${stepProgress}%` }} />
            </div>
          </div>
          <div className="ed-zoom-rail">
            <button type="button" onClick={() => setZoom((z) => Math.min(1.4, z + 0.1))}>In</button>
            <input
              type="range"
              min="0.85"
              max="1.4"
              step="0.05"
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              aria-label="Map zoom"
            />
            <button type="button" onClick={() => setZoom((z) => Math.max(0.85, z - 0.1))}>Out</button>
          </div>
          {currentStep?.guideline && (
            <p className="ed-map-guideline">{currentStep.guideline}</p>
          )}
        </aside>
      </div>

      <footer className="ed-map-bottom">
        <div className="ed-map-case-snippet">
          <strong>{caseData.title}</strong>
          {currentStep && (
            <span>
              Step {currentStep.order}/{steps.length}: {currentStep.label}
            </span>
          )}
        </div>
        <div className="ed-map-bottom-actions">
          <button type="button" className="btn-ghost" onClick={nextStep} disabled={activeStep >= steps.length - 1}>
            Next step →
          </button>
          <button type="button" className="btn-play" onClick={onEnterPlay}>
            Enter {playNode?.label || 'resus'} — play
          </button>
        </div>
      </footer>
    </div>
  );
}
