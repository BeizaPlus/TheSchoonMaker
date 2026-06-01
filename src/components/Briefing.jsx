import { useCallback, useEffect, useMemo, useState } from 'react';
import PatientScene from './PatientScene.jsx';
import BriefingCasePicker from './BriefingCasePicker.jsx';
import CaseReviewFlagButton from './CaseReviewFlagButton.jsx';
import CaseContextPanel from './CaseContextPanel.jsx';
import IcuMonitorStrip from './IcuMonitorStrip.jsx';
import {
  getPatientImagePayload,
  readVisionZones,
  writeVisionZones,
} from '../lib/patientImage.js';
import { getPresentationHistory } from '../lib/casePresentation.js';
import { readCaseRegenImage } from '../lib/patientRegen.js';
import { clinicalTextStyle, readClinicalTextPrefs } from '../lib/clinicalTextPrefs.js';
import { unlockAmbience } from '../lib/audio.js';
import { getCaseFlow } from '../data/caseFlows.js';
import { getBranding } from '../data/gameData.js';
import { readCaseAloud, stopCaseReader } from '../lib/caseReader.js';
import {
  getBriefingExam,
  getBriefingHpi,
} from '../lib/caseBriefing.js';
import { computePatientLife, patientLifeState } from '../lib/patientLife.js';
import { usePlayDockLayout } from '../hooks/usePlayDockLayout.js';
import { STORAGE } from '../lib/storageKeys.js';
import {
  BRIEFING_UI_ELEMENTS,
  briefingUiPositionStyle,
  defaultBriefingUiLayout,
  readBriefingUiLayout,
  writeBriefingUiLayout,
} from '../lib/briefingUiLayout.js';

function clampZone(z) {
  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const clampRange = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  return {
    cx: clamp01(z.cx),
    cy: clamp01(z.cy),
    w: clampRange(z.w, 0.05, 0.22),
    h: clampRange(z.h, 0.04, 0.18),
  };
}

function normalizeZones(zones) {
  const keys = ['zone-monitor', 'zone-iv-bag', 'zone-blood', 'zone-arm', 'zone-icu'];
  if (!zones || typeof zones !== 'object') return null;
  for (const k of keys) {
    if (!zones[k]) return null;
  }
  const out = {};
  for (const k of keys) out[k] = clampZone(zones[k]);
  return out;
}

function uiShellClass(id, entry, layoutStudio) {
  const hidden = entry?.hidden && !layoutStudio;
  return [
    'briefing-ui-shell',
    `briefing-ui-${id}`,
    hidden ? 'briefing-ui-hidden' : '',
    layoutStudio ? 'briefing-ui-studio-target' : '',
    entry?.hidden && layoutStudio ? 'briefing-ui-marked-hidden' : '',
  ]
    .filter(Boolean)
    .join(' ');
}

