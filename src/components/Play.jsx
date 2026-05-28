import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import PatientScene from './PatientScene.jsx';
import ClinicalAlgorithm from './ClinicalAlgorithm.jsx';
import WhyPanel from './WhyPanel.jsx';
import { getDragConfig } from '../data/gameData.js';
import { useDragGame } from '../hooks/useDragGame.js';
import { useGridDragGame } from '../hooks/useGridDragGame.js';
import { isCorrectGridPlacement, zoneIdForCell } from '../lib/placementGrid.js';
import SceneGridOverlay from './SceneGridOverlay.jsx';
import { playWrong, playComplete } from '../lib/audio.js';
import { mergeZonesForPlay } from '../lib/zoneStudio.js';
import { getCaseFlow } from '../data/caseFlows.js';
import {
  FiActivity,
  FiBox,
  FiCamera,
  FiClipboard,
  FiFileText,
  FiMaximize2,
  FiMinimize2,
  FiEye,
  FiEyeOff,
  FiMoon,
  FiSun,
  FiUnlock,
  FiLock,
} from 'react-icons/fi';
import { readTheme, writeTheme } from '../lib/theme.js';
import { getBuiltInPatientSrc, getPatientImagePayload } from '../lib/patientImage.js';
import GridPlacementLayer from './GridPlacementLayer.jsx';
import { GRID_COLS, GRID_ROWS } from '../lib/sceneGrid.js';
import {
  createGridItem,
  moveGridItem,
  readGridItems,
  writeGridItems,
} from '../lib/gridPlacement.js';
import { nextAttemptNumber, peekAttemptNumber, saveScreenshotToServer } from '../lib/captureScreenshot.js';
import { STORAGE } from '../lib/storageKeys.js';
import { getBranding } from '../data/gameData.js';

