import { useCallback, useEffect, useRef, useState } from 'react';
import { FiMessageCircle, FiSend, FiX } from 'react-icons/fi';
import {
  checkCaseChatAvailable,
  ensureCaseChatSession,
  sendCaseChatMessage,
} from '../lib/caseChat.js';
import { loadPersistedChatHistory, logChatMessage } from '../lib/caseUserLog.js';

function welcomeMessage(caseData) {
  return caseData?.playRole === 'patient'
    ? 'Ask me about my symptoms, history, or how I feel — I only know what is in this case.'
    : 'Ask about this case — presentation, vitals, exam, differential, or workup. Answers use this case JSON only.';
}

function toUiMessages(rows, caseData) {
  if (!rows?.length) {
    return [{ role: 'assistant', content: welcomeMessage(caseData) }];
  }
  return rows.map((m) => ({ role: m.role, content: m.content }));
}

export default function CaseChatPanel({ caseData, open, onClose, playSessionId }) {
  const [available, setAvailable] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const listRef = useRef(null);
  const caseId = caseData?.id;

  useEffect(() => {
    let cancelled = false;
    checkCaseChatAvailable().then((ok) => {
      if (!cancelled) setAvailable(ok);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!caseId) return undefined;
    let cancelled = false;
    setHistoryLoaded(false);
    loadPersistedChatHistory(caseId)
      .then((rows) => {
        if (cancelled) return;
        setMessages(toUiMessages(rows, caseData));
        setHistoryLoaded(true);
      })
      .catch(() => {
        if (!cancelled) {
          setMessages([{ role: 'assistant', content: welcomeMessage(caseData) }]);
          setHistoryLoaded(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [caseId, caseData?.playRole]);

  useEffect(() => {
    if (!open || !caseId || !historyLoaded) return undefined;
    let cancelled = false;
    setError('');
    setBusy(true);
    ensureCaseChatSession(caseData)
      .then((id) => {
        if (!cancelled) setSessionId(id);
      })
      .catch((e) => {
        if (!cancelled) setError(String(e.message || e));
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, caseId, caseData, historyLoaded]);

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, busy]);

  const persistMessage = useCallback(
    (role, content) => {
      if (!caseId || !content) return;
      void logChatMessage(caseId, playSessionId, role, content);
    },
    [caseId, playSessionId],
  );

  const submit = useCallback(async () => {
    const text = input.trim();
    if (!text || !sessionId || busy) return;
    setInput('');
    setError('');
    setMessages((prev) => [...prev, { role: 'user', content: text }]);
    persistMessage('user', text);
    setBusy(true);
    try {
      const reply = await sendCaseChatMessage(sessionId, text);
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
      persistMessage('assistant', reply);
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      setBusy(false);
    }
  }, [input, sessionId, busy, persistMessage]);

  if (!open) return null;

  return (
    <>
      <div className="case-chat-backdrop" role="presentation" onClick={onClose} />
      <aside className="case-chat-panel" aria-label="Chat with case">
        <header className="case-chat-head">
          <div className="case-chat-head-text">
            <FiMessageCircle aria-hidden />
            <span>Case chat</span>
            <span className="case-chat-case-id">#{caseData?.ccsNumber || caseData?.id}</span>
          </div>
          <button type="button" className="case-chat-close" onClick={onClose} aria-label="Close case chat">
            <FiX aria-hidden />
          </button>
        </header>

        {available === false && (
          <p className="case-chat-banner bad">
            Case chat needs an LLM. Add <code>OPENAI_API_KEY</code> to <code>.env</code>, or run{' '}
            <code>ollama serve</code> (Llama already installed), then restart the API server.
          </p>
        )}
        {error && <p className="case-chat-banner bad">{error}</p>}

        <div className="case-chat-messages" ref={listRef}>
          {messages.map((m, i) => (
            <div key={`${m.role}-${i}-${m.content.slice(0, 24)}`} className={`case-chat-bubble ${m.role}`}>
              {m.content}
            </div>
          ))}
          {busy && <div className="case-chat-bubble assistant typing">Thinking…</div>}
        </div>

        <form
          className="case-chat-form"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <input
            type="text"
            className="case-chat-input"
            placeholder={
              available === false
                ? 'Configure OpenAI or Ollama first…'
                : 'Ask about this case…'
            }
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={busy || !sessionId || available === false}
          />
          <button
            type="submit"
            className="case-chat-send"
            disabled={busy || !input.trim() || !sessionId || available === false}
            aria-label="Send message"
          >
            <FiSend aria-hidden />
          </button>
        </form>
      </aside>
    </>
  );
}