export default function Briefing({ caseData, onBegin, onBack, onSelectCase, studioCapture = false }) {
  const brand = getBranding();
  const [regenSrc, setRegenSrc] = useState(() => readCaseRegenImage(caseData?.id));
  const [readState, setReadState] = useState('idle');
  const [readMsg, setReadMsg] = useState('');
  const [textPrefs] = useState(() => readClinicalTextPrefs());
  const [uiLayout, setUiLayout] = useState(() => readBriefingUiLayout());
  const [layoutStudio, setLayoutStudio] = useState(false);
  const [selectedUiId, setSelectedUiId] = useState('back');
  const [uiDrag, setUiDrag] = useState(null);
  const [copyMsg, setCopyMsg] = useState('');
  const briefingRootRef = useRef(null);
  const {
    layout: dockLayout,
    startDrag: startDockDrag,
    resetLayout: resetDockLayout,
    dockToSide,
    isDragging: dockDragging,
  } =
    usePlayDockLayout({ storageKey: STORAGE.briefingDockLayout, boundsRef: briefingRootRef });

  const persistUi = useCallback((next) => {
    setUiLayout(next);
    writeBriefingUiLayout(next);
  }, []);

  useEffect(() => {
    setRegenSrc(readCaseRegenImage(caseData?.id));
    stopCaseReader();
    setReadState('idle');
    setReadMsg('');
  }, [caseData?.id]);

  useEffect(() => () => stopCaseReader(), []);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        const savedRegen = readCaseRegenImage(caseData.id);
        let payload;
        if (savedRegen?.startsWith('data:')) {
          payload = {
            base64: savedRegen.split(',')[1] || '',
            mimeType: savedRegen.slice(5, savedRegen.indexOf(';')) || 'image/png',
            source: `regen:${caseData.id}`,
          };
        } else if (savedRegen?.startsWith('http')) {
          if (readVisionZones(savedRegen)) return;
          const resp = await fetch(savedRegen);
          const blob = await resp.blob();
          const mimeType = blob.type || 'image/png';
          const dataUrl = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || ''));
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
          payload = {
            base64: dataUrl.split(',')[1] || '',
            mimeType,
            source: savedRegen,
          };
        } else {
          payload = await getPatientImagePayload(caseData);
        }
        if (readVisionZones(payload.source)) return;

        const r = await fetch('http://127.0.0.1:3001/api/detect-zones', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64: payload.base64,
            mimeType: payload.mimeType,
          }),
        });
        if (!r.ok) return;
        const data = await r.json();
        const normalized = normalizeZones(data?.zones);
        if (!normalized || cancelled) return;
        writeVisionZones(payload.source, normalized);
      } catch {
        /* ignore — config zones still work */
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [caseData?.id]);

  useEffect(() => {
    if (!uiDrag) return undefined;
    const onMove = (event) => {
      const { id, startX, startY, originX, originY } = uiDrag;
      setUiLayout((prev) => {
        const next = {
          ...prev,
          [id]: {
            ...prev[id],
            x: Math.round(originX + (event.clientX - startX)),
            y: Math.round(originY + (event.clientY - startY)),
          },
        };
        writeBriefingUiLayout(next);
        return next;
      });
    };
    const onUp = () => setUiDrag(null);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [uiDrag]);

  const caseFlow = getCaseFlow(caseData);
  const presentationHistory = getPresentationHistory(caseData);
  const textStyle = clinicalTextStyle(textPrefs);

  const hpiText = useMemo(
    () => getBriefingHpi(caseData, caseFlow, presentationHistory),
    [caseData, caseFlow, presentationHistory],
  );
  const examSummary = useMemo(() => getBriefingExam(caseFlow), [caseFlow]);
  const lifePct = useMemo(
    () => computePatientLife({ vitals: caseFlow.vitals }),
    [caseFlow.vitals],
  );
  const lifeState = patientLifeState(lifePct);

  const handleReadCase = (section, text) => {
    readCaseAloud({
      caseId: caseData.id,
      section,
      text,
      onState: (state, detail) => {
        setReadState(state);
        if (state === 'error') setReadMsg(detail || 'Read failed');
        else if (state === 'generating' && detail === 'browser') setReadMsg('Using browser voice…');
        else if (state === 'generating') setReadMsg('Generating narration…');
        else if (state === 'playing' && detail === 'browser') setReadMsg('');
        else setReadMsg('');
      },
    });
  };

  const startUiDrag = (id, event) => {
    if (!layoutStudio || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    setSelectedUiId(id);
    const rect = event.currentTarget.getBoundingClientRect();
    const entry = uiLayout[id] || {};
    setUiDrag({
      id,
      startX: event.clientX,
      startY: event.clientY,
      originX: entry.x ?? rect.left,
      originY: entry.y ?? rect.top,
    });
  };

  const toggleUiHidden = (id) => {
    persistUi({
      ...uiLayout,
      [id]: { ...uiLayout[id], hidden: !uiLayout[id]?.hidden },
    });
  };

  const resetUiLayout = () => {
    persistUi(defaultBriefingUiLayout());
    setCopyMsg('Layout reset');
  };

  const copyUiLayout = async () => {
    const json = JSON.stringify(uiLayout, null, 2);
    try {
      await navigator.clipboard.writeText(json);
      setCopyMsg('Layout JSON copied');
    } catch {
      setCopyMsg(json.slice(0, 80));
    }
  };

  const selectedEntry = uiLayout[selectedUiId] || {};

  return (
    <main
      ref={briefingRootRef}
      className={`briefing briefing-with-scene briefing-dock-style ${layoutStudio ? 'briefing-layout-studio' : ''}`}
    >
      {studioCapture && (
        <div className="briefing-studio-bar">
          <button
            type="button"
            className={layoutStudio ? 'btn-primary' : 'btn-ghost'}
            onClick={() => setLayoutStudio((v) => !v)}
          >
            {layoutStudio ? 'Layout studio: ON' : 'Layout studio'}
          </button>
          {layoutStudio && (
            <>
              <div className="briefing-studio-chips" role="listbox" aria-label="Briefing elements">
                {BRIEFING_UI_ELEMENTS.map(({ id, label }) => (
                  <button
                    key={id}
                    type="button"
                    role="option"
                    aria-selected={selectedUiId === id}
                    className={`briefing-studio-chip ${selectedUiId === id ? 'active' : ''} ${uiLayout[id]?.hidden ? 'hidden-flag' : ''}`}
                    onClick={() => setSelectedUiId(id)}
                  >
                    {label}
                    {uiLayout[id]?.hidden ? ' · hide' : ''}
                  </button>
                ))}
              </div>
              <label className="briefing-studio-hide-toggle">
                <input
                  type="checkbox"
                  checked={Boolean(selectedEntry.hidden)}
                  onChange={() => toggleUiHidden(selectedUiId)}
                />
                Hide “{BRIEFING_UI_ELEMENTS.find((e) => e.id === selectedUiId)?.label}”
              </label>
              <button type="button" className="btn-ghost" onClick={resetUiLayout}>
                Reset layout
              </button>
              <button type="button" className="btn-ghost" onClick={copyUiLayout}>
                Copy JSON
              </button>
              {copyMsg && <span className="briefing-studio-msg">{copyMsg}</span>}
            </>
          )}
        </div>
      )}

      <div
        className={uiShellClass('back', uiLayout.back, layoutStudio)}
        style={briefingUiPositionStyle(uiLayout.back)}
        data-briefing-ui="back"
        onPointerDown={(e) => startUiDrag('back', e)}
      >
        <button
          type="button"
          className="briefing-back-btn"
          onClick={() => {
            if (layoutStudio) return;
            stopCaseReader();
            onBack();
          }}
          aria-label="Back to cases"
        >
          ←
        </button>
      </div>

      <div className="briefing-scene-wrap" aria-hidden>
        <PatientScene scene={caseData.patientScene} className="briefing-scene-img" forceSrc={regenSrc} />
        <div className="briefing-scene-dim" />
        <div
          className={`scene-dock-left briefing-scene-dock ${uiShellClass('scene-dock', uiLayout['scene-dock'], layoutStudio)}`}
          style={briefingUiPositionStyle(uiLayout['scene-dock'])}
          data-briefing-ui="scene-dock"
          onPointerDown={(e) => startUiDrag('scene-dock', e)}
        >
          <div className="play-life-top-left">
            <div className="pack-life-head">
              <span>Patient life</span>
              <span className={`pack-life-state ${lifeState}`}>{lifeState}</span>
            </div>
            <div className="pack-life-track" aria-label="Patient life bar">
              <div
                className={`pack-life-fill ${lifeState}`}
                style={{ width: `${lifePct}%` }}
                role="progressbar"
                aria-valuenow={lifePct}
                aria-valuemin={0}
                aria-valuemax={100}
              />
            </div>
            <p className="pack-life-pct" aria-hidden>{lifePct}%</p>
          </div>
          <IcuMonitorStrip
            vitals={caseFlow.vitals}
            className="icu-monitor-docked briefing-monitor"
            showVolume={false}
            collapsible={false}
          />
        </div>
        <div
          className={`briefing-case-hero ${uiShellClass('case-hero', uiLayout['case-hero'], layoutStudio)}`}
          style={briefingUiPositionStyle(uiLayout['case-hero'])}
          data-briefing-ui="case-hero"
          onPointerDown={(e) => startUiDrag('case-hero', e)}
        >
          <p className="briefing-case">
            CCS Case {caseData.ccsNumber || caseData.id}
            {caseData.category ? ` · ${caseData.category}` : ''}
            {caseData.timeLimit ? ` · ${caseData.timeLimit}` : ''}
          </p>
          <h1>{caseData.title}</h1>
          {caseData.diagnosis && (
            <p className="briefing-diagnosis-line">{caseData.diagnosis}</p>
          )}
        </div>
      </div>

      {onSelectCase && (
        <div
          className={uiShellClass('case-picker', uiLayout['case-picker'], layoutStudio)}
          style={briefingUiPositionStyle(uiLayout['case-picker'])}
          data-briefing-ui="case-picker"
          onPointerDown={(e) => startUiDrag('case-picker', e)}
        >
          <BriefingCasePicker currentCaseId={caseData.id} onSelectCase={onSelectCase} />
        </div>
      )}

      <aside
        className={`game-sidebar briefing-sidebar floating dock-return-zone briefing-command-layer ${uiShellClass('sidebar', uiLayout.sidebar, layoutStudio)} ${dockDragging ? 'dragging' : ''}`}
        style={{
          left: `${dockLayout.x}px`,
          top: `${dockLayout.y}px`,
          width: `${dockLayout.width}px`,
          height: `${dockLayout.height}px`,
          ...briefingUiPositionStyle(uiLayout.sidebar),
        }}
        data-briefing-ui="sidebar"
        onPointerDown={(e) => {
          if (!layoutStudio) return;
          if (e.target.closest('.dock-handle, .dock-resize-handle, .dock-panel-clinical, button, input, textarea, a')) {
            return;
          }
          startUiDrag('sidebar', e);
        }}
      >
        <div
          className="dock-handle"
          onPointerDown={(e) => startDockDrag('move', e)}
          title="Drag to move panel"
        >
          ⋮⋮ {brand.name}
          <button
            type="button"
            className="dock-reset-btn"
            onClick={(e) => {
              e.stopPropagation();
              resetDockLayout();
            }}
            title="Reset panel size"
          >
            ↺
          </button>
          <button
            type="button"
            className="dock-reset-btn"
            onClick={(e) => {
              e.stopPropagation();
              dockToSide('right');
            }}
            title="Dock to right side"
          >
            ⇥
          </button>
        </div>
        <div className="dock-panel-clinical briefing-command-body">
          <CaseContextPanel
            key={caseData.id}
            mode="briefing"
            caseData={caseData}
            brandName={brand.name}
            hpiText={hpiText}
            examSummary={examSummary}
            hideHeader
            textStyle={textStyle}
            defaultTab="hpi"
            readLabel="Read aloud"
            onReadCase={handleReadCase}
            readState={readState}
            footer={
              <div className="briefing-panel-footer">
                {readMsg && <p className="case-read-msg">{readMsg}</p>}
                {caseData.objective && (
                  <p className="briefing-objective">Objective — {caseData.objective}</p>
                )}
                <div className="briefing-actions">
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => {
                      stopCaseReader();
                      unlockAmbience();
                      onBegin();
                    }}
                  >
                    Begin case →
                  </button>
                  <CaseReviewFlagButton caseId={caseData.id} compact />
                </div>
              </div>
            }
          />
        </div>
        <div
          className="dock-resize-handle dock-resize-e"
          aria-hidden
          onPointerDown={(e) => startDockDrag('resize-e', e)}
        />
        <div
          className="dock-resize-handle dock-resize-s"
          aria-hidden
          onPointerDown={(e) => startDockDrag('resize-s', e)}
        />
        <div
          className="dock-resize-handle dock-resize-se"
          aria-hidden
          onPointerDown={(e) => startDockDrag('resize-se', e)}
        />
      </aside>
    </main>
  );
}