export default function Play({ caseData, onComplete, onQuit, studioCapture = false }) {
  const brand = getBranding();
  const completionThreshold =
    caseData.completionThreshold ?? brand.completionThreshold ?? 99;
  const dragCfg = getDragConfig();
  const layout = caseData.layout || {};
  const zones = useMemo(() => mergeZonesForPlay(caseData.zones), [caseData.zones]);
  const zoneColors = caseData.zoneColors;
  const placementMode = layout.placementMode || 'grid';
  const useGridPlacement = placementMode === 'grid';
  const showZonesAlways = !useGridPlacement && layout.zoneDisplay === 'always';

  const [placed, setPlaced] = useState({});
  const [pins, setPins] = useState([]);
  const [reviewResults, setReviewResults] = useState({});
  const [orderReview, setOrderReview] = useState({});
  const [reviewed, setReviewed] = useState(false);
  const [reviewCount, setReviewCount] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [correctAttempts, setCorrectAttempts] = useState(0);
  const [flash, setFlash] = useState('');
  const [toast, setToast] = useState({ msg: '', type: '' });
  const [whyPanel, setWhyPanel] = useState(null);
  const [expandedStackId, setExpandedStackId] = useState(null);
  const [teachMeMode, setTeachMeMode] = useState(false);
  const [placementOrder, setPlacementOrder] = useState([]);
  const [dragging, setDragging] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [activeDrawer, setActiveDrawer] = useState(null);
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [dockPos, setDockPos] = useState(() => {
    const width = 360;
    return {
      x: Math.max(12, window.innerWidth - width - 18),
      y: 52,
    };
  });
  const [theme, setTheme] = useState(() => readTheme());
  const [dockDragging, setDockDragging] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [dropMode, setDropMode] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE.dropMode);
      return raw === 'strict' ? 'strict' : 'free';
    } catch {
      return 'free';
    }
  });
  const [showCues, setShowCues] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE.showCues);
      return raw === null ? true : raw === '1';
    } catch {
      return true;
    }
  });
  const startRef = useRef(Date.now());
  const sceneRef = useRef(null);
  const patientImgRef = useRef(null);
  const dockRef = useRef(null);
  const dockDragRef = useRef({ active: false, dx: 0, dy: 0 });
  const [imageFrame, setImageFrame] = useState({ x: 0, y: 0, w: 1, h: 1 });

  const interventions = caseData.interventions;
  const decoyInterventions = useMemo(() => {
    const lowerTitle = String(caseData?.title || '').toLowerCase();
    const shared = [
      {
        id: `decoy-${caseData.id}-1`,
        label: 'Immediate discharge paperwork',
        why: 'Premature disposition before stabilization can delay life-saving care.',
      },
      {
        id: `decoy-${caseData.id}-2`,
        label: 'Non-urgent outpatient referral',
        why: 'Outpatient steps should follow acute stabilization, not replace it.',
      },
      {
        id: `decoy-${caseData.id}-3`,
        label: 'Insurance pre-authorization call',
        why: 'Administrative steps should never delay emergent bedside actions.',
      },
      {
        id: `decoy-${caseData.id}-4`,
        label: 'Diet counseling handout',
        why: 'Education is useful later, but not before acute stabilization.',
      },
    ];

    const caseAware = [];
    if (lowerTitle.includes('chest pain') || lowerTitle.includes('heart')) {
      caseAware.push({
        id: `decoy-${caseData.id}-cp`,
        label: 'Schedule routine stress test next week',
        why: 'Delayed outpatient testing is inappropriate in unstable acute chest pain.',
      });
    }
    if (lowerTitle.includes('altered') || lowerTitle.includes('unconscious')) {
      caseAware.push({
        id: `decoy-${caseData.id}-ams`,
        label: 'Psych discharge clearance form',
        why: 'Do not anchor on psychiatric causes before reversible medical causes are excluded.',
      });
    }
    if (lowerTitle.includes('pelvic')) {
      caseAware.push({
        id: `decoy-${caseData.id}-pelvic`,
        label: 'Elective fertility counseling now',
        why: 'Elective counseling should not interrupt urgent evaluation for ectopic or torsion.',
      });
    }
    if (lowerTitle.includes('shortness of breath') || lowerTitle.includes('cough')) {
      caseAware.push({
        id: `decoy-${caseData.id}-sob`,
        label: 'Pulmonary rehab enrollment',
        why: 'Long-term rehab planning is not an immediate rescue intervention.',
      });
    }

    const seeds = [...shared, ...caseAware];
    return seeds.filter((d) => !interventions.some((iv) => iv.label === d.label));
  }, [caseData.id, caseData?.title, interventions]);
  const stackItems = useMemo(() => [...interventions, ...decoyInterventions], [interventions, decoyInterventions]);
  const expectedOrderIds = useMemo(() => interventions.map((iv) => iv.id), [interventions]);
  const interventionById = useMemo(
    () => Object.fromEntries(interventions.map((iv) => [iv.id, iv])),
    [interventions],
  );
  const nextExpectedId = useMemo(
    () => expectedOrderIds.find((id) => !placed[id]) || null,
    [expectedOrderIds, placed],
  );
  const teachGroups = useMemo(() => {
    const longTermWords = /\b(vaccin|vaccine|immuniz|follow.?up|outpatient|counsel|education|rehab|discharge|prevent|lifestyle|diet)\b/i;
    const acute = [];
    const longTerm = [];
    interventions.forEach((iv, idx) => {
      const blob = `${iv.label} ${iv.why || ''} ${iv.guideline || ''}`;
      const item = { ...iv, seq: idx + 1 };
      if (longTermWords.test(blob)) longTerm.push(item);
      else acute.push(item);
    });
    return { acute, longTerm };
  }, [interventions]);
  const total = interventions.length;
  const doneCount = Object.keys(placed).length;
  const timerBase = layout.timerSeconds || 150;
  const timerMultiplier =
    caseData.sessionDifficulty === 'easy'
      ? 1.35
      : caseData.sessionDifficulty === 'hard'
        ? 0.75
        : 1;
  const timerTotal = Math.round(timerBase * timerMultiplier);
  const [timeLeft, setTimeLeft] = useState(timerTotal);
  const hitboxScale = dragCfg.hitboxScale || 1.9;
  const minHitPx = dragCfg.minHitPx || 130;
  const frameLeft = imageFrame.x * 100;
  const frameTop = imageFrame.y * 100;
  const frameW = imageFrame.w * 100;
  const frameH = imageFrame.h * 100;
  const placedByZone = useMemo(() => {
    const byZone = {};
    interventions.forEach((iv) => {
      const p = placed[iv.id];
      if (!p) return;
      const zoneId = typeof p === 'string' ? p : zoneIdForCell(p, zones);
      if (!zoneId) return;
      byZone[zoneId] = iv.label;
    });
    return byZone;
  }, [interventions, placed, zones]);
  const caseFlow = useMemo(() => getCaseFlow(caseData), [caseData]);
  const vitals = caseFlow.vitals;
  const exam = caseFlow.exam;
  const examSummary = useMemo(
    () => exam.map(([k, v]) => `${k}: ${v}`).join(' | '),
    [exam],
  );
  const soapParts = useMemo(() => {
    const subjective =
      caseData.historyText || caseData.chief_complaint || 'No subjective history documented.';
    const objective = [
      `Vitals: BP ${vitals.sbp}/${vitals.dbp}, HR ${vitals.hr}, RR ${vitals.rr}, Temp ${vitals.temp.toFixed(1)}, SpO2 ${vitals.spo2}%`,
      examSummary || 'Physical exam pending.',
    ].join('\n');
    return {
      subjective,
      objective,
      assessment: caseData.clinical_tip || 'Assessment pending.',
      plan: caseData.objective || 'Plan pending.',
    };
  }, [caseData.historyText, caseData.chief_complaint, caseData.clinical_tip, caseData.objective, vitals, examSummary]);

  const soapDraftKey = `${STORAGE.soapDraft}_${caseData.id}`;
  const [userAssessment, setUserAssessment] = useState('');
  const [userPlan, setUserPlan] = useState('');
  const [assessmentRevealed, setAssessmentRevealed] = useState(false);
  const [planRevealed, setPlanRevealed] = useState(false);

  const SOAP_MIN_CHARS = 12;
  const [careUnit, setCareUnit] = useState(caseFlow.dispositionUnits?.[0] || 'ER');
  const [reviewedAt, setReviewedAt] = useState(null);
  const [sceneByUnit, setSceneByUnit] = useState({});
  const [sceneSourceSig, setSceneSourceSig] = useState('');
  const [sceneBusy, setSceneBusy] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const [placeMode, setPlaceMode] = useState(false);
  const [gridItems, setGridItems] = useState([]);
  const [selectedGridId, setSelectedGridId] = useState(null);
  const [captureBusy, setCaptureBusy] = useState(false);
  const [showThanksVideo, setShowThanksVideo] = useState(false);
  const [pendingCompleteResult, setPendingCompleteResult] = useState(null);
  const [activeThanksVideo, setActiveThanksVideo] = useState(null);
  const [thanksVideoIssue, setThanksVideoIssue] = useState('');
  const [showPostVideoReview, setShowPostVideoReview] = useState(false);
  const [postVideoRows, setPostVideoRows] = useState([]);
  const [reviewPanelCollapsed, setReviewPanelCollapsed] = useState(false);
  const [reviewPanelDragging, setReviewPanelDragging] = useState(false);
  const [reviewPanelPos, setReviewPanelPos] = useState(() => ({
    x: Math.max(16, (window.innerWidth - 520) / 2),
    y: Math.max(64, window.innerHeight - 320),
  }));
  const [infoTab, setInfoTab] = useState('hpi');
  const thanksVideoRef = useRef(null);
  const reviewPanelRef = useRef(null);
  const reviewPanelDragRef = useRef({ dx: 0, dy: 0 });
  const captureRef = useRef(null);
  const caseNumber = String(caseData.ccsNumber || caseData.id || '0');
  const nextCaptureAttempt = useMemo(
    () => peekAttemptNumber(caseNumber),
    [caseNumber, reviewCount, doneCount],
  );

  useEffect(() => {
    setCareUnit(caseFlow.dispositionUnits?.[0] || 'ER');
  }, [caseFlow.id, caseFlow.dispositionUnits]);

  useEffect(() => {
    setUserAssessment('');
    setUserPlan('');
    setAssessmentRevealed(false);
    setPlanRevealed(false);
    try {
      const raw = localStorage.getItem(soapDraftKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed?.assessment) setUserAssessment(parsed.assessment);
      if (parsed?.plan) setUserPlan(parsed.plan);
      if (parsed?.assessmentRevealed) setAssessmentRevealed(true);
      if (parsed?.planRevealed) setPlanRevealed(true);
    } catch {
      /* ignore */
    }
  }, [soapDraftKey]);

  useEffect(() => {
    try {
      localStorage.setItem(
        soapDraftKey,
        JSON.stringify({
          assessment: userAssessment,
          plan: userPlan,
          assessmentRevealed,
          planRevealed,
        }),
      );
    } catch {
      /* ignore */
    }
  }, [soapDraftKey, userAssessment, userPlan, assessmentRevealed, planRevealed]);

  useEffect(() => {
    setTimeLeft(timerTotal);
    setTimedOut(false);
  }, [caseData.id, timerTotal]);

  useEffect(() => {
    if (!studioCapture) return;
    const key = `${STORAGE.playGridItems}_${caseData.id}`;
    setGridItems(readGridItems(key));
  }, [studioCapture, caseData.id]);

  useEffect(() => {
    const overrideSrc = localStorage.getItem(STORAGE.patientImage);
    const erSrc = overrideSrc || getBuiltInPatientSrc(caseData);
    const payloadSigSource = overrideSrc || erSrc;
    const sig = `${caseData.id}:${caseData.patientSex || 'unknown'}:${payloadSigSource.slice(0, 96)}:${payloadSigSource.length}`;
    setSceneSourceSig(sig);
    setSceneByUnit({ ER: erSrc });
    try {
      const raw = localStorage.getItem(STORAGE.sceneVariants);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.[sig] && typeof parsed[sig] === 'object') {
          setSceneByUnit((prev) => ({ ...prev, ER: erSrc, ...parsed[sig] }));
        }
      }
    } catch {
      /* ignore */
    }
  }, [caseData.id, caseData.patientSex, caseData.patientScene?.src]);

  const showToast = (msg, type = '') => {
    setToast({ msg, type });
    setTimeout(() => setToast({ msg: '', type: '' }), 2200);
  };

  const computePostVideoRows = useCallback((override = null) => {
    const expectedOrder = interventions.map((iv) => iv.id);
    const orderIds = override?.placementOrder ?? placementOrder;
    const resultsMap = override?.results ?? (reviewed ? reviewResults : null);
    const placedRanks = new Map(orderIds.map((id, idx) => [id, idx + 1]));
    const expectedRanks = new Map(expectedOrder.map((id, idx) => [id, idx + 1]));
    return expectedOrder.map((id, idx) => {
      const iv = interventionById[id];
      if (!iv) return null;
      const ok = resultsMap ? Boolean(resultsMap[id]) : Boolean(placed[id]);
      const placedOrder = placedRanks.get(id) || null;
      const expectedOrderNum = expectedRanks.get(id) || idx + 1;
      return {
        id,
        seq: idx + 1,
        label: iv.label,
        ok,
        why: iv.why || 'No rationale available yet.',
        guideline: iv.guideline || '',
        placedOrder,
        expectedOrder: expectedOrderNum,
        orderOk: placedOrder != null && placedOrder === expectedOrderNum,
      };
    }).filter(Boolean);
  }, [interventions, interventionById, placementOrder, reviewed, reviewResults, placed]);

  const freezeThanksVideo = useCallback(() => {
    const el = thanksVideoRef.current;
    if (!el) return;
    try {
      el.pause();
      if (Number.isFinite(el.duration) && el.duration > 0) {
        el.currentTime = Math.max(0, el.duration - 0.04);
      }
    } catch {
      /* ignore seek errors */
    }
  }, []);

  const openFinalReview = useCallback(() => {
    const panelW = Math.min(520, window.innerWidth - 32);
    setPostVideoRows(computePostVideoRows());
    setDockCollapsed(true);
    setReviewPanelCollapsed(false);
    setReviewPanelPos({
      x: Math.max(16, (window.innerWidth - panelW) / 2),
      y: Math.max(56, window.innerHeight - 280),
    });
    setShowPostVideoReview(true);
  }, [computePostVideoRows]);

  const completeNow = useCallback(
    (result) => {
      setShowThanksVideo(false);
      setActiveThanksVideo(null);
      setThanksVideoIssue('');
      setShowPostVideoReview(false);
      setPostVideoRows([]);
      setReviewPanelCollapsed(false);
      setPendingCompleteResult(null);
      onComplete(result);
    },
    [onComplete],
  );

  const playThanksAndComplete = useCallback(
    async (result) => {
      if (!result || result.accuracy < completionThreshold) {
        showToast(
          `Need ${completionThreshold}% accuracy to finish — currently ${result?.accuracy ?? 0}%`,
          'bad',
        );
        return;
      }
      const videoPool = Array.isArray(caseData?.thanksDoctorVideos)
        ? caseData.thanksDoctorVideos.filter(Boolean)
        : [];
      const fallback = caseData?.thanksDoctorVideo || null;
      const candidates = videoPool.length ? videoPool : fallback ? [fallback] : [];
      setPendingCompleteResult(result);
      if (!candidates.length) {
        setThanksVideoIssue('No thank-you video configured for this build.');
        openFinalReview();
        return;
      }
      const shuffled = [...candidates].sort(() => Math.random() - 0.5);
      let picked = null;
      for (const candidate of shuffled) {
        try {
          const resp = await fetch(candidate, { method: 'GET', cache: 'no-store' });
          if (resp.ok) {
            picked = candidate;
            break;
          }
        } catch {
          /* try next candidate */
        }
      }
      if (!picked) {
        setThanksVideoIssue('Video file missing. Add MP4 files to public/assets/video.');
        showToast('Thank-you video asset missing. Opening review instead.', 'bad');
        openFinalReview();
        return;
      }
      setThanksVideoIssue('');
      setActiveThanksVideo(picked);
      setShowThanksVideo(true);
    },
    [caseData?.thanksDoctorVideo, caseData?.thanksDoctorVideos, openFinalReview, completionThreshold],
  );

  const playThanksPreview = useCallback(() => {
    if (!reviewed) {
      showToast('Run Review first — case cannot advance until reviewed.', 'bad');
      return;
    }
    const secs = Math.round((Date.now() - startRef.current) / 1000);
    const correct = interventions.filter((iv) => reviewResults[iv.id]).length;
    const acc = total > 0 ? Math.round((correct / total) * 100) : 0;
    if (acc < completionThreshold || doneCount < total) {
      showToast(
        `Need ${completionThreshold}% with all stacks placed (now ${acc}%, ${doneCount}/${total})`,
        'bad',
      );
      return;
    }
    const result = {
      attempts: Math.max(1, reviewCount || 1),
      accuracy: acc,
      seconds: secs,
    };
    void playThanksAndComplete(result);
  }, [
    playThanksAndComplete,
    reviewCount,
    reviewed,
    reviewResults,
    interventions,
    total,
    doneCount,
    completionThreshold,
  ]);

  const flashScreen = (kind) => {
    setFlash(kind);
    setTimeout(() => setFlash(''), 280);
  };

  const snapWrapHome = (wrap) => {
    if (!wrap) return;
    wrap.style.transition = `transform ${dragCfg.snapBackMs}ms cubic-bezier(0.34, 1.56, 0.64, 1)`;
    wrap.style.transform = 'translate(0, 0)';
    wrap.setAttribute('data-x', '0');
    wrap.setAttribute('data-y', '0');
    setTimeout(() => {
      wrap.style.transition = '';
    }, dragCfg.snapBackMs + 20);
  };

  const handleDrop = useCallback(
    (ivId, target, { wrap, zone, pill }) => {
      const iv = interventions.find((i) => i.id === ivId);
      if (!iv) {
        flashScreen('bad');
        playWrong();
        showToast(
          teachMeMode
            ? 'Teach mode: not emergent now. Re-prioritize life-threatening steps first.'
            : 'Killed the patient — harmful or irrelevant action.',
          'bad',
        );
        snapWrapHome(wrap);
        return;
      }

      const isGrid = typeof target === 'object' && target != null && 'col' in target;
      const ok = isGrid
        ? isCorrectGridPlacement(iv, target, zones)
        : iv.correct_zone === target;

      if (dropMode === 'strict' && !ok) {
        if (zone) {
          zone.classList.add('zone-hover');
          setTimeout(() => zone.classList.remove('zone-hover'), 280);
        }
        snapWrapHome(wrap);
        showToast('Strict mode: wrong cell blocked', 'bad');
        return;
      }

      pill.dataset.placed = 'false';
      wrap.classList.remove('pill-placed');
      if (zone) zone.classList.remove('zone-done');

      setPlaced((p) => ({ ...p, [iv.id]: target }));
      setPlacementOrder((prev) => (prev.includes(iv.id) ? prev : [...prev, iv.id]));
      setReviewed(false);
      setReviewResults({});
      setOrderReview({});
      const pinPayload = isGrid
        ? { ...target, label: iv.label, ivId: iv.id, ok: null }
        : { zoneId: target, label: iv.label, ivId: iv.id, ok: null };
      setPins((prev) => [
        ...prev.filter((pin) => pin.ivId !== iv.id && pin.label !== iv.label),
        pinPayload,
      ]);
      setReviewedAt(null);
      setWhyPanel(null);
      showToast(`Placed ${iv.label}`, '');
    },
    [interventions, dropMode, dragCfg.snapBackMs, zones, teachMeMode],
  );

  const handleMovePin = useCallback(
    (ivId, cell) => {
      const iv = interventions.find((i) => i.id === ivId);
      if (!iv) return;
      setPlaced((p) => ({ ...p, [ivId]: cell }));
      setReviewed(false);
      setReviewResults({});
      setOrderReview({});
      setPins((prev) =>
        prev.map((pin) =>
          pin.ivId === ivId ? { ...pin, ...cell, label: iv.label, ok: null } : pin,
        ),
      );
      setReviewedAt(null);
      showToast(`Moved ${iv.label}`, '');
    },
    [interventions],
  );

  const returnStackToDock = useCallback(
    (ivId, { wrap } = {}) => {
      const iv = interventions.find((i) => i.id === ivId) || stackItems.find((i) => i.id === ivId);
      setPlaced((p) => {
        if (!(ivId in p)) return p;
        const next = { ...p };
        delete next[ivId];
        return next;
      });
      setPlacementOrder((prev) => prev.filter((id) => id !== ivId));
      setPins((prev) => prev.filter((pin) => pin.ivId !== ivId));
      setReviewed(false);
      setReviewResults({});
      setOrderReview({});
      setReviewedAt(null);
      if (wrap) {
        if (wrap.classList?.contains('pin-grid')) {
          wrap.style.transition = `transform ${dragCfg.snapBackMs}ms cubic-bezier(0.34, 1.56, 0.64, 1)`;
          wrap.style.transform = 'translate(-50%, -100%)';
          wrap.setAttribute('data-x', '0');
          wrap.setAttribute('data-y', '0');
        } else {
          wrap.style.transition = `transform ${dragCfg.snapBackMs}ms cubic-bezier(0.34, 1.56, 0.64, 1)`;
          wrap.style.transform = 'translate(0, 0)';
          wrap.setAttribute('data-x', '0');
          wrap.setAttribute('data-y', '0');
        }
      }
      showToast(`Returned ${iv?.label || 'stack'} to dock`, '');
    },
    [interventions, stackItems, dragCfg.snapBackMs],
  );

  const reviewPlacements = useCallback(() => {
    const results = {};
    const orderResults = {};
    const nextPins = [];
    let correct = 0;
    let placedCount = 0;

    interventions.forEach((iv) => {
      const p = placed[iv.id];
      if (!p) return;
      placedCount += 1;
      const ok = useGridPlacement
        ? isCorrectGridPlacement(iv, p, zones)
        : iv.correct_zone === p;
      results[iv.id] = ok;
      if (ok) correct += 1;
      if (typeof p === 'object' && p != null && 'col' in p) {
        nextPins.push({ ...p, ivId: iv.id, label: iv.label, ok });
      } else {
        nextPins.push({ zoneId: p, ivId: iv.id, label: iv.label, ok });
      }
    });

    const reviewNum = reviewCount + 1;
    setReviewCount(reviewNum);
    setAttempts(reviewNum);
    setCorrectAttempts(correct);
    setReviewed(true);
    setReviewedAt(new Date());
    setReviewResults(results);
    setPins(nextPins);

    if (placedCount < total) {
      playWrong();
      showToast(`Review: ${placedCount}/${total} placed`, 'bad');
      return;
    }

    const expectedOrder = interventions.map((iv) => iv.id);
    const placedRanks = new Map(placementOrder.map((id, idx) => [id, idx + 1]));
    const expectedRanks = new Map(expectedOrder.map((id, idx) => [id, idx + 1]));
    let orderMismatches = 0;
    const acc = Math.round((correct / total) * 100);
    setPostVideoRows(computePostVideoRows({ results, placementOrder }));
    interventions.forEach((iv) => {
      const po = placedRanks.get(iv.id) || null;
      const eo = expectedRanks.get(iv.id) || null;
      orderResults[iv.id] = po != null && eo != null ? po === eo : null;
      if (po && eo && po !== eo) orderMismatches += 1;
    });
    setOrderReview(orderResults);
    const minCorrect = Math.ceil(total * (completionThreshold / 100));
    const meetsThreshold = acc >= completionThreshold && correct >= minCorrect;
    if (meetsThreshold) {
      flashScreen('ok');
      playComplete();
      const secs = Math.round((Date.now() - startRef.current) / 1000);
      if (orderMismatches > 0) {
        showToast(
          `Accuracy ${acc}% — ${orderMismatches} stack(s) out of emergent order.`,
          'bad',
        );
      } else {
        showToast(`Case ready — ${acc}% (≥${completionThreshold}%)`, 'ok');
      }
      const result = { attempts: reviewNum, accuracy: acc, seconds: secs };
      setTimeout(() => playThanksAndComplete(result), 900);
    } else if (correct === total && acc < completionThreshold) {
      flashScreen('bad');
      playWrong();
      showToast(`Need ${completionThreshold}% to advance (now ${acc}%)`, 'bad');
    } else {
      flashScreen('bad');
      playWrong();
      showToast(`Review: ${correct}/${total} correct`, 'bad');
    }
  }, [
    interventions,
    placed,
    reviewCount,
    total,
    useGridPlacement,
    zones,
    playThanksAndComplete,
    placementOrder,
    computePostVideoRows,
    completionThreshold,
  ]);

  useDragGame({
    sceneRef,
    enabled: !timedOut && !useGridPlacement,
    placed,
    overlap: dragCfg.overlap,
    snapBackMs: dragCfg.snapBackMs,
    onDrop: handleDrop,
    onReturnToDock: returnStackToDock,
  });

  useGridDragGame({
    sceneRef,
    enabled: !timedOut && useGridPlacement,
    overlap: dragCfg.overlap,
    snapBackMs: dragCfg.snapBackMs,
    onDrop: handleDrop,
    onMovePin: handleMovePin,
    onReturnToDock: returnStackToDock,
  });

  const zoneLit = showCues && (dragging || showZonesAlways);
  const misses = Math.max(0, attempts - correctAttempts);
  const lifePct = Math.max(8, Math.min(100, 42 + doneCount * 12 - misses * 8));
  const lifeState = lifePct > 70 ? 'stable' : lifePct > 40 ? 'guarded' : 'critical';
  const timerState = timeLeft > 60 ? 'safe' : timeLeft > 25 ? 'warn' : 'critical';
  const timerLabel = `${Math.floor(timeLeft / 60)
    .toString()
    .padStart(2, '0')}:${(timeLeft % 60).toString().padStart(2, '0')}`;

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE.showCues, showCues ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [showCues]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE.dropMode, dropMode);
    } catch {
      /* ignore */
    }
  }, [dropMode]);

  useEffect(() => {
    const onFs = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  const syncImageFrame = useCallback(() => {
    const sceneEl = sceneRef.current;
    const imgEl = patientImgRef.current;
    if (!sceneEl || !imgEl) return;
    const sr = sceneEl.getBoundingClientRect();
    const ir = imgEl.getBoundingClientRect();
    if (!sr.width || !sr.height || !ir.width || !ir.height) return;
    setImageFrame({
      x: (ir.left - sr.left) / sr.width,
      y: (ir.top - sr.top) / sr.height,
      w: ir.width / sr.width,
      h: ir.height / sr.height,
    });
  }, []);

  useEffect(() => {
    syncImageFrame();
    const onResize = () => syncImageFrame();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [syncImageFrame]);

  useEffect(() => {
    if (!dockDragging) return undefined;

    const onMove = (event) => {
      const width = layout.sidebarWidthPx || 360;
      const height = dockRef.current?.offsetHeight || 520;
      const x = event.clientX - dockDragRef.current.dx;
      const y = event.clientY - dockDragRef.current.dy;
      const clampedX = Math.min(Math.max(8, x), Math.max(8, window.innerWidth - width - 8));
      const clampedY = Math.min(Math.max(48, y), Math.max(48, window.innerHeight - height - 44));
      setDockPos({ x: clampedX, y: clampedY });
    };

    const onUp = () => {
      dockDragRef.current.active = false;
      setDockDragging(false);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [dockDragging, layout.sidebarWidthPx]);

  const onDockDragStart = (event) => {
    if (event.button !== 0 || dockCollapsed) return;
    const rect = dockRef.current?.getBoundingClientRect();
    if (!rect) return;
    dockDragRef.current = {
      active: true,
      dx: event.clientX - rect.left,
      dy: event.clientY - rect.top,
    };
    setDockDragging(true);
  };

  useEffect(() => {
    if (!reviewPanelDragging) return undefined;

    const onMove = (event) => {
      const width = reviewPanelRef.current?.offsetWidth || 520;
      const height = reviewPanelRef.current?.offsetHeight || 280;
      const x = event.clientX - reviewPanelDragRef.current.dx;
      const y = event.clientY - reviewPanelDragRef.current.dy;
      const clampedX = Math.min(Math.max(8, x), Math.max(8, window.innerWidth - width - 8));
      const clampedY = Math.min(Math.max(48, y), Math.max(48, window.innerHeight - height - 8));
      setReviewPanelPos({ x: clampedX, y: clampedY });
    };

    const onUp = () => setReviewPanelDragging(false);

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [reviewPanelDragging]);

  const onReviewPanelDragStart = (event) => {
    if (event.button !== 0) return;
    const rect = reviewPanelRef.current?.getBoundingClientRect();
    if (!rect) return;
    reviewPanelDragRef.current = {
      dx: event.clientX - rect.left,
      dy: event.clientY - rect.top,
    };
    setReviewPanelDragging(true);
  };

  const resetPlacements = () => {
    setPlaced({});
    setPlacementOrder([]);
    setPins([]);
    setReviewed(false);
    setReviewResults({});
    setOrderReview({});
    setReviewedAt(null);
    setExpandedStackId(null);
    setWhyPanel(null);
    showToast('Placements reset', '');
  };

  const persistGridItems = useCallback(
    (next) => {
      setGridItems(next);
      if (studioCapture) {
        writeGridItems(`${STORAGE.playGridItems}_${caseData.id}`, next);
      }
    },
    [studioCapture, caseData.id],
  );

  const placeGridStack = useCallback(
    (cell) => {
      const unitItems = gridItems.filter((it) => it.unit === careUnit);
      const item = createGridItem({
        ...cell,
        label: `Stack ${unitItems.length + 1}`,
        meta: { unit: careUnit },
      });
      const next = [...gridItems, item];
      persistGridItems(next);
      showToast(`Grid ${item.col + 1},${item.row + 1}`, '');
    },
    [gridItems, careUnit, persistGridItems],
  );

  const moveGridStack = useCallback(
    (id, cell) => {
      const next = moveGridItem(gridItems, id, cell);
      persistGridItems(next);
      setSelectedGridId(null);
      showToast('Moved', '');
    },
    [gridItems, persistGridItems],
  );

  const removeGridStack = useCallback(
    (id) => {
      persistGridItems(gridItems.filter((it) => it.id !== id));
      showToast('Removed', '');
    },
    [gridItems, persistGridItems],
  );

  const capturePlayScreenshot = async () => {
    const el = captureRef.current;
    if (!el || captureBusy) return;
    setCaptureBusy(true);
    try {
      const attempt = nextAttemptNumber(caseNumber);
      const result = await saveScreenshotToServer({
        element: el,
        caseNumber,
        attempt,
        meta: {
          mode: 'play-capture',
          caseId: caseData.id,
          title: caseData.title,
          careUnit,
          placed,
          gridItems,
          reviewCount,
          doneCount,
          total,
          grid: { cols: GRID_COLS, rows: GRID_ROWS },
        },
      });
      showToast(`Saved captures/${result.relative}`, 'ok');
    } catch (e) {
      showToast(e.message || 'Screenshot failed', 'bad');
    } finally {
      setCaptureBusy(false);
    }
  };

  const caseAccuracy = useMemo(() => {
    if (!total) return 0;
    if (reviewed) {
      const correct = interventions.filter((iv) => reviewResults[iv.id]).length;
      return Math.round((correct / total) * 100);
    }
    if (attempts > 0) return Math.round((correctAttempts / attempts) * 100);
    return 0;
  }, [reviewed, reviewResults, interventions, total, attempts, correctAttempts]);

  const canLeaveER =
    reviewed && doneCount >= total && caseAccuracy >= completionThreshold;

  const switchCareUnit = useCallback(
    (unit) => {
      if (unit === careUnit) return;
      if (unit !== 'ER' && !canLeaveER) {
        showToast(
          `Stay in ER until ${completionThreshold}% — review all stacks (now ${caseAccuracy}%)`,
          'bad',
        );
        return;
      }
      setCareUnit(unit);
      const labels = {
        ER: 'Emergency Department',
        OBS: 'Observation unit',
        ICU: 'Intensive care',
        WARD: 'Inpatient ward',
      };
      showToast(labels[unit] || `Moved to ${unit}`, 'ok');
    },
    [careUnit, canLeaveER, caseAccuracy, completionThreshold],
  );

  useEffect(() => {
    if (careUnit !== 'ER' && !canLeaveER) setCareUnit('ER');
  }, [careUnit, canLeaveER]);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    writeTheme(next);
  };

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      /* ignore */
    }
  };

  const ensureSceneForUnit = useCallback(
    async (unit) => {
      if (!unit || unit === 'ER' || sceneByUnit[unit] || !sceneSourceSig) return;
      setSceneBusy(true);
      try {
        const payload = await getPatientImagePayload(caseData);
        const resp = await fetch('http://127.0.0.1:3001/api/generate-scene', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64: payload.base64,
            mimeType: payload.mimeType || 'image/png',
            location: unit,
          }),
        });
        if (!resp.ok) {
          const err = await resp.text();
          throw new Error(err || `Failed to generate ${unit} scene`);
        }
        const data = await resp.json();
        const nextUrl = data?.url;
        if (!nextUrl) throw new Error('Missing generated scene URL');
        setSceneByUnit((prev) => {
          const next = { ...prev, [unit]: nextUrl };
          try {
            const raw = localStorage.getItem(STORAGE.sceneVariants);
            const parsed = raw ? JSON.parse(raw) : {};
            parsed[sceneSourceSig] = { ...(parsed[sceneSourceSig] || {}), [unit]: nextUrl };
            localStorage.setItem(STORAGE.sceneVariants, JSON.stringify(parsed));
          } catch {
            /* ignore */
          }
          return next;
        });
      } catch (e) {
        showToast(`Scene switch failed (${unit})`, 'bad');
      } finally {
        setSceneBusy(false);
      }
    },
    [sceneByUnit, sceneSourceSig],
  );

  useEffect(() => {
    void ensureSceneForUnit(careUnit);
  }, [careUnit, ensureSceneForUnit]);

  useEffect(() => {
    // Best-effort immersive mode after entering Play.
    if (document.fullscreenElement) return;
    document.documentElement.requestFullscreen?.().catch(() => {});
  }, []);

  useEffect(() => {
    if (teachMeMode || timedOut || doneCount >= total || timeLeft <= 0) return undefined;
    const tick = setInterval(() => {
      setTimeLeft((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(tick);
  }, [teachMeMode, timedOut, doneCount, total, timeLeft]);

  useEffect(() => {
    if (timedOut || doneCount >= total || timeLeft > 0) return;
    setTimedOut(true);
    showToast(
      `Time is up — stay in ER until ${completionThreshold}% accuracy. Keep practicing.`,
      'bad',
    );
  }, [timeLeft, timedOut, doneCount, total, completionThreshold]);

  useEffect(() => {
    // In Teach Me mode, auto-run review once all core stacks are placed.
    // This lets completion/video trigger without requiring an extra click.
    if (!teachMeMode || reviewed || timedOut) return;
    if (doneCount !== total || total === 0) return;
    reviewPlacements();
  }, [teachMeMode, reviewed, timedOut, doneCount, total, reviewPlacements]);

  const finalMode = showThanksVideo || showPostVideoReview;

  useEffect(() => {
    if (!finalMode) return undefined;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [finalMode]);

  useEffect(() => {
    if (finalMode) setDockCollapsed(true);
  }, [finalMode]);

  useEffect(() => {
    if (!showThanksVideo) return;
    const el = thanksVideoRef.current;
    if (!el) return;
    el.muted = false;
    el.currentTime = 0;
    el.play().catch(() => {
      el.muted = true;
      el.play().catch(() => {
        showToast('Tap play on the video to continue.', 'bad');
      });
    });
  }, [showThanksVideo]);

  return (
    <div
      className={`game ${finalMode ? 'final-mode' : ''}`}
      style={{
        gridTemplateColumns: '1fr',
        ['--algo-h']: `${layout.algorithmPanelHeightPx || 220}px`,
        ['--pill-h']: `${layout.pillRowHeightPx || 52}px`,
      }}
    >
      <div className="game-scene" ref={sceneRef}>
        <div className="game-scene-capture" ref={studioCapture ? captureRef : null}>
        <div className="play-hud">
          <span className="play-hud-case">
            ◈ Case {caseData.ccsNumber} — {caseData.title}
          </span>
          <div className="play-hud-right">
            <div className="care-switch" role="tablist" aria-label="Care unit">
              {(caseFlow.dispositionUnits || ['ER', 'OBS', 'ICU', 'WARD']).map((u) => {
                const locked = u !== 'ER' && !canLeaveER;
                return (
                  <button
                    key={u}
                    type="button"
                    className={`care-chip ${careUnit === u ? 'active' : ''} ${locked ? 'locked' : ''}`}
                    onClick={() => switchCareUnit(u)}
                    aria-selected={careUnit === u}
                    disabled={locked}
                    title={
                      locked
                        ? `Unlock at ${completionThreshold}% after reviewing all stacks`
                        : undefined
                    }
                  >
                    {u}
                  </button>
                );
              })}
            </div>
            <span className={`play-hud-timer ${timerState}`}>{timerLabel}</span>
            <button type="button" className="play-hud-exit" onClick={onQuit} title="Exit case">
              Exit
            </button>
          </div>
        </div>
        <div className="play-life-top-left">
          <div className="pack-life-head">
            <span>Patient life</span>
            <span className={`pack-life-state ${lifeState}`}>{lifeState}</span>
          </div>
          <div className="pack-life-track" aria-label="Patient life bar">
            <div className={`pack-life-fill ${lifeState}`} style={{ width: `${lifePct}%` }} />
          </div>
        </div>
        <PatientScene
          scene={caseData.patientScene}
          imgRef={patientImgRef}
          onLoad={syncImageFrame}
          forceSrc={sceneByUnit[careUnit] || sceneByUnit.ER || null}
        />
        {sceneBusy && careUnit !== 'ER' && (
          <div className="scene-generating-badge">Generating {careUnit} scene… cached after first run</div>
        )}
        {useGridPlacement && (
          <SceneGridOverlay
            frame={imageFrame}
            visible={showCues && dragging}
            dropTarget
          />
        )}
        {studioCapture && (
          <GridPlacementLayer
            frame={imageFrame}
            items={gridItems.filter((it) => it.unit === careUnit)}
            visible={showGrid}
            placeMode={placeMode}
            selectedId={selectedGridId}
            onPlaceCell={placeGridStack}
            onSelect={setSelectedGridId}
            onMove={moveGridStack}
            onRemove={removeGridStack}
          />
        )}
        {!useGridPlacement &&
          Object.entries(zones).map(([zoneId, z]) => {
          const isPlaced = Object.values(placed).includes(zoneId);
          const isDone = reviewed && isPlaced;
          const show = zoneLit && !isDone;
          const color = zoneColors[zoneId] || '#e8b84b';
          const zoneLeftPct = frameLeft + z.cx * frameW;
          const zoneTopPct = frameTop + z.cy * frameH;
          const zoneWPercent = z.w * frameW * hitboxScale;
          const zoneHPercent = z.h * frameH * hitboxScale;
          return (
            <div
              key={zoneId}
              className={`drop-zone ${show ? 'zone-lit' : ''} ${showCues && showZonesAlways && !isDone ? 'zone-idle' : ''} ${!showCues && !isDone ? 'zone-active-drop' : ''} ${isDone ? 'zone-done' : ''}`}
              data-zone-id={zoneId}
              style={{
                left: `${zoneLeftPct}%`,
                top: `${zoneTopPct}%`,
                width: `max(${minHitPx}px, ${zoneWPercent}%)`,
                height: `max(${minHitPx}px, ${zoneHPercent}%)`,
                ['--zone-color']: color,
              }}
            >
              <span className="zone-label">{z.label}</span>
              {reviewed && isPlaced && placedByZone[zoneId] && (
                <span className="zone-result">{placedByZone[zoneId]}</span>
              )}
            </div>
          );
        })}
        {pins.map((p, i) => {
          let leftPct;
          let topPct;
          if (p.cx != null && p.cy != null) {
            leftPct = p.cx * 100;
            topPct = p.cy * 100;
          } else {
            const z = zones[p.zoneId];
            if (!z) return null;
            leftPct = frameLeft + z.cx * frameW;
            topPct = frameTop + z.cy * frameH;
          }
          return (
            <div
              key={`${p.ivId || p.zoneId}-${i}-${p.label}`}
              className={`pin ${useGridPlacement ? 'pin-grid' : ''} ${p.ok === true ? 'ok' : ''} ${p.ok === false ? 'bad' : ''}`}
              data-iv-id={p.ivId || ''}
              data-x="0"
              data-y="0"
              onClick={() => {
                if (!p.ivId) return;
                setDockCollapsed(false);
                setExpandedStackId((prev) => (prev === p.ivId ? null : p.ivId));
              }}
              style={{
                left: `${leftPct}%`,
                top: `${topPct}%`,
              }}
              title={useGridPlacement ? 'Drag to move pin' : undefined}
            >
              <span className="pin-label">{p.label}</span>
            </div>
          );
        })}
        <div className={`flash ${flash}`} />
        {showThanksVideo && (
          <div
            className={`thanks-video-overlay ${showPostVideoReview ? 'frozen' : ''}`}
            role="dialog"
            aria-modal="true"
            aria-label="Patient thanks doctor"
          >
            <video
              ref={thanksVideoRef}
              className="thanks-video-player"
              src={activeThanksVideo || caseData.thanksDoctorVideo}
              style={{ objectPosition: caseData.patientScene?.objectPosition || 'center center' }}
              autoPlay
              playsInline
              muted
              onError={() => {
                setThanksVideoIssue('Video failed to load. Check public/assets/video paths.');
                showToast('Video failed to load. Opening review panel instead.', 'bad');
                setShowThanksVideo(false);
                openFinalReview();
              }}
              onEnded={() => {
                freezeThanksVideo();
                openFinalReview();
              }}
            />
            {!showPostVideoReview && (
              <button
                type="button"
                className="thanks-video-skip btn-ghost"
                onClick={() => {
                  freezeThanksVideo();
                  openFinalReview();
                }}
              >
                Skip →
              </button>
            )}
          </div>
        )}
        <div className={`scene-drawer ${activeDrawer === 'vitals' ? 'open' : ''}`}>
          <div className="scene-drawer-head">
            <span>Vitals monitor · {careUnit} · {caseFlow.flowTrack}</span>
            <button type="button" onClick={() => setActiveDrawer(null)}>✕</button>
          </div>
          <div className="vitals-grid">
            <div className={`vital-box ${vitals.sbp < 95 ? 'crit' : 'ok'}`}>
              <span className="vital-k">BP</span>
              <span className="vital-v">{vitals.sbp}/{vitals.dbp}</span>
            </div>
            <div className={`vital-box ${vitals.hr > 110 ? 'warn' : 'ok'}`}>
              <span className="vital-k">HR</span>
              <span className="vital-v">{vitals.hr}</span>
            </div>
            <div className={`vital-box ${vitals.rr > 22 ? 'warn' : 'ok'}`}>
              <span className="vital-k">RR</span>
              <span className="vital-v">{vitals.rr}</span>
            </div>
            <div className={`vital-box ${vitals.temp >= 38 ? 'warn' : 'ok'}`}>
              <span className="vital-k">Temp</span>
              <span className="vital-v">{vitals.temp.toFixed(1)}</span>
            </div>
            <div className={`vital-box ${vitals.spo2 < 92 ? 'crit' : 'ok'}`}>
              <span className="vital-k">SpO₂</span>
              <span className="vital-v">{vitals.spo2}%</span>
            </div>
            <div className={`vital-box ${vitals.lactate >= 2 ? 'crit' : 'ok'}`}>
              <span className="vital-k">Lactate</span>
              <span className="vital-v">{vitals.lactate.toFixed(1)}</span>
            </div>
          </div>
        </div>
        <div className={`scene-drawer ${activeDrawer === 'exam' ? 'open' : ''}`}>
          <div className="scene-drawer-head">
            <span>Physical exam · {careUnit}</span>
            <button type="button" onClick={() => setActiveDrawer(null)}>✕</button>
          </div>
          <div className="exam-grid">
            {exam.map(([k, v]) => (
              <div key={k} className="exam-box">
                <p className="exam-k">{k}</p>
                <p className="exam-v">{v}</p>
              </div>
            ))}
          </div>
        </div>
        <div className={`scene-drawer scene-drawer-soap ${activeDrawer === 'history' ? 'open' : ''}`}>
          <div className="scene-drawer-head">
            <span>Clinical note · SOAP</span>
            <button type="button" onClick={() => setActiveDrawer(null)}>✕</button>
          </div>
          <div className="soap-wrap">
            <section className="soap-section">
              <h4 className="soap-heading">S: Subjective</h4>
              <p className="soap-body">{soapParts.subjective}</p>
            </section>
            <section className="soap-section">
              <h4 className="soap-heading">O: Objective</h4>
              <p className="soap-body">{soapParts.objective}</p>
            </section>
            <section className={`soap-section soap-gated ${assessmentRevealed ? 'revealed' : 'locked'}`}>
              <h4 className="soap-heading">A: Assessment</h4>
              <label className="soap-prompt" htmlFor="soap-assessment-input">
                Write your assessment first — reference answer stays hidden until you do.
              </label>
              <textarea
                id="soap-assessment-input"
                className="soap-input"
                rows={4}
                placeholder="Your working assessment…"
                value={userAssessment}
                onChange={(e) => {
                  setUserAssessment(e.target.value);
                  if (assessmentRevealed && e.target.value.trim().length < SOAP_MIN_CHARS) {
                    setAssessmentRevealed(false);
                  }
                }}
              />
              {!assessmentRevealed ? (
                <button
                  type="button"
                  className="btn-ghost soap-reveal-btn"
                  disabled={userAssessment.trim().length < SOAP_MIN_CHARS}
                  onClick={() => setAssessmentRevealed(true)}
                >
                  Reveal reference assessment
                </button>
              ) : (
                <div className="soap-answer">
                  <p className="soap-answer-label">Reference assessment</p>
                  <p className="soap-body">{soapParts.assessment}</p>
                </div>
              )}
            </section>
            <section className={`soap-section soap-gated ${planRevealed ? 'revealed' : 'locked'}`}>
              <h4 className="soap-heading">P: Plan</h4>
              <label className="soap-prompt" htmlFor="soap-plan-input">
                Write your plan first — reference plan unlocks after your entry.
              </label>
              <textarea
                id="soap-plan-input"
                className="soap-input"
                rows={4}
                placeholder="Your working plan…"
                value={userPlan}
                onChange={(e) => {
                  setUserPlan(e.target.value);
                  if (planRevealed && e.target.value.trim().length < SOAP_MIN_CHARS) {
                    setPlanRevealed(false);
                  }
                }}
              />
              {!planRevealed ? (
                <button
                  type="button"
                  className="btn-ghost soap-reveal-btn"
                  disabled={userPlan.trim().length < SOAP_MIN_CHARS}
                  onClick={() => setPlanRevealed(true)}
                >
                  Reveal reference plan
                </button>
              ) : (
                <div className="soap-answer">
                  <p className="soap-answer-label">Reference plan</p>
                  <p className="soap-body">{soapParts.plan}</p>
                </div>
              )}
            </section>
          </div>
        </div>
        </div>
      </div>

      {showPostVideoReview && (
        <div
          ref={reviewPanelRef}
          className={`post-review-panel ${reviewPanelCollapsed ? 'collapsed' : ''} ${reviewPanelDragging ? 'dragging' : ''}`}
          style={{ left: `${reviewPanelPos.x}px`, top: `${reviewPanelPos.y}px` }}
          role="dialog"
          aria-label="Review breakdown"
        >
          <div
            className="post-review-handle"
            onPointerDown={onReviewPanelDragStart}
            title="Drag to move"
          >
            <span className="post-review-handle-grip">⋮⋮</span>
            <div className="post-review-handle-text">
              <span className="post-review-kicker">Review breakdown</span>
              <strong>What was correct and why</strong>
            </div>
            <div className="post-review-handle-actions">
              <button
                type="button"
                className="post-review-icon-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  setReviewPanelCollapsed((v) => !v);
                }}
                title={reviewPanelCollapsed ? 'Expand panel' : 'Minimize panel'}
              >
                {reviewPanelCollapsed ? <FiMaximize2 size={14} /> : <FiMinimize2 size={14} />}
              </button>
            </div>
          </div>
          {!reviewPanelCollapsed && (
            <div className="post-review-body">
              {thanksVideoIssue && (
                <p className="post-review-guideline post-review-video-note">
                  Video note: {thanksVideoIssue}
                </p>
              )}
              {postVideoRows.length > 0 && (
                <div className="post-review-flow-wrap">
                  <p className="post-review-flow-label">Emergent flow</p>
                  <div className="post-review-flow" aria-label="Expected clinical flow">
                    {postVideoRows.map((row) => (
                      <span
                        key={row.id}
                        className={`post-review-flow-chip ${row.ok ? 'ok' : 'bad'} ${row.orderOk === false ? 'order-late' : ''}`}
                        title={`${row.seq}. ${row.label}`}
                      >
                        {row.seq}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <div className="post-review-list">
                {postVideoRows.length === 0 && (
                  <p className="post-review-empty">Complete a review to see stack rationales here.</p>
                )}
                {postVideoRows.map((row) => (
                  <article key={row.id} className={`post-review-row ${row.ok ? 'ok' : 'bad'}`}>
                    <div className="post-review-head">
                      <span className="post-review-step">#{row.seq}</span>
                      <span className="post-review-status">
                        {row.ok
                          ? row.orderOk === false
                            ? 'Late order'
                            : 'Correct'
                          : 'Needs review'}
                      </span>
                      <strong className="post-review-label">{row.label}</strong>
                    </div>
                    <p className="post-review-why">{row.why}</p>
                    {(row.guideline || row.placedOrder != null) && (
                      <p className="post-review-meta">
                        {row.placedOrder != null && (
                          <span>
                            Emergent #{row.expectedOrder}
                            {row.placedOrder ? ` · placed #${row.placedOrder}` : ' · not placed'}
                          </span>
                        )}
                        {row.guideline && <span> · {row.guideline}</span>}
                      </p>
                    )}
                  </article>
                ))}
              </div>
              <div className="post-review-actions">
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => {
                    if (pendingCompleteResult) completeNow(pendingCompleteResult);
                  }}
                >
                  Continue →
                </button>
              </div>
            </div>
          )}
          {reviewPanelCollapsed && (
            <div className="post-review-collapsed-foot">
              <span>{postVideoRows.length} stacks · drag header to move</span>
              <button
                type="button"
                className="btn-primary btn-sm"
                onClick={() => {
                  if (pendingCompleteResult) completeNow(pendingCompleteResult);
                }}
              >
                Continue →
              </button>
            </div>
          )}
        </div>
      )}

      <aside
        ref={dockRef}
        className={`game-sidebar floating dock-return-zone ${dockCollapsed ? 'collapsed' : ''} ${dockDragging ? 'dragging' : ''} ${finalMode ? 'final-mode-minimized' : ''}`}
        style={{
          left: `${dockPos.x}px`,
          top: `${dockPos.y}px`,
          width: `${layout.sidebarWidthPx || 360}px`,
        }}
      >
        <div className="dock-handle" onPointerDown={onDockDragStart} title="Drag to move panel">
          ⋮⋮ {brand.name}
        </div>
        <div className="sidebar-top clinical-pack-top">
          <div className="pack-heading-row">
            <p className="sidebar-case-id">Case {caseData.ccsNumber}</p>
            <span className="pack-tag">{brand.name}</span>
          </div>
          <h2 className="sidebar-title" title={caseData.title}>
            {caseData.title}
          </h2>
          <div className="case-info-tabs" role="tablist" aria-label="Case context tabs">
            <button
              type="button"
              className={infoTab === 'hpi' ? 'case-info-tab active' : 'case-info-tab'}
              onClick={() => setInfoTab('hpi')}
              aria-selected={infoTab === 'hpi'}
            >
              HPI
            </button>
            <button
              type="button"
              className={infoTab === 'exam' ? 'case-info-tab active' : 'case-info-tab'}
              onClick={() => setInfoTab('exam')}
              aria-selected={infoTab === 'exam'}
            >
              Physical exam
            </button>
          </div>
          <p className="sub" title={infoTab === 'hpi' ? caseData.chief_complaint : examSummary}>
            {infoTab === 'hpi' ? caseData.chief_complaint : examSummary || 'No physical exam findings documented yet.'}
          </p>
          <div className="pack-stats">
            <span>Ready {total - doneCount}</span>
            <span>Placed {doneCount}/{total}</span>
          </div>
          <div className={`pack-timer ${timerState}`}>
            <span>Save timer</span>
            <strong>{timerLabel}</strong>
          </div>
        </div>
        <section className="sidebar-stacks" aria-label="Treatment stacks">
          <p className="sidebar-section-label">Stacks — drag to patient</p>
          {teachMeMode && (
            <div className="teach-panel">
              <p className="teach-title">Teach Me Flow</p>
              <div className="teach-flow" aria-label="Clinical flow diagram">
                {expectedOrderIds.map((id, idx) => {
                  const iv = interventionById[id];
                  const done = Boolean(placed[id]);
                  const next = id === nextExpectedId;
                  return (
                    <span
                      key={id}
                      className={`teach-flow-chip ${done ? 'done' : ''} ${next ? 'next' : ''}`}
                      title={`${idx + 1}. ${iv?.label || id}`}
                    >
                      {idx + 1}
                    </span>
                  );
                })}
              </div>
              <p className="teach-next">
                Next correct stack: <strong>{nextExpectedId ? interventionById[nextExpectedId]?.label : 'All core stacks placed'}</strong>
              </p>
              <div className="teach-groups">
                <div className="teach-group">
                  <p className="teach-group-title">Acute now</p>
                  {teachGroups.acute.map((iv) => (
                    <p key={iv.id} className={`teach-group-row ${placed[iv.id] ? 'done' : ''}`}>
                      #{iv.seq} {iv.label}
                    </p>
                  ))}
                </div>
                <div className="teach-group">
                  <p className="teach-group-title">Long-term / prevention</p>
                  {teachGroups.longTerm.length ? (
                    teachGroups.longTerm.map((iv) => (
                      <p key={iv.id} className={`teach-group-row ${placed[iv.id] ? 'done' : ''}`}>
                        #{iv.seq} {iv.label}
                      </p>
                    ))
                  ) : (
                    <p className="teach-group-row muted">No long-term stacks in this case.</p>
                  )}
                </div>
              </div>
            </div>
          )}
          <div className="pill-list pill-list-panel" id="pill-list">
            {stackItems.map((iv, i) => (
              <div
                key={iv.id}
                className={`drag-pill-wrap pack-item ${placed[iv.id] ? 'is-placed is-expandable' : ''} ${expandedStackId === iv.id ? 'expanded' : ''}`}
                data-x="0"
                data-y="0"
                onClick={() => {
                  setExpandedStackId((prev) => (prev === iv.id ? null : iv.id));
                }}
              >
                <div
                  className="drag-pill pill"
                  data-iv-id={iv.id}
                  data-placed={placed[iv.id] ? 'true' : 'false'}
                  onMouseDown={() => setDragging(true)}
                  onMouseUp={() => setDragging(false)}
                  onTouchStart={() => setDragging(true)}
                  onTouchEnd={() => setDragging(false)}
                >
                  <span className="pill-text" title={iv.label}>
                    {iv.label}
                  </span>
                  <span className="pill-meta">
                    <span className="pill-stack">x1</span>
                    <span className="pill-num">{String(i + 1).padStart(2, '0')}</span>
                  </span>
                </div>
                {expandedStackId === iv.id && (
                  <div className="pill-why-inline">
                    <p className="pill-why-inline-status">
                      {!placed[iv.id]
                        ? 'Preview - rationale'
                        : !reviewed
                          ? 'Placed - review pending'
                          : reviewResults[iv.id]
                          ? orderReview[iv.id] === false
                            ? 'Correct but not emergent'
                            : 'Correct'
                          : 'Needs review'}
                    </p>
                    {placementOrder.includes(iv.id) && (
                      <p className="pill-why-inline-guideline">
                        Placed order #{placementOrder.indexOf(iv.id) + 1}
                      </p>
                    )}
                    {interventions.some((item) => item.id === iv.id) && (
                      <div className="pill-flow-inline" aria-label="Emergent sequence flow">
                        {expectedOrderIds.map((id, idx) => {
                          const current = id === iv.id;
                          const label = interventions.find((x) => x.id === id)?.label || `Step ${idx + 1}`;
                          const short = label.length > 18 ? `${label.slice(0, 18)}...` : label;
                          const placedIdx = placementOrder.indexOf(id);
                          const expectedIdx = idx;
                          const orderOk = placedIdx >= 0 && placedIdx === expectedIdx;
                          return (
                            <span
                              key={id}
                              className={`pill-flow-chip ${current ? 'current' : ''} ${orderOk ? 'ok' : ''}`}
                              title={`${idx + 1}. ${label}`}
                            >
                              {idx + 1}. {short}
                            </span>
                          );
                        })}
                      </div>
                    )}
                    <p className="pill-why-inline-text">{iv.why || 'No explanation available yet.'}</p>
                    {iv.guideline && <p className="pill-why-inline-guideline">Guideline: {iv.guideline}</p>}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
        <div className="sidebar-foot">
          <div className="progress-dots" aria-label="Case progress">
            {interventions.map((iv) => (
              <span
                key={iv.id}
                className={`progress-dot ${placed[iv.id] ? 'filled' : ''}`}
                title={placed[iv.id] ? iv.label : 'Not placed'}
              />
            ))}
          </div>
          <span className="mode-legend">
            {caseData.playRole === 'patient' ? 'Patient view' : 'Doctor view'} ·{' '}
            {caseData.sessionDifficulty || 'standard'} ·{' '}
            {dropMode === 'free' ? 'Practice' : 'Exam'} · {teachMeMode ? 'Teach Me: on' : 'Teach Me: off'}
          </span>
          <button type="button" className="btn-ghost" onClick={() => setTeachMeMode((v) => !v)}>
            {teachMeMode ? 'Teach Me: ON' : 'Teach Me'}
          </button>
          <button type="button" className="btn-ghost" onClick={reviewPlacements} disabled={doneCount === 0}>
            Review
          </button>
          <button type="button" className="btn-ghost" onClick={resetPlacements}>
            Reset
          </button>
          <button type="button" className="btn-ghost" onClick={playThanksPreview}>
            Play Video
          </button>
        </div>
        {reviewedAt && <div className="reviewed-stamp">Reviewed at {reviewedAt.toLocaleTimeString()}</div>}
      </aside>

      <WhyPanel
        open={Boolean(whyPanel)}
        intervention={whyPanel?.iv}
        ok={whyPanel?.ok}
        onClose={() => setWhyPanel(null)}
      />

      <div className={`toast ${toast.type} ${toast.msg ? 'show' : ''}`}>{toast.msg}</div>
      <div className="play-bottom-bar">
        <button
          type="button"
          className={isFullscreen ? 'bottom-chip active' : 'bottom-chip'}
          onClick={toggleFullscreen}
          title="Toggle fullscreen"
          aria-label="Toggle fullscreen"
        >
          {isFullscreen ? <FiMinimize2 className="chip-icon" /> : <FiMaximize2 className="chip-icon" />}
        </button>
        <button
          type="button"
          className={dockCollapsed ? 'bottom-chip' : 'bottom-chip active'}
          onClick={() => setDockCollapsed((v) => !v)}
          title="Show or hide intervention stack"
          aria-label="Toggle dock"
        >
          <FiBox className="chip-icon" />
        </button>
        <button
          type="button"
          className={activeDrawer === 'vitals' ? 'bottom-chip active' : 'bottom-chip'}
          onClick={() => setActiveDrawer((d) => (d === 'vitals' ? null : 'vitals'))}
          title="Vitals"
          aria-label="Show vitals"
        >
          <FiActivity className="chip-icon" />
        </button>
        <button
          type="button"
          className={activeDrawer === 'exam' ? 'bottom-chip active' : 'bottom-chip'}
          onClick={() => setActiveDrawer((d) => (d === 'exam' ? null : 'exam'))}
          title="Physical exam"
          aria-label="Show physical exam"
        >
          <FiClipboard className="chip-icon" />
        </button>
        <button
          type="button"
          className={activeDrawer === 'history' ? 'bottom-chip active' : 'bottom-chip'}
          onClick={() => setActiveDrawer((d) => (d === 'history' ? null : 'history'))}
          title="Extensive history and SOAP"
          aria-label="Show extensive history and SOAP note"
        >
          <FiFileText className="chip-icon" />
        </button>
        <button
          type="button"
          className={showCues ? 'bottom-chip active' : 'bottom-chip'}
          onClick={() => setShowCues((v) => !v)}
          title="Toggle zone cues"
          aria-label="Toggle zone cues"
        >
          {showCues ? <FiEye className="chip-icon" /> : <FiEyeOff className="chip-icon" />}
        </button>
        <button
          type="button"
          className={theme === 'dark' ? 'bottom-chip active' : 'bottom-chip'}
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Dark mode (click for light)' : 'Light mode (click for dark)'}
          aria-label="Toggle dark mode"
        >
          {theme === 'dark' ? <FiMoon className="chip-icon" /> : <FiSun className="chip-icon" />}
        </button>
        <button
          type="button"
          className={dropMode === 'strict' ? 'bottom-chip active' : 'bottom-chip'}
          onClick={() => setDropMode((m) => (m === 'free' ? 'strict' : 'free'))}
          title="Drop mode"
          aria-label="Toggle drop mode"
        >
          {dropMode === 'free' ? <FiUnlock className="chip-icon" /> : <FiLock className="chip-icon" />}
        </button>
        {studioCapture && (
          <>
            <button
              type="button"
              className={showGrid ? 'bottom-chip active' : 'bottom-chip'}
              onClick={() => setShowGrid((v) => !v)}
              title="Toggle placement grid"
              aria-label="Toggle grid"
            >
              #
            </button>
            <button
              type="button"
              className={placeMode ? 'bottom-chip active' : 'bottom-chip'}
              onClick={() => setPlaceMode((v) => !v)}
              title="Place mode — click grid cell. Click stack to select, click cell to move, double-click to remove"
              aria-label="Place mode"
            >
              ⊕
            </button>
            <button
              type="button"
              className="bottom-chip"
              onClick={capturePlayScreenshot}
              disabled={captureBusy}
              title={`Save screenshot (attempt ${nextCaptureAttempt})`}
              aria-label="Save screenshot"
            >
              <FiCamera className="chip-icon" />
            </button>
          </>
        )}
        <span className="bottom-status">
          Unit: {careUnit} · {dropMode}
          {studioCapture && selectedGridId ? ' · selected: move or dbl-click remove' : ''}
          {studioCapture ? ` · cap #${nextCaptureAttempt}` : ''}
        </span>
      </div>
    </div>
  );
}
