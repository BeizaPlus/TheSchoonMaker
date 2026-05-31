import { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import {
  FiCrosshair,
  FiLogOut,
  FiSettings,
  FiUser,
  FiZap,
} from 'react-icons/fi';
import { getCatalog, getCaseById } from '../data/useCcsCatalog.js';
import { getBranding } from '../data/gameData.js';
import {
  getCompletionStats,
  getLastPlayedCaseId,
  pickRandomId,
  readProgress,
} from '../data/caseProgress.js';
import { clearVisionZones } from '../lib/patientImage.js';
import { readTheme, writeTheme } from '../lib/theme.js';
import { STORAGE } from '../lib/storageKeys.js';
import {
  getAllowedCaseIds,
  getConditionChoices,
  levelFromSlider,
  readAudienceProfile,
  sliderFromLevel,
  writeAudienceProfile,
} from '../lib/audienceProfile.js';
import { DEFAULT_TIMER_SECONDS, normalizeTimerSeconds } from '../lib/caseTimer.js';
import { getReadyPracticeCount, getStackTestingCount } from '../lib/caseReadyPractice.js';
import { getFlaggedReviewCount } from '../data/caseProgress.js';
import { fetchOverallUserStats } from '../lib/caseUserLog.js';
import {
  applyPhysicianProfile,
  hasCompletedOnboarding,
  markOnboardingComplete,
} from '../lib/onboarding.js';
import GridPlacementLayer from './GridPlacementLayer.jsx';
import AudioSettingsPanel from './AudioSettingsPanel.jsx';
import GlobalUiSettingsPanel from './GlobalUiSettingsPanel.jsx';
import ResumeSessionBanner from './ResumeSessionBanner.jsx';
import {
  createGridItem,
  moveGridItem,
  readGridItems,
  writeGridItems,
} from '../lib/gridPlacement.js';

const NAV = [
  { id: 'play', label: 'Play', Icon: FiZap, action: 'play' },
  { id: 'continue', label: 'Continue', Icon: FiCrosshair, action: 'continue' },
  { id: 'profiles', label: 'Profiles', Icon: FiUser, action: 'panel' },
  { id: 'settings', label: 'Settings', Icon: FiSettings, action: 'panel' },
  { id: 'exit', label: 'Exit', Icon: FiLogOut, action: 'exit' },
];

export default function WelcomeScreen({
  onPlay,
  onOpenCases,
  onOpenReadyCases,
  onOpenStackTestingCases,
  onOpenFlaggedCases,
  resumeCheckpoint,
  resumeCase,
  onResumeSession,
  onDiscardSession,
  studioBuild = false,
}) {
  const brand = getBranding();
  const plateSrc = brand.welcomePlate || '/welcome-plate.png';
  const catalog = getCatalog();
  const stats = useMemo(() => getCompletionStats(catalog.totalCases), [catalog.totalCases]);
  const readyCount = getReadyPracticeCount();
  const stackTestingCount = useMemo(() => getStackTestingCount(catalog.cases), [catalog.cases]);
  const [activeNav, setActiveNav] = useState('play');
  const [panel, setPanel] = useState(null);
  const flaggedCount = useMemo(() => getFlaggedReviewCount(), [panel]);
  const lastCaseId = useMemo(() => getLastPlayedCaseId(), []);
  const lastCase = lastCaseId ? getCaseById(lastCaseId) : null;
  const [theme, setTheme] = useState(() => readTheme());
  const [showGrid, setShowGrid] = useState(studioBuild);
  const [placeMode, setPlaceMode] = useState(studioBuild);
  const [gridItems, setGridItems] = useState(() => readGridItems(STORAGE.welcomeGridItems));
  const [selectedGridId, setSelectedGridId] = useState(null);
  const [placingNavId, setPlacingNavId] = useState(null);
  const [audienceReady, setAudienceReady] = useState(() => hasCompletedOnboarding());
  const [showFullSetup, setShowFullSetup] = useState(false);
  const [condition, setCondition] = useState('diabetes');
  const [understanding, setUnderstanding] = useState(1);
  const [playRole, setPlayRole] = useState('doctor');
  const [difficulty, setDifficulty] = useState('standard');
  const [timerMinutes, setTimerMinutes] = useState(2.5);
  const fileRef = useRef(null);
  const magicFileRef = useRef(null);
  const [patientSet, setPatientSet] = useState(() => {
    try {
      return Boolean(localStorage.getItem(STORAGE.patientImage));
    } catch {
      return false;
    }
  });
  const [magicEmail, setMagicEmail] = useState('');
  const [magicBusy, setMagicBusy] = useState(false);
  const [magicLink, setMagicLink] = useState('');
  const [magicMsg, setMagicMsg] = useState('');
  const [journalStats, setJournalStats] = useState(null);

  const allCaseIds = useMemo(() => catalog.cases.map((c) => c.id), [catalog]);
  const audienceLevel = useMemo(() => levelFromSlider(understanding), [understanding]);
  const conditionChoices = useMemo(() => getConditionChoices(audienceLevel), [audienceLevel]);
  useEffect(() => {
    if (!conditionChoices.some((c) => c.id === condition)) {
      setCondition(conditionChoices[0]?.id || 'diabetes');
    }
  }, [conditionChoices, condition]);
  const allowedCaseIds = useMemo(
    () => getAllowedCaseIds(catalog.cases, { level: audienceLevel, condition }),
    [catalog.cases, audienceLevel, condition],
  );

  const persistGrid = useCallback((next) => {
    setGridItems(next);
    writeGridItems(STORAGE.welcomeGridItems, next);
  }, []);

  useEffect(() => {
    if (!studioBuild) return;
    writeGridItems(STORAGE.welcomeGridItems, gridItems);
  }, [studioBuild, gridItems]);

  useEffect(() => {
    const saved = readAudienceProfile();
    if (!saved) return;
    setCondition(saved.condition);
    setUnderstanding(sliderFromLevel(saved.level));
    if (saved.playRole) setPlayRole(saved.playRole);
    if (saved.difficulty) setDifficulty(saved.difficulty);
    if (saved.timerSeconds) setTimerMinutes(Math.round((saved.timerSeconds / 60) * 10) / 10);
  }, []);

  useEffect(() => {
    if (panel !== 'profiles') return undefined;
    let cancelled = false;
    fetchOverallUserStats().then((stats) => {
      if (!cancelled) setJournalStats(stats);
    });
    return () => {
      cancelled = true;
    };
  }, [panel]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('magic');
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`http://127.0.0.1:3001/api/magic/${encodeURIComponent(token)}`);
        if (!r.ok) throw new Error('Magic link invalid or expired');
        const data = await r.json();
        const url = `data:${data.mimeType || 'image/png'};base64,${data.personalizedImageBase64}`;
        localStorage.setItem(STORAGE.patientImage, url);
        localStorage.setItem(STORAGE.patientMime, data.mimeType || 'image/png');
        clearVisionZones();
        if (!cancelled) {
          setPatientSet(true);
          setMagicMsg('Personalized photo loaded from your magic link.');
        }
        const next = new URL(window.location.href);
        next.searchParams.delete('magic');
        window.history.replaceState({}, '', `${next.pathname}${next.search}${next.hash}`);
      } catch (e) {
        if (!cancelled) setMagicMsg(e.message || 'Could not apply magic link.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handlePlay = () => {
    const pool = allowedCaseIds.length ? allowedCaseIds : allCaseIds;
    const id = pickRandomId(pool);
    const gameCase = id ? getCaseById(id) : null;
    if (gameCase) onPlay(gameCase, 'random');
  };

  const handleContinue = () => {
    if (resumeCheckpoint?.caseId && onResumeSession) {
      onResumeSession();
      return;
    }
    if (lastCase) {
      onPlay(lastCase, readProgress().lastMode || 'browse');
      return;
    }
    handlePlay();
  };

  const dismissEntryModal = useCallback(() => {
    writeAudienceProfile({
      level: audienceLevel,
      condition,
      playRole,
      difficulty,
      timerSeconds: normalizeTimerSeconds(Math.round(timerMinutes * 60), DEFAULT_TIMER_SECONDS),
    });
    markOnboardingComplete();
    setAudienceReady(true);
  }, [audienceLevel, condition, playRole, difficulty, timerMinutes]);

  const continueAsPhysician = useCallback(() => {
    const profile = applyPhysicianProfile(timerMinutes);
    setUnderstanding(sliderFromLevel(profile.level));
    setPlayRole(profile.playRole);
    setDifficulty(profile.difficulty);
    setAudienceReady(true);
    setShowFullSetup(false);
  }, [timerMinutes]);

  const ensureReadyForCases = useCallback(() => {
    if (audienceReady) return;
    continueAsPhysician();
  }, [audienceReady, continueAsPhysician]);

  const runNavAction = (id) => {
    if (id === 'play') handlePlay();
    else if (id === 'continue') handleContinue();
    else if (id === 'profiles' || id === 'settings') setPanel(id);
    else if (id === 'exit') window.close();
  };

  const onNav = (id) => {
    if (!audienceReady && id !== 'profiles' && id !== 'settings') return;
    setActiveNav(id);
    runNavAction(id);
  };

  const placeGridItem = (cell) => {
    const nav = NAV.find((n) => n.id === placingNavId);
    const label = nav?.label || `Item ${gridItems.length + 1}`;
    const item = createGridItem({
      ...cell,
      label,
      meta: { navId: placingNavId || null, action: nav?.action },
    });
    persistGrid([...gridItems, item]);
    setPlacingNavId(null);
  };

  const onGridMarkerClick = (item) => {
    if (studioBuild && placeMode) {
      setSelectedGridId(item.id === selectedGridId ? null : item.id);
      return;
    }
    if (item.meta?.navId) {
      runNavAction(item.meta.navId);
    } else if (item.meta?.action === 'play') {
      handlePlay();
    }
  };

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    writeTheme(next);
  };

  const loadPatientImage = async (file) => {
    if (!file) return;
    const reader = new FileReader();
    const dataUrl = await new Promise((resolve, reject) => {
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    try {
      localStorage.setItem(STORAGE.patientImage, dataUrl);
      localStorage.setItem(STORAGE.patientMime, file.type || 'image/png');
      clearVisionZones();
      setPatientSet(true);
    } catch {
      /* ignore */
    }
  };

  const clearPatientImage = () => {
    try {
      localStorage.removeItem(STORAGE.patientImage);
      localStorage.removeItem(STORAGE.patientMime);
      clearVisionZones();
      setPatientSet(false);
    } catch {
      /* ignore */
    }
  };

  const createMagicLink = async () => {
    const file = magicFileRef.current?.files?.[0];
    if (!file) {
      setMagicMsg('Upload a face photo first.');
      return;
    }
    setMagicBusy(true);
    setMagicMsg('');
    setMagicLink('');
    try {
      const reader = new FileReader();
      const dataUrl = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const imageBase64 = dataUrl.split(',')[1] || '';
      const mimeType = file.type || 'image/png';
      const r = await fetch('http://127.0.0.1:3001/api/magic/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64,
          mimeType,
          email: magicEmail.trim(),
          origin: window.location.origin,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Failed to create magic link');
      setMagicLink(data.magicLink || '');
      setMagicMsg(data.note || 'Magic link ready.');
      if (data.magicLink) {
        try {
          await navigator.clipboard.writeText(data.magicLink);
          setMagicMsg('Magic link ready and copied to clipboard.');
        } catch {
          /* ignore clipboard failures */
        }
      }
    } catch (e) {
      setMagicMsg(e.message || 'Failed to create magic link.');
    } finally {
      setMagicBusy(false);
    }
  };

  return (
    <main className="welcome-screen" aria-label="Welcome">
      <img className="welcome-plate-img" src={plateSrc} alt="" draggable={false} />
      <div className="welcome-plate-scrim" aria-hidden />

      {studioBuild && (
        <div className="welcome-studio-bar">
          <button type="button" className={showGrid ? 'btn-primary' : 'btn-ghost'} onClick={() => setShowGrid((v) => !v)}>
            {showGrid ? 'Grid on' : 'Grid off'}
          </button>
          <button type="button" className={placeMode ? 'btn-primary' : 'btn-ghost'} onClick={() => setPlaceMode((v) => !v)}>
            {placeMode ? 'Place on' : 'Place off'}
          </button>
          {NAV.map((n) => (
            <button
              key={n.id}
              type="button"
              className={placingNavId === n.id ? 'btn-primary' : 'btn-ghost'}
              onClick={() => setPlacingNavId(placingNavId === n.id ? null : n.id)}
              title={`Place ${n.label} on grid`}
            >
              + {n.label}
            </button>
          ))}
        </div>
      )}

      <GridPlacementLayer
        frame={{ x: 0, y: 0, w: 1, h: 1 }}
        items={gridItems}
        visible={showGrid}
        placeMode={studioBuild && (placeMode || Boolean(placingNavId))}
        selectedId={selectedGridId}
        onPlaceCell={placeGridItem}
        onSelect={studioBuild ? setSelectedGridId : undefined}
        onItemClick={!studioBuild ? onGridMarkerClick : undefined}
        onMove={(id, cell) => {
          persistGrid(moveGridItem(gridItems, id, cell));
          setSelectedGridId(null);
        }}
        onRemove={(id) => {
          persistGrid(gridItems.filter((it) => it.id !== id));
        }}
      />

      {!audienceReady && (
        <>
          <div className="welcome-entry-backdrop" aria-hidden />
          <section className="welcome-entry-modal welcome-entry-card welcome-onboarding-slim" aria-label="One-time setup">
            <p className="welcome-entry-kicker">One-time setup</p>
            <h2>Physician mode</h2>
            <p className="welcome-entry-note">
              Full case library, clinical prompts, drag-and-drop CCS stacks. This screen appears once — then
              straight to cases.
            </p>
            <button type="button" className="btn-primary welcome-physician-cta" onClick={continueAsPhysician}>
              Continue as physician →
            </button>
            <button
              type="button"
              className="btn-ghost welcome-customize-toggle"
              onClick={() => setShowFullSetup((v) => !v)}
              aria-expanded={showFullSetup}
            >
              {showFullSetup ? 'Hide custom setup' : 'Customize audience & timer…'}
            </button>
            {showFullSetup && (
              <div className="welcome-onboarding-custom">
                <p className="welcome-entry-note muted">
                  Reddit-informed common conditions for launch: layperson mode limits case complexity.
                </p>
                <div className="welcome-condition-grid">
                  {conditionChoices.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      className={condition === opt.id ? 'welcome-cond-pill active' : 'welcome-cond-pill'}
                      onClick={() => setCondition(opt.id)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <label className="welcome-understanding">
                  <span>Explain it like I&apos;m…</span>
                  <strong>
                    {audienceLevel === 'kid'
                      ? 'a 5-year-old'
                      : audienceLevel === 'layperson'
                        ? 'a curious adult'
                        : audienceLevel === 'mid'
                          ? 'a pre-med student'
                          : 'a physician'}
                  </strong>
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={understanding}
                  onChange={(e) => setUnderstanding(Number(e.target.value))}
                />
                <div className="welcome-understanding-meta">
                  <span>5 years old</span>
                  <span>physician</span>
                </div>
                <p className="welcome-entry-note">
                  Available right now: {allowedCaseIds.length} cases in {audienceLevel} mode
                </p>
                <div className="welcome-session-row">
                  <span className="welcome-entry-kicker">Play as</span>
                  <div className="welcome-session-toggle">
                    <button
                      type="button"
                      className={playRole === 'doctor' ? 'active' : ''}
                      onClick={() => setPlayRole('doctor')}
                    >
                      Doctor
                    </button>
                    <button
                      type="button"
                      className={playRole === 'patient' ? 'active' : ''}
                      onClick={() => setPlayRole('patient')}
                    >
                      Patient
                    </button>
                  </div>
                </div>
                <div className="welcome-session-row">
                  <span className="welcome-entry-kicker">Session difficulty</span>
                  <div className="welcome-session-toggle">
                    <button
                      type="button"
                      className={difficulty === 'easy' ? 'active' : ''}
                      onClick={() => setDifficulty('easy')}
                    >
                      Easier
                    </button>
                    <button
                      type="button"
                      className={difficulty === 'standard' ? 'active' : ''}
                      onClick={() => setDifficulty('standard')}
                    >
                      Standard
                    </button>
                    <button
                      type="button"
                      className={difficulty === 'hard' ? 'active' : ''}
                      onClick={() => setDifficulty('hard')}
                    >
                      Harder
                    </button>
                  </div>
                </div>
                <label className="welcome-timer-field">
                  <span className="welcome-entry-kicker">Case timer (minutes)</span>
                  <input
                    type="number"
                    min={1}
                    max={60}
                    step={0.5}
                    value={timerMinutes}
                    onChange={(e) => setTimerMinutes(Number(e.target.value))}
                  />
                </label>
                <button type="button" className="btn-primary" onClick={dismissEntryModal}>
                  Save &amp; continue
                </button>
              </div>
            )}
          </section>
        </>
      )}

      <div className="welcome-hud">
        <header className="welcome-brand">
          <h1 className="welcome-title">{brand.name}</h1>
          <div className="welcome-tagline" aria-label={brand.tagline}>
            <span className="welcome-tagline-line" aria-hidden />
            <span className="welcome-tagline-gem" aria-hidden>◆</span>
            <span className="welcome-tagline-text">{brand.tagline}</span>
            <span className="welcome-tagline-gem" aria-hidden>◆</span>
            <span className="welcome-tagline-line" aria-hidden />
          </div>
        </header>

        {resumeCheckpoint?.caseId && onResumeSession && onDiscardSession && (
          <ResumeSessionBanner
            checkpoint={resumeCheckpoint}
            caseMeta={resumeCase}
            onResume={onResumeSession}
            onDiscard={onDiscardSession}
          />
        )}

        <nav className="welcome-nav" aria-label="Main menu">
          {NAV.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              className={`welcome-nav-item ${activeNav === id ? 'active' : ''}`}
              onClick={() => onNav(id)}
              onMouseEnter={() => setActiveNav(id)}
              onFocus={() => setActiveNav(id)}
              disabled={
                (id === 'continue' && !lastCase && !resumeCheckpoint?.caseId) ||
                (!audienceReady && id !== 'settings' && id !== 'profiles')
              }
              aria-disabled={
                (id === 'continue' && !lastCase && !resumeCheckpoint?.caseId) ||
                (!audienceReady && id !== 'settings' && id !== 'profiles')
              }
              title={
                id === 'continue' && !lastCase && !resumeCheckpoint?.caseId
                  ? 'No saved session yet'
                  : id === 'continue' && resumeCheckpoint?.caseId
                    ? 'Resume your recent in-progress case'
                    : label
              }
            >
              <Icon className="welcome-nav-icon" aria-hidden />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <blockquote className="welcome-quote">
          <p>&ldquo;{brand.quote}&rdquo;</p>
          <cite>— {brand.quoteAuthor}</cite>
        </blockquote>
      </div>

      {panel && (
        <div className="welcome-panel-backdrop" role="presentation" onClick={() => setPanel(null)} />
      )}
      {panel === 'profiles' && (
        <aside className="welcome-panel" aria-label="Profiles">
          <button type="button" className="welcome-panel-close" onClick={() => setPanel(null)}>
            ✕
          </button>
          <h2>Your progress</h2>
          <p className="welcome-panel-stat">
            <strong>{stats.completed}</strong> / {stats.total} cases mastered
          </p>
          <p className="welcome-panel-stat muted">{stats.pct}% complete · {stats.played} played</p>
          {journalStats && (
            <div className="welcome-journal-stats">
              <p className="welcome-panel-kicker">Practice journal</p>
              <p className="welcome-panel-stat muted">
                {journalStats.totalSessions} runs · {journalStats.totalChatMessages} chat ·{' '}
                {journalStats.totalRecordings} recordings · {journalStats.totalNoteEvents} notes logged
              </p>
            </div>
          )}
          {lastCase && (
            <p className="welcome-panel-meta">
              Last case: <strong>{lastCase.title}</strong>
            </p>
          )}
          <div className="welcome-panel-actions">
            <button
              type="button"
              className="welcome-panel-btn"
              onClick={() => {
                ensureReadyForCases();
                onOpenReadyCases();
              }}
            >
              Ready to practice ({readyCount}) →
            </button>
            {stackTestingCount > 0 && onOpenStackTestingCases && (
              <button
                type="button"
                className="welcome-panel-btn"
                onClick={() => {
                  ensureReadyForCases();
                  onOpenStackTestingCases();
                }}
              >
                Stack testing ({stackTestingCount}) →
              </button>
            )}
            {onOpenFlaggedCases && (
              <button
                type="button"
                className="welcome-panel-btn"
                onClick={() => {
                  ensureReadyForCases();
                  onOpenFlaggedCases();
                }}
              >
                Review next ({flaggedCount}) →
              </button>
            )}
            <button
              type="button"
              className="welcome-panel-btn btn-ghost"
              onClick={() => {
                ensureReadyForCases();
                onOpenCases();
              }}
            >
              Browse all cases →
            </button>
          </div>
        </aside>
      )}
      {panel === 'settings' && (
        <aside className="welcome-panel" aria-label="Settings">
          <button type="button" className="welcome-panel-close" onClick={() => setPanel(null)}>
            ✕
          </button>
          <h2>Settings</h2>
          <label className="welcome-settings-field">
            <span>Case timer (minutes)</span>
            <input
              type="number"
              min={1}
              max={60}
              step={0.5}
              value={timerMinutes}
              onChange={(e) => {
                const next = Number(e.target.value);
                setTimerMinutes(next);
                const profile = readAudienceProfile() || {};
                writeAudienceProfile({
                  ...profile,
                  timerSeconds: normalizeTimerSeconds(Math.round(next * 60), DEFAULT_TIMER_SECONDS),
                });
              }}
            />
          </label>
          <button type="button" className="welcome-panel-btn" onClick={toggleTheme}>
            Theme: {theme === 'light' ? 'Light' : 'Dark'}
          </button>
          <GlobalUiSettingsPanel />
          <AudioSettingsPanel />
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => loadPatientImage(e.target.files?.[0])} />
          {patientSet ? (
            <button type="button" className="welcome-panel-btn" onClick={clearPatientImage}>
              Revert patient photo
            </button>
          ) : (
            <button type="button" className="welcome-panel-btn" onClick={() => fileRef.current?.click()}>
              Override patient photo…
            </button>
          )}
        </aside>
      )}
    </main>
  );
}
