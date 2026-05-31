import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import PatientScene from './PatientScene.jsx';
import ClinicalAlgorithm from './ClinicalAlgorithm.jsx';
import WhyPanel from './WhyPanel.jsx';
import { getDragConfig } from '../data/gameData.js';
import { useDragGame } from '../hooks/useDragGame.js';
import { useGridDragGame } from '../hooks/useGridDragGame.js';
import { usePlayDockLayout } from '../hooks/usePlayDockLayout.js';
import { isCorrectGridPlacement, zoneIdForCell } from '../lib/placementGrid.js';
import SceneGridOverlay from './SceneGridOverlay.jsx';
import { playWrong, playComplete } from '../lib/audio.js';
import { mergeZonesForPlay } from '../lib/zoneStudio.js';
import { getCaseFlow } from '../data/caseFlows.js';
import {
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
  FiRotateCcw,
  FiMessageCircle,
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
import {
  getPresentationHistory,
  getPresentationIntro,
  getPresentationVitals,
} from '../lib/casePresentation.js';
import { readAudienceProfile } from '../lib/audienceProfile.js';
import {
  DEFAULT_TIMER_SECONDS,
  formatTimerLabel,
  getSessionTimerSeconds,
} from '../lib/caseTimer.js';
import { getBranding } from '../data/gameData.js';
import CaseChatPanel from './CaseChatPanel.jsx';
import CaseNotesPanel from './CaseNotesPanel.jsx';
import CaseReviewFlagButton from './CaseReviewFlagButton.jsx';
import CaseContextPanel from './CaseContextPanel.jsx';
import IcuMonitorStrip from './IcuMonitorStrip.jsx';
import ClinicalTextControls from './ClinicalTextControls.jsx';
import { readCaseAloud, stopCaseReader } from '../lib/caseReader.js';
import { clinicalTextStyle, readClinicalTextPrefs } from '../lib/clinicalTextPrefs.js';
import ClinicalFontControls from './ClinicalFontControls.jsx';
import { getBriefingExam, getBriefingHpi } from '../lib/caseBriefing.js';
import { pickTeachingVideo, preloadTeachingVideo } from '../lib/caseTeachingVideo.js';
import CaseTeachingVideoOverlay from './CaseTeachingVideoOverlay.jsx';
import TeachMeSceneOverlay from './TeachMeSceneOverlay.jsx';
import {
  endPlaySession,
  logPlayEvent,
  startPlaySession,
} from '../lib/caseUserLog.js';
import {
  clearPlayCheckpoint,
  hydrateCheckpointTimer,
  writePlayCheckpoint,
} from '../lib/playSessionResume.js';
import { computePatientLife, patientLifeState } from '../lib/patientLife.js';
import {
  clearReviewChecked,
  readReviewChecked,
  toggleReviewCheckedSeq,
} from '../lib/reviewChecked.js';
import { getCaseInterventions, isTimedMode, readUiPrefs, writeUiPrefs } from '../lib/uiPrefs.js';
import {
  buildSceneSourceSig,
  clearCaseSceneVariantsForSig,
  readCaseRegenImage,
} from '../lib/patientRegen.js';

export default function Play({
  caseData,
  playMode = 'browse',
  initialCheckpoint = null,
  onComplete,
  onQuit,
  studioCapture = false,
}) {
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
  const [teachFocusId, setTeachFocusId] = useState(null);
  const [teachMeMode, setTeachMeMode] = useState(false);
  const [placementOrder, setPlacementOrder] = useState([]);
  const [dragging, setDragging] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [activeDrawer, setActiveDrawer] = useState(null);
  const [showCaseChat, setShowCaseChat] = useState(false);
  const [playSessionId, setPlaySessionId] = useState(null);
  const playSessionIdRef = useRef(null);
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const { layout: dockLayout, startDrag: startDockDrag, resetLayout: resetDockLayout, isDragging: dockDragging } =
    usePlayDockLayout();
  const [theme, setTheme] = useState(() => readTheme());
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
  const [timedMode, setTimedMode] = useState(() => readUiPrefs().timedMode);
  const startRef = useRef(Date.now());
  const sceneRef = useRef(null);
  const patientImgRef = useRef(null);
  const dockRef = useRef(null);
  const [imageFrame, setImageFrame] = useState({ x: 0, y: 0, w: 1, h: 1 });

  const interventions = useMemo(() => getCaseInterventions(caseData), [caseData]);
  const requiredOrderTotal = interventions.length;
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
  const toggleTimedMode = useCallback(() => {
    setTimedMode((prev) => {
      const next = prev === 'timed' ? 'untimed' : 'timed';
      writeUiPrefs({ timedMode: next });
      if (next === 'untimed') {
        setTimedOut(false);
      }
      return next;
    });
  }, []);

  const focusTeachStep = useCallback(
    (id) => {
      if (!id) return;
      setDockCollapsed(false);
      setInfoTab('treatment');
      setTeachFocusId(id);
      setExpandedStackId(id);
      window.requestAnimationFrame(() => {
        const wrap = document.querySelector(`.drag-pill-wrap [data-iv-id="${id}"]`)?.closest('.drag-pill-wrap');
        wrap?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      });
    },
    [],
  );

  const canStartStackDrag = useCallback(
    (ivId) => {
      if (!teachMeMode) return true;
      return ivId === nextExpectedId;
    },
    [teachMeMode, nextExpectedId],
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
  const total = requiredOrderTotal;
  const doneCount = useMemo(
    () => interventions.filter((iv) => Boolean(placed[iv.id])).length,
    [interventions, placed],
  );
  const timerBase = layout.timerSeconds || DEFAULT_TIMER_SECONDS;
  const sessionDifficulty = caseData.sessionDifficulty || 'standard';
  const timerTotal = useMemo(
    () => getSessionTimerSeconds(readAudienceProfile(), sessionDifficulty, timerBase),
    [sessionDifficulty, timerBase, caseData.id],
  );
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
  const examSummary = useMemo(() => getBriefingExam(caseFlow), [caseFlow]);
  const presentationIntro = useMemo(() => getPresentationIntro(caseData), [caseData]);
  const presentationHistory = useMemo(() => getPresentationHistory(caseData), [caseData]);
  const sidebarHpi = useMemo(
    () => getBriefingHpi(caseData, caseFlow, presentationHistory),
    [caseData, caseFlow, presentationHistory],
  );
  const presentationVitals = useMemo(() => getPresentationVitals(caseData), [caseData]);
  const caseVitalsLine = useMemo(
    () =>
      `BP ${vitals.sbp}/${vitals.dbp} · HR ${vitals.hr} · RR ${vitals.rr} · Temp ${vitals.temp.toFixed(1)} · SpO2 ${vitals.spo2}%`,
    [vitals],
  );
  const soapParts = useMemo(() => {
    const subjective = presentationHistory || 'No subjective history documented.';
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
  }, [presentationHistory, caseData.clinical_tip, caseData.objective, vitals, examSummary]);

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
  const [reviewChecked, setReviewChecked] = useState([]);
  const [reviewContinuePulse, setReviewContinuePulse] = useState(false);
  const reviewAllDoneRef = useRef(false);
  const [reviewPanelCollapsed, setReviewPanelCollapsed] = useState(false);
  const [reviewPanelDragging, setReviewPanelDragging] = useState(false);
  const [reviewPanelPos, setReviewPanelPos] = useState(() => ({
    x: Math.max(16, (window.innerWidth - 520) / 2),
    y: Math.max(64, window.innerHeight - 320),
  }));
  const [infoTab, setInfoTab] = useState('hpi');
  const [readState, setReadState] = useState('idle');
  const [textPrefs, setTextPrefs] = useState(() => readClinicalTextPrefs());
  const clinicalStyle = useMemo(() => clinicalTextStyle(textPrefs), [textPrefs]);
  const reviewPanelRef = useRef(null);
  const reviewPanelDragRef = useRef({ dx: 0, dy: 0 });
  const captureRef = useRef(null);
  const caseNumber = String(caseData.ccsNumber || caseData.id || '0');
  const nextCaptureAttempt = useMemo(
    () => peekAttemptNumber(caseNumber),
    [caseNumber, reviewCount, doneCount],
  );

  const endCurrentPlaySession = useCallback(
    async (result = {}) => {
      const sid = playSessionIdRef.current;
      if (!sid || !caseData?.id) return;
      await endPlaySession(caseData.id, sid, result);
      playSessionIdRef.current = null;
      setPlaySessionId(null);
    },
    [caseData?.id],
  );

  const beginPlaySession = useCallback(async () => {
    const sid = await startPlaySession(caseData.id, {
      title: caseData.title,
      caseNumber: caseData.ccsNumber,
      diagnosis: caseData.diagnosis,
    });
    if (sid) {
      playSessionIdRef.current = sid;
      setPlaySessionId(sid);
    }
  }, [caseData]);

  const logTimeline = useCallback(
    (event) => {
      const sid = playSessionIdRef.current;
      if (!sid || !caseData?.id) return;
      void logPlayEvent(caseData.id, sid, event);
    },
    [caseData?.id],
  );

  const misses = Math.max(0, attempts - correctAttempts);
  const lifePct = useMemo(
    () =>
      computePatientLife({
        vitals,
        doneCount,
        total,
        misses,
        timeLeft,
        timerTotal,
      }),
    [vitals, doneCount, total, misses, timeLeft, timerTotal],
  );
  const lifeState = patientLifeState(lifePct);
  const prevLifeStateRef = useRef(null);
  const timedModeEnabled = isTimedMode({ timedMode });
  const timerState = timeLeft > 60 ? 'safe' : timeLeft > 25 ? 'warn' : 'critical';
  const timerLabel = formatTimerLabel(timeLeft);

  const resumeHydratedRef = useRef(false);
  const skipFreshCaseResetRef = useRef(
    Boolean(initialCheckpoint?.caseId && initialCheckpoint.caseId === caseData.id),
  );

  useEffect(() => {
    if (skipFreshCaseResetRef.current) return;
    setCareUnit(caseFlow.dispositionUnits?.[0] || 'ER');
  }, [caseFlow.id, caseFlow.dispositionUnits]);

  useEffect(() => {
    if (skipFreshCaseResetRef.current) return;
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
    if (!playSessionId) return undefined;
    const timer = setTimeout(() => {
      if (userAssessment.trim()) {
        logTimeline({ type: 'soap', field: 'assessment', text: userAssessment.trim() });
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, [userAssessment, playSessionId, logTimeline]);

  useEffect(() => {
    if (!playSessionId) return undefined;
    const timer = setTimeout(() => {
      if (userPlan.trim()) {
        logTimeline({ type: 'soap', field: 'plan', text: userPlan.trim() });
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, [userPlan, playSessionId, logTimeline]);

  useEffect(() => {
    if (skipFreshCaseResetRef.current) return;
    setTimeLeft(timerTotal);
    setTimedOut(false);
  }, [caseData.id, timerTotal]);

  useEffect(() => {
    if (
      resumeHydratedRef.current ||
      !initialCheckpoint ||
      initialCheckpoint.caseId !== caseData.id
    ) {
      return;
    }
    resumeHydratedRef.current = true;
    skipFreshCaseResetRef.current = false;

    const c = hydrateCheckpointTimer(initialCheckpoint, timerTotal);
    if (!c) return;

    setPlaced(c.placed || {});
    setPlacementOrder(c.placementOrder || []);
    setPins(Array.isArray(c.pins) ? c.pins : []);
    if (c.careUnit) setCareUnit(c.careUnit);
    if (typeof c.timeLeft === 'number') setTimeLeft(c.timeLeft);
    if (typeof c.timedOut === 'boolean') setTimedOut(c.timedOut);
    if (typeof c.userAssessment === 'string') setUserAssessment(c.userAssessment);
    if (typeof c.userPlan === 'string') setUserPlan(c.userPlan);
    if (typeof c.assessmentRevealed === 'boolean') setAssessmentRevealed(c.assessmentRevealed);
    if (typeof c.planRevealed === 'boolean') setPlanRevealed(c.planRevealed);
    if (typeof c.reviewed === 'boolean') setReviewed(c.reviewed);
    if (c.reviewResults) setReviewResults(c.reviewResults);
    if (c.orderReview) setOrderReview(c.orderReview);
    if (typeof c.reviewCount === 'number') setReviewCount(c.reviewCount);
    if (c.infoTab) {
      const mapped =
        c.infoTab === 'case' ? 'hpi' : c.infoTab === 'exam' ? 'exam' : c.infoTab;
      setInfoTab(mapped);
    }

    if (initialCheckpoint.playSessionId) {
      playSessionIdRef.current = initialCheckpoint.playSessionId;
      setPlaySessionId(initialCheckpoint.playSessionId);
    }
  }, [initialCheckpoint, caseData.id, timerTotal]);

  useEffect(() => {
    if (initialCheckpoint?.caseId === caseData.id && initialCheckpoint?.playSessionId) {
      playSessionIdRef.current = initialCheckpoint.playSessionId;
      setPlaySessionId(initialCheckpoint.playSessionId);
      return undefined;
    }
    if (resumeHydratedRef.current) return undefined;
    void beginPlaySession();
    return undefined;
  }, [caseData.id, beginPlaySession, initialCheckpoint?.caseId, initialCheckpoint?.playSessionId]);

  const buildCheckpoint = useCallback(
    () => ({
      caseId: caseData.id,
      caseTitle: caseData.title,
      caseNumber: caseData.ccsNumber,
      playMode,
      screen: 'play',
      playSessionId: playSessionIdRef.current,
      checkpoint: {
        placed,
        placementOrder,
        pins,
        careUnit,
        timeLeft,
        timedOut,
        timerPaused: timedOut || doneCount >= total,
        placedCount: doneCount,
        total,
        userAssessment,
        userPlan,
        assessmentRevealed,
        planRevealed,
        reviewed,
        reviewResults,
        orderReview,
        reviewCount,
        infoTab,
        lifePct,
        lifeState,
      },
    }),
    [
      caseData.id,
      caseData.title,
      caseData.ccsNumber,
      playMode,
      placed,
      placementOrder,
      pins,
      careUnit,
      timeLeft,
      timedOut,
      doneCount,
      total,
      userAssessment,
      userPlan,
      assessmentRevealed,
      planRevealed,
      reviewed,
      reviewResults,
      orderReview,
      reviewCount,
      infoTab,
      lifePct,
      lifeState,
    ],
  );

  useEffect(() => {
    if (!playSessionId) return;
    if (prevLifeStateRef.current === lifeState) return;
    prevLifeStateRef.current = lifeState;
    logTimeline({ type: 'patient_life', state: lifeState, pct: lifePct });
  }, [lifeState, lifePct, playSessionId, logTimeline]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      writePlayCheckpoint(buildCheckpoint());
    }, 900);
    return () => window.clearTimeout(timer);
  }, [buildCheckpoint]);

  const handleQuit = useCallback(() => {
    writePlayCheckpoint(buildCheckpoint());
    onQuit();
  }, [buildCheckpoint, onQuit]);

  useEffect(() => {
    if (!studioCapture) return;
    const key = `${STORAGE.playGridItems}_${caseData.id}`;
    setGridItems(readGridItems(key));
  }, [studioCapture, caseData.id]);

  useEffect(() => {
    const overrideSrc = localStorage.getItem(STORAGE.patientImage);
    const regenSrc = readCaseRegenImage(caseData.id);
    const erSrc = regenSrc || overrideSrc || getBuiltInPatientSrc(caseData);
    const payloadSigSource = erSrc;
    const sig = buildSceneSourceSig(caseData, payloadSigSource);
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

  const openFinalReview = useCallback(() => {
    const panelW = Math.min(520, window.innerWidth - 32);
    setPostVideoRows(computePostVideoRows());
    setReviewChecked(readReviewChecked(caseData.id));
    reviewAllDoneRef.current = false;
    setReviewContinuePulse(false);
    setDockCollapsed(true);
    setReviewPanelCollapsed(false);
    setReviewPanelPos({
      x: Math.max(16, (window.innerWidth - panelW) / 2),
      y: Math.max(56, window.innerHeight - 280),
    });
    setShowPostVideoReview(true);
  }, [computePostVideoRows, caseData.id]);

  const reviewProgress = useMemo(() => {
    const total = postVideoRows.length;
    const activeSeq = new Set(postVideoRows.map((row) => row.seq));
    const count = reviewChecked.filter((seq) => activeSeq.has(seq)).length;
    return {
      total,
      count,
      allReviewed: total > 0 && count >= total,
    };
  }, [postVideoRows, reviewChecked]);

  useEffect(() => {
    if (!showPostVideoReview) {
      reviewAllDoneRef.current = false;
      return undefined;
    }
    if (reviewProgress.allReviewed && !reviewAllDoneRef.current) {
      reviewAllDoneRef.current = true;
      setReviewContinuePulse(true);
      const timer = window.setTimeout(() => setReviewContinuePulse(false), 720);
      return () => window.clearTimeout(timer);
    }
    if (!reviewProgress.allReviewed) {
      reviewAllDoneRef.current = false;
    }
    return undefined;
  }, [showPostVideoReview, reviewProgress.allReviewed]);

  const toggleReviewCardChecked = useCallback(
    (seq) => {
      setReviewChecked((current) => toggleReviewCheckedSeq(caseData.id, seq, current));
    },
    [caseData.id],
  );

  const completeNow = useCallback(
    (result) => {
      setShowThanksVideo(false);
      setActiveThanksVideo(null);
      setThanksVideoIssue('');
      setShowPostVideoReview(false);
      setPostVideoRows([]);
      setReviewPanelCollapsed(false);
      setPendingCompleteResult(null);
      void endCurrentPlaySession({
        ...result,
        placed: doneCount,
        total,
        completed: true,
      });
      clearPlayCheckpoint();
      onComplete(result);
    },
    [onComplete, endCurrentPlaySession, doneCount, total],
  );

  const playTeachingVideo = useCallback(
    async (result) => {
      setPendingCompleteResult(result);
      const { src, error } = await pickTeachingVideo(caseData);
      if (!src) {
        setThanksVideoIssue(error);
        showToast(`${error} Opening review instead.`, 'bad');
        openFinalReview();
        return;
      }
      setThanksVideoIssue('');
      setActiveThanksVideo(src);
      await preloadTeachingVideo(src);
      setShowThanksVideo(true);
    },
    [caseData, openFinalReview],
  );

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
      const isGrid = typeof target === 'object' && target != null && 'col' in target;
      const ok = iv
        ? isGrid
          ? isCorrectGridPlacement(iv, target, zones)
          : iv.correct_zone === target
        : false;

      if (!iv) {
        flashScreen('bad');
        playWrong();
        showToast(
          teachMeMode
            ? 'Teach Me: not part of the emergent stack sequence.'
            : 'Killed the patient — harmful or irrelevant action.',
          'bad',
        );
        snapWrapHome(wrap);
        return;
      }

      if (teachMeMode) {
        if (iv.id !== nextExpectedId) {
          snapWrapHome(wrap);
          const nextIv = nextExpectedId ? interventionById[nextExpectedId] : null;
          const nextSeq = nextExpectedId ? expectedOrderIds.indexOf(nextExpectedId) + 1 : null;
          showToast(
            nextIv
              ? `Teach Me: do step ${nextSeq} first — ${nextIv.label}`
              : 'Teach Me: all core stacks are already placed.',
            'bad',
          );
          return;
        }
        if (!ok) {
          snapWrapHome(wrap);
          showToast('Teach Me: wrong body zone for this step', 'bad');
          return;
        }
      } else if (dropMode === 'strict' && !ok) {
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
      setTeachFocusId(null);
      showToast(`Placed ${iv.label}`, '');
      logTimeline({
        type: 'stack',
        stackId: iv.id,
        label: iv.label,
        correct: ok,
      });
    },
    [
      interventions,
      dropMode,
      dragCfg.snapBackMs,
      zones,
      teachMeMode,
      nextExpectedId,
      expectedOrderIds,
      interventionById,
      logTimeline,
    ],
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
    const secs = Math.round((Date.now() - startRef.current) / 1000);
    const result = { attempts: reviewNum, accuracy: acc, seconds: secs };

    if (meetsThreshold) {
      flashScreen('ok');
      playComplete();
      if (orderMismatches > 0) {
        showToast(
          `Accuracy ${acc}% — ${orderMismatches} stack(s) out of emergent order.`,
          'bad',
        );
      } else {
        showToast(`Case ready — ${acc}% (≥${completionThreshold}%)`, 'ok');
      }
    } else if (correct === total) {
      flashScreen('bad');
      playWrong();
      showToast(`Need ${completionThreshold}% to master (now ${acc}%) — teaching video next`, 'bad');
    } else {
      flashScreen('bad');
      playWrong();
      showToast(`Review: ${correct}/${total} correct — teaching video next`, 'bad');
    }

    setTimeout(() => playTeachingVideo(result), 900);
  }, [
    interventions,
    placed,
    reviewCount,
    total,
    useGridPlacement,
    zones,
    playTeachingVideo,
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
    canStartDrag: canStartStackDrag,
  });

  useGridDragGame({
    sceneRef,
    enabled: !timedOut && useGridPlacement,
    overlap: dragCfg.overlap,
    snapBackMs: dragCfg.snapBackMs,
    onDrop: handleDrop,
    onMovePin: handleMovePin,
    onReturnToDock: returnStackToDock,
    canStartDrag: canStartStackDrag,
  });

  const zoneLit = showCues && (dragging || showZonesAlways);

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
    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      if (!document.fullscreenElement) return;
      document.exitFullscreen?.().catch(() => {});
    };

    document.addEventListener('fullscreenchange', onFs);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('fullscreenchange', onFs);
      window.removeEventListener('keydown', onKeyDown);
    };
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

  const onDockDragStart = (event) => {
    if (event.button !== 0 || dockCollapsed) return;
    startDockDrag('move', event);
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
    clearReviewChecked(caseData.id);
    setReviewChecked([]);
    reviewAllDoneRef.current = false;
    setReviewContinuePulse(false);
    showToast('Placements reset', '');
  };

  const restartCurrentCase = useCallback(() => {
    const ok = window.confirm(
      'Restart this case from scratch? Timer, placements, and SOAP notes reset.',
    );
    if (!ok) return;

    setPlaced({});
    setPlacementOrder([]);
    setPins([]);
    setReviewed(false);
    setReviewResults({});
    setOrderReview({});
    setReviewedAt(null);
    setExpandedStackId(null);
    setWhyPanel(null);
    setAttempts(0);
    setCorrectAttempts(0);
    setReviewCount(0);
    setTimedOut(false);
    setTimeLeft(timerTotal);
    setCareUnit(caseFlow.dispositionUnits?.[0] || 'ER');
    setUserAssessment('');
    setUserPlan('');
    setAssessmentRevealed(false);
    setPlanRevealed(false);
    setShowThanksVideo(false);
    setActiveThanksVideo(null);
    setThanksVideoIssue('');
    setShowPostVideoReview(false);
    setPostVideoRows([]);
    clearReviewChecked(caseData.id);
    setReviewChecked([]);
    reviewAllDoneRef.current = false;
    setReviewContinuePulse(false);
    setPendingCompleteResult(null);
    setReviewPanelCollapsed(false);
    setActiveDrawer(null);
    setShowCaseChat(false);

    void (async () => {
      await endCurrentPlaySession({ restarted: true, placed: doneCount, total });
      clearPlayCheckpoint();
      await beginPlaySession();
    })();

    startRef.current = Date.now();

    try {
      localStorage.removeItem(soapDraftKey);
    } catch {
      /* ignore */
    }

    sceneRef.current?.querySelectorAll('.drag-pill-wrap').forEach(snapWrapHome);
    showToast('Case restarted from scratch', 'ok');
  }, [timerTotal, caseFlow.dispositionUnits, soapDraftKey, showToast, caseData?.id, endCurrentPlaySession, beginPlaySession, doneCount, total]);

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
        const regenSrc = readCaseRegenImage(caseData.id);
        const overrideSrc = localStorage.getItem(STORAGE.patientImage);
        const erSrc = sceneByUnit.ER || regenSrc || overrideSrc || getBuiltInPatientSrc(caseData);
        let payload;
        if (erSrc.startsWith('data:')) {
          payload = {
            base64: erSrc.split(',')[1] || '',
            mimeType: erSrc.slice(5, erSrc.indexOf(';')) || 'image/png',
            source: `regen:${caseData.id}`,
          };
        } else if (erSrc.startsWith('http')) {
          const resp = await fetch(erSrc);
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
            source: erSrc,
          };
        } else {
          payload = await getPatientImagePayload(caseData);
        }
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
    [sceneByUnit, sceneSourceSig, caseData],
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
    if (teachMeMode) return;
    setTeachFocusId(null);
  }, [teachMeMode]);

  useEffect(() => {
    if (!teachMeMode || !nextExpectedId) return;
    setTeachFocusId((prev) => (prev && !placed[prev] ? prev : nextExpectedId));
  }, [teachMeMode, nextExpectedId, placed]);

  useEffect(() => {
    if (!timedModeEnabled || teachMeMode || timedOut || doneCount >= total || timeLeft <= 0) return undefined;
    const tick = setInterval(() => {
      setTimeLeft((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(tick);
  }, [timedModeEnabled, teachMeMode, timedOut, doneCount, total, timeLeft]);

  useEffect(() => {
    if (!timedModeEnabled || timedOut || doneCount >= total || timeLeft > 0) return;
    setTimedOut(true);
    showToast(
      `Time is up — stay in ER until ${completionThreshold}% accuracy. Keep practicing.`,
      'bad',
    );
  }, [timeLeft, timedOut, doneCount, total, completionThreshold, timedModeEnabled]);

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
    stopCaseReader();
    setReadState('idle');
  }, [caseData.id]);

  useEffect(() => () => stopCaseReader(), []);

  useEffect(() => {
    if (finalMode) setDockCollapsed(true);
  }, [finalMode]);

  return (
    <div
      className={`game ${finalMode ? 'final-mode' : ''} ${activeDrawer ? 'drawer-open' : ''}`}
      style={{
        gridTemplateColumns: '1fr',
        ['--algo-h']: `${layout.algorithmPanelHeightPx || 220}px`,
        ['--pill-h']: `${layout.pillRowHeightPx || 52}px`,
      }}
    >
      <div
        className={`game-scene ${vitals.spo2 < 92 || vitals.sbp < 95 || vitals.hr > 120 ? 'icu-alarm' : ''} ${teachMeMode ? 'teach-me-active' : ''}`}
        ref={sceneRef}
      >
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
            <span
              className={`play-hud-timer ${timedModeEnabled ? timerState : 'untimed'}`}
              title={timedModeEnabled ? 'Case countdown' : 'Untimed mode'}
            >
              {timedModeEnabled ? timerLabel : 'Untimed'}
            </span>
            <button type="button" className="play-hud-exit" onClick={handleQuit} title="Exit case (saved for resume)">
              Exit
            </button>
          </div>
        </div>
        <div className="scene-dock-left">
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
                aria-label={`Patient life ${lifePct}%`}
              />
            </div>
            <p className="pack-life-pct" aria-hidden>{lifePct}%</p>
          </div>
          <IcuMonitorStrip
            vitals={vitals}
            className="icu-monitor-docked"
            ordersDone={doneCount}
            ordersTotal={total}
            careUnit={careUnit}
            flowTrack={caseFlow.flowTrack}
          />
        </div>
        <div className="patient-drop-surface" aria-label="Drop stacks on patient">
          <PatientScene
            scene={caseData.patientScene}
            imgRef={patientImgRef}
            onLoad={syncImageFrame}
            forceSrc={sceneByUnit[careUnit] || sceneByUnit.ER || null}
          />
        </div>
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
          const isTeachZone =
            teachMeMode &&
            nextExpectedId &&
            interventionById[nextExpectedId]?.correct_zone === zoneId &&
            !placed[nextExpectedId];
          const show = (zoneLit && !isDone) || isTeachZone;
          const color = zoneColors[zoneId] || '#e8b84b';
          const zoneLeftPct = frameLeft + z.cx * frameW;
          const zoneTopPct = frameTop + z.cy * frameH;
          const zoneWPercent = z.w * frameW * hitboxScale;
          const zoneHPercent = z.h * frameH * hitboxScale;
          return (
            <div
              key={zoneId}
              className={`drop-zone ${show ? 'zone-lit' : ''} ${isTeachZone ? 'zone-teach' : ''} ${showCues && showZonesAlways && !isDone ? 'zone-idle' : ''} ${!showCues && !isDone ? 'zone-active-drop' : ''} ${isDone ? 'zone-done' : ''}`}
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
        {teachMeMode && !useGridPlacement && !finalMode && (
          <TeachMeSceneOverlay
            interventions={interventions}
            zones={zones}
            placed={placed}
            nextExpectedId={nextExpectedId}
            focusedStepId={teachFocusId}
            frame={{ left: frameLeft, top: frameTop, w: frameW, h: frameH }}
            onSelectStep={focusTeachStep}
          />
        )}
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
        <CaseTeachingVideoOverlay
          open={showThanksVideo}
          src={activeThanksVideo}
          frozen={showPostVideoReview}
          objectPosition={caseData.patientScene?.objectPosition || 'center center'}
          onEnded={openFinalReview}
          onSkip={openFinalReview}
          onError={(msg) => {
            setThanksVideoIssue(msg);
            showToast(`${msg} Opening review instead.`, 'bad');
            setShowThanksVideo(false);
            openFinalReview();
          }}
        />
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
          <div className="soap-wrap clinical-text-block" style={clinicalStyle}>
            <ClinicalTextControls
              caseData={caseData}
              rawText={caseData.historyText || caseData.chief_complaint || presentationHistory}
              compact
              onUpdated={({ prefs }) => {
                if (prefs) setTextPrefs(prefs);
              }}
            />
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
              {postVideoRows.length > 0 && (
                <span
                  className={`post-review-progress ${reviewProgress.allReviewed ? 'is-complete' : ''}`}
                >
                  {reviewProgress.allReviewed
                    ? 'All reviewed ✓'
                    : `Reviewed ${reviewProgress.count} / ${reviewProgress.total}`}
                </span>
              )}
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
                {postVideoRows.map((row) => {
                  const isStudentReviewed = reviewChecked.includes(row.seq);
                  return (
                  <article
                    key={row.id}
                    className={`post-review-row ${row.ok ? 'ok' : 'bad'} ${isStudentReviewed ? 'is-student-reviewed' : ''}`}
                  >
                    <button
                      type="button"
                      className={`post-review-check ${isStudentReviewed ? 'is-checked' : ''}`}
                      onClick={() => toggleReviewCardChecked(row.seq)}
                      aria-label={isStudentReviewed ? `Mark order ${row.seq} unchecked` : `Mark order ${row.seq} reviewed`}
                      aria-pressed={isStudentReviewed}
                    >
                      {isStudentReviewed ? <span aria-hidden="true">✓</span> : null}
                    </button>
                    <div className="post-review-row-content">
                    <div className="post-review-head">
                      <span className="post-review-step">#{row.seq}</span>
                      <span
                        className={`post-review-status ${
                          isStudentReviewed
                            ? 'student-reviewed'
                            : row.ok
                              ? row.orderOk === false
                                ? 'late'
                                : 'ok'
                              : 'bad'
                        }`}
                      >
                        {isStudentReviewed
                          ? 'Reviewed'
                          : row.ok
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
                          <span className="post-review-meta-item">
                            Emergent #{row.expectedOrder}
                            {row.placedOrder ? ` · placed #${row.placedOrder}` : ' · not placed'}
                          </span>
                        )}
                        {row.guideline && (
                          <span className="post-review-meta-item">{row.guideline}</span>
                        )}
                      </p>
                    )}
                    </div>
                  </article>
                  );
                })}
              </div>
              <div className="post-review-actions">
                <button
                  type="button"
                  className={`btn-primary ${reviewContinuePulse ? 'post-review-continue-pulse' : ''}`}
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
          left: `${dockLayout.x}px`,
          top: `${dockLayout.y}px`,
          width: `${dockLayout.width}px`,
          height: `${dockLayout.height}px`,
          '--clinical-panel-h': `${dockLayout.clinicalPx}px`,
        }}
      >
        <div className="dock-handle" onPointerDown={onDockDragStart} title="Drag to move panel">
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
        </div>
        <div className="dock-panel-clinical">
          <CaseContextPanel
            key={`play-${caseData.id}`}
            caseData={caseData}
            brandName={brand.name}
            hpiText={sidebarHpi}
            examSummary={examSummary}
            textStyle={clinicalStyle}
            showStats
            readyCount={total - doneCount}
            doneCount={doneCount}
            totalCount={total}
            defaultTab="hpi"
            showTreatmentTab
            showNotesTab
            activeTab={infoTab}
            onTabChange={setInfoTab}
            onReadCase={(section, text) => {
              readCaseAloud({
                caseId: caseData.id,
                section,
                text,
                onState: (state) => setReadState(state),
              });
            }}
            readState={readState}
            notesPanel={
              <CaseNotesPanel
                caseId={caseData.id}
                sessionId={playSessionId}
                compact
                minimal
                onTimelineNote={(text) => logTimeline({ type: 'note', text })}
                onRecordingSaved={() => showToast('Intuition recording saved', 'ok')}
              />
            }
            footer={
              <p className="play-sidebar-foot">
                <span>
                  {doneCount}/{total} orders to save patient
                </span>
                <span className={`play-sidebar-timer ${timedModeEnabled ? timerState : 'untimed'}`}>
                  {timedModeEnabled ? timerLabel : 'Untimed'}
                </span>
              </p>
            }
            treatmentPanel={
              <>
                <p className="sidebar-section-label">Stacks — drag to patient</p>
                {teachMeMode && (
                  <div className="teach-panel">
                    <p className="teach-title">Teach Me Flow</p>
                    <div className="teach-flow" aria-label="Clinical flow diagram">
                      {expectedOrderIds.map((id, idx) => {
                        const iv = interventionById[id];
                        const done = Boolean(placed[id]);
                        const next = id === nextExpectedId;
                        const focused = id === teachFocusId;
                        return (
                          <button
                            key={id}
                            type="button"
                            className={`teach-flow-chip ${done ? 'done' : ''} ${next ? 'next' : ''} ${focused ? 'focused' : ''}`}
                            title={`${idx + 1}. ${iv?.label || id}`}
                            onClick={() => focusTeachStep(id)}
                            aria-label={`Step ${idx + 1}, ${iv?.label || id}`}
                          >
                            {idx + 1}
                          </button>
                        );
                      })}
                    </div>
                    <p className="teach-next">
                      Next correct stack:{' '}
                      <strong>
                        {nextExpectedId
                          ? interventionById[nextExpectedId]?.label
                          : 'All core stacks placed'}
                      </strong>
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
                <div className="pill-list pill-list-panel pill-list-vertical" id="pill-list">
                  {stackItems.map((iv) => {
                    const seqNum = interventions.findIndex((x) => x.id === iv.id);
                    const displayNum = seqNum >= 0 ? seqNum + 1 : null;
                    const isDecoy = !interventions.some((x) => x.id === iv.id);
                    const isTeachNext = teachMeMode && iv.id === nextExpectedId;
                    const isTeachFocused = teachMeMode && teachFocusId === iv.id;
                    const isTeachLocked =
                      teachMeMode && !isDecoy && !placed[iv.id] && iv.id !== nextExpectedId;
                    return (
                      <div
                        key={iv.id}
                        className={`drag-pill-wrap pack-item ${isDecoy ? 'pack-item-decoy' : ''} ${placed[iv.id] ? 'is-placed is-expandable' : ''} ${expandedStackId === iv.id ? 'expanded' : ''} ${isTeachFocused ? 'teach-pill-focused' : ''} ${isTeachNext ? 'teach-pill-next' : ''} ${isTeachLocked ? 'teach-pill-locked' : ''}`}
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
                            {displayNum != null ? (
                              <span className="pill-num">{String(displayNum).padStart(2, '0')}</span>
                            ) : (
                              <span className="pill-num pill-num-decoy">—</span>
                            )}
                          </span>
                        </div>
                        {expandedStackId === iv.id && (
                          <div className="pill-why-inline">
                            <p className="pill-why-inline-status">
                              {!placed[iv.id]
                                ? 'Preview — rationale for this order only'
                                : !reviewed
                                  ? 'Placed — review pending'
                                  : reviewResults[iv.id]
                                    ? orderReview[iv.id] === false
                                      ? 'Correct but not emergent'
                                      : 'Correct'
                                    : 'Needs review'}
                            </p>
                            {placementOrder.includes(iv.id) && (
                              <p className="pill-why-inline-guideline">
                                Your placement order #{placementOrder.indexOf(iv.id) + 1}
                              </p>
                            )}
                            <p className="pill-why-inline-text">{iv.why || 'No explanation available yet.'}</p>
                            {iv.guideline && (
                              <p className="pill-why-inline-guideline">Guideline: {iv.guideline}</p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            }
          />
        </div>
        <div className="sidebar-foot">
          <div
            className={`progress-dots ${total > 12 ? 'progress-dots-many' : total > 8 ? 'progress-dots-compact' : ''}`}
            aria-label={`Case progress ${doneCount} of ${total} orders`}
          >
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
            {dropMode === 'free' ? 'Practice' : 'Exam'} ·{' '}
            {timedModeEnabled ? 'Timed' : 'Untimed'} ·{' '}
            {teachMeMode ? 'Teach Me: on' : 'Teach Me: off'}
          </span>
          <ClinicalFontControls
            prefs={textPrefs}
            onChange={setTextPrefs}
            compact
          />
          <div className="sidebar-foot-buttons">
            <button type="button" className="btn-ghost" onClick={toggleTimedMode}>
              {timedModeEnabled ? 'Timed: ON' : 'Untimed'}
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                setTeachMeMode((v) => !v);
                if (teachMeMode) setTeachFocusId(null);
              }}
            >
              {teachMeMode ? 'Teach Me: ON' : 'Teach Me'}
            </button>
            <button type="button" className="btn-ghost" onClick={reviewPlacements} disabled={doneCount === 0}>
              Review
            </button>
            <button type="button" className="btn-ghost" onClick={resetPlacements}>
              Reset
            </button>
          </div>
        </div>
        {reviewedAt && <div className="reviewed-stamp">Reviewed at {reviewedAt.toLocaleTimeString()}</div>}
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

      <WhyPanel
        open={Boolean(whyPanel)}
        intervention={whyPanel?.iv}
        ok={whyPanel?.ok}
        onClose={() => setWhyPanel(null)}
      />

      <CaseChatPanel
        caseData={caseData}
        open={showCaseChat}
        onClose={() => setShowCaseChat(false)}
        playSessionId={playSessionId}
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
        <span className="bottom-bar-sep" aria-hidden />
        <button
          type="button"
          className={`bottom-chip bottom-chip-text ${showCaseChat ? 'active' : ''}`}
          onClick={() => setShowCaseChat((v) => !v)}
          title="Chat with this case (OpenAI)"
          aria-label="Chat with case"
        >
          <FiMessageCircle className="chip-icon" aria-hidden />
          Chat
        </button>
        <CaseReviewFlagButton
          caseId={caseData.id}
          compact
          className="bottom-chip bottom-chip-text case-review-flag-chip"
          onChange={(flagged) => {
            logTimeline({ type: 'review_flag', flagged });
            showToast(flagged ? 'Flagged for review next time' : 'Removed from review list', 'ok');
          }}
        />
        <button
          type="button"
          className="bottom-chip bottom-chip-text"
          onClick={restartCurrentCase}
          title="Restart this case from scratch"
          aria-label="Restart case"
        >
          <FiRotateCcw className="chip-icon" aria-hidden />
          Restart
        </button>
        <span className="bottom-bar-sep" aria-hidden />
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
              title="Place mode"
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
