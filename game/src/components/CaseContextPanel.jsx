import { useEffect, useState } from 'react';
import { FiVolume2 } from 'react-icons/fi';
import CcsScreenshotLink from './CcsScreenshotLink.jsx';

export default function CaseContextPanel({
  caseData,
  brandName = 'Schoonmaker',
  hpiText = '',
  examSummary = '',
  showStats = false,
  readyCount = 0,
  doneCount = 0,
  totalCount = 0,
  timerLabel = '',
  timerState = '',
  showTimer = false,
  hideHeader = false,
  textStyle = {},
  onReadCase = null,
  readState = 'idle',
  readLabel = 'Read case',
  headerControls = null,
  locationContext = '',
  defaultTab = 'hpi',
  /** briefing = HPI + physical exam only (no treatment until Begin case) */
  mode = 'play',
  showTreatmentTab = false,
  showNotesTab = false,
  treatmentPanel = null,
  treatmentSummaryText = '',
  notesPanel = null,
  notesText = '',
  footer = null,
  activeTab: controlledTab,
  onTabChange,
}) {
  const [infoTab, setInfoTab] = useState(defaultTab);
  const isControlled = controlledTab != null && typeof onTabChange === 'function';
  const tab = isControlled ? controlledTab : infoTab;
  const setTab = isControlled ? onTabChange : setInfoTab;
  const isBriefing = mode === 'briefing';
  const treatmentEnabled = !isBriefing && showTreatmentTab;
  const notesEnabled = !isBriefing && showNotesTab;
  const isTreatment = tab === 'treatment';
  const isNotes = tab === 'notes';

  useEffect(() => {
    if (!isControlled) setInfoTab(defaultTab);
  }, [defaultTab, caseData?.id, isControlled]);

  const bodyText =
    tab === 'hpi'
      ? hpiText || 'No history available.'
      : tab === 'exam'
        ? examSummary || 'No physical exam findings documented yet.'
        : treatmentSummaryText || 'No treatment summary available.';

  const readSection =
    tab === 'hpi' ? 'hpi' : tab === 'exam' ? 'exam' : tab === 'treatment' ? 'treatment' : tab;

  const readBusy = readState === 'generating';
  const readPlaying = readState === 'playing';

  return (
    <div
      className={`sidebar-top clinical-pack-top case-context-panel ${treatmentEnabled && treatmentPanel ? 'case-context-panel--play' : ''}`.trim()}
    >
      {!hideHeader && (
        <>
          <div className="pack-heading-row">
            <p className="sidebar-case-id">
              Case {caseData.ccsNumber || caseData.id}
              <CcsScreenshotLink caseData={caseData} className="ccs-screenshot-link ccs-screenshot-link--inline" />
            </p>
            {headerControls}
            <span className="pack-tag">{brandName}</span>
          </div>
          <h2 className="sidebar-title" title={caseData.title}>
            {caseData.title}
          </h2>
          {locationContext && <p className="case-location-context">{locationContext}</p>}
        </>
      )}
      <div className="case-info-tabs" role="tablist" aria-label="Case context tabs">
        <button
          type="button"
          className={tab === 'hpi' ? 'case-info-tab active' : 'case-info-tab'}
          onClick={() => setTab('hpi')}
          aria-selected={tab === 'hpi'}
        >
          HPI
        </button>
        <button
          type="button"
          className={tab === 'exam' ? 'case-info-tab active' : 'case-info-tab'}
          onClick={() => setTab('exam')}
          aria-selected={tab === 'exam'}
        >
          Physical exam
        </button>
        {treatmentEnabled && (
          <button
            type="button"
            className={tab === 'treatment' ? 'case-info-tab active' : 'case-info-tab'}
            onClick={() => setTab('treatment')}
            aria-selected={tab === 'treatment'}
          >
            {treatmentPanel ? 'Treatment' : 'Treatment plan'}
          </button>
        )}
        {notesEnabled && (
          <button
            type="button"
            className={tab === 'notes' ? 'case-info-tab active' : 'case-info-tab'}
            onClick={() => setTab('notes')}
            aria-selected={tab === 'notes'}
          >
            Notes
          </button>
        )}
      </div>
      {!isNotes && onReadCase && (tab !== 'treatment' || !treatmentPanel) && (
        <div className="case-read-row">
          <button
            type="button"
            className={`btn-ghost case-read-btn ${readPlaying ? 'active' : ''}`}
            onClick={() => onReadCase(readSection, bodyText)}
            disabled={readBusy}
          >
            <FiVolume2 aria-hidden />
            {readBusy ? 'Generating…' : readPlaying ? 'Stop reading' : readLabel}
          </button>
        </div>
      )}
      {!isTreatment && !isNotes && (
        <p className="sub case-context-body clinical-text-block" style={textStyle} title={bodyText}>
          {bodyText}
        </p>
      )}
      {isTreatment && !treatmentPanel && treatmentSummaryText && (
        <p className="sub case-context-body clinical-text-block" style={textStyle} title={treatmentSummaryText}>
          {treatmentSummaryText}
        </p>
      )}
      {isNotes && !notesPanel && notesText && (
        <p className="sub case-context-body case-notes-body clinical-text-block" style={textStyle}>
          {notesText}
        </p>
      )}
      {isNotes && notesPanel}
      {showStats && (
        <div className="pack-stats">
          <span>
            Stacks left <strong>{readyCount}</strong>
          </span>
          <span>
            Placed <strong>{doneCount}</strong> / <strong>{totalCount}</strong> to save patient
          </span>
        </div>
      )}
      {showTimer && (
        <div className={`pack-timer ${timerState}`}>
          <span>Save timer</span>
          <strong>{timerLabel}</strong>
        </div>
      )}
      {isTreatment && treatmentPanel && (
        <div className="case-treatment-stacks sidebar-stacks">{treatmentPanel}</div>
      )}
      {footer}
    </div>
  );
}
