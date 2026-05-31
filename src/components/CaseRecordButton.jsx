import { useCallback, useRef, useState } from 'react';
import { FiMic, FiSquare } from 'react-icons/fi';
import { uploadCaseRecording } from '../lib/caseUserLog.js';

export default function CaseRecordButton({
  caseId,
  sessionId,
  onSaved,
  onError,
  className = '',
  compact = false,
  iconOnly = false,
}) {
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const startedAtRef = useRef(0);

  const stopTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const stopRecording = useCallback(() => {
    const rec = recorderRef.current;
    if (!rec || rec.state === 'inactive') return;
    rec.stop();
    setRecording(false);
  }, []);

  const startRecording = useCallback(async () => {
    if (!sessionId || recording || busy) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      onError?.(new Error('Microphone not supported in this browser'));
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (event) => {
        if (event.data?.size) chunksRef.current.push(event.data);
      };
      rec.onstop = async () => {
        stopTracks();
        const blob = new Blob(chunksRef.current, {
          type: rec.mimeType || 'audio/webm',
        });
        const durationMs = Math.max(0, Date.now() - startedAtRef.current);
        setBusy(true);
        try {
          const saved = await uploadCaseRecording(caseId, sessionId, blob, durationMs);
          if (saved) onSaved?.(saved);
          else onError?.(new Error('Could not save recording'));
        } catch (e) {
          onError?.(e);
        } finally {
          setBusy(false);
          recorderRef.current = null;
        }
      };
      recorderRef.current = rec;
      startedAtRef.current = Date.now();
      rec.start();
      setRecording(true);
    } catch (e) {
      stopTracks();
      onError?.(e);
    }
  }, [busy, caseId, onError, onSaved, recording, sessionId, stopTracks]);

  return (
    <button
      type="button"
      className={`case-record-btn ${recording ? 'recording' : ''} ${compact ? 'compact' : ''} ${className}`.trim()}
      onClick={recording ? stopRecording : startRecording}
      disabled={!sessionId || busy}
      title={recording ? 'Stop recording — saves to your case log' : 'Record your case intuition'}
      aria-label={recording ? 'Stop recording' : 'Record case intuition'}
    >
      {recording ? <FiSquare aria-hidden /> : <FiMic aria-hidden />}
      {!iconOnly && <span>{recording ? 'Stop' : busy ? 'Saving…' : 'Record'}</span>}
    </button>
  );
}
