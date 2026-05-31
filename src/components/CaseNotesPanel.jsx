import { useCallback, useEffect, useRef, useState } from 'react';
import { readCaseNotes, writeCaseNotes } from '../lib/caseNotes.js';
import { fetchCaseUserData, recordingPublicUrl } from '../lib/caseUserLog.js';
import CaseRecordButton from './CaseRecordButton.jsx';

export default function CaseNotesPanel({
  caseId,
  sessionId,
  compact = false,
  minimal = false,
  placeholder = 'Your notes for this case…',
  onTimelineNote,
  onRecordingSaved,
}) {
  const [notes, setNotes] = useState(() => readCaseNotes(caseId));
  const [recordings, setRecordings] = useState([]);
  const noteTimerRef = useRef(null);

  const loadRecordings = useCallback(async () => {
    const data = await fetchCaseUserData(caseId);
    if (!data?.sessions) {
      setRecordings([]);
      return;
    }
    const rows = [];
    data.sessions.forEach((session) => {
      (session.recordings || []).forEach((rec) => {
        rows.push({ ...rec, attempt: session.attempt, sessionId: session.id });
      });
    });
    rows.sort((a, b) => String(b.at).localeCompare(String(a.at)));
    setRecordings(rows);
  }, [caseId]);

  useEffect(() => {
    setNotes(readCaseNotes(caseId));
    void loadRecordings();
  }, [caseId, loadRecordings]);

  useEffect(() => {
    writeCaseNotes(caseId, notes);
  }, [caseId, notes]);

  useEffect(() => {
    if (!onTimelineNote) return undefined;
    if (noteTimerRef.current) clearTimeout(noteTimerRef.current);
    noteTimerRef.current = setTimeout(() => {
      onTimelineNote(notes);
    }, 1200);
    return () => {
      if (noteTimerRef.current) clearTimeout(noteTimerRef.current);
    };
  }, [notes, onTimelineNote]);

  const handleRecordingSaved = useCallback(
    (rec) => {
      void loadRecordings();
      onRecordingSaved?.(rec);
    },
    [loadRecordings, onRecordingSaved],
  );

  return (
    <div className={`case-notes-panel ${compact ? 'compact' : ''} ${minimal ? 'minimal' : ''}`}>
      {!minimal && (
        <p className="case-notes-hint">Saved per case in your journal — every run is logged.</p>
      )}
      <CaseRecordButton
        caseId={caseId}
        sessionId={sessionId}
        compact
        onSaved={handleRecordingSaved}
        onError={(e) => console.warn(e)}
      />
      {recordings.length > 0 && (
        <ul className="case-recordings-list" aria-label="Saved intuition recordings">
          {recordings.slice(0, 8).map((rec) => (
            <li key={rec.id}>
              <span className="case-recording-meta">
                Run {rec.attempt || '?'} · {Math.round((rec.durationMs || 0) / 1000)}s
              </span>
              <audio controls preload="none" src={recordingPublicUrl(rec.file)} />
            </li>
          ))}
        </ul>
      )}
      <textarea
        className="soap-input case-notes-input"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder={placeholder}
        rows={compact ? 4 : 8}
        aria-label="Case notes"
      />
    </div>
  );
}
