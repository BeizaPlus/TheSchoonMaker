/**
 * Chat completions: OpenAI first, Ollama/Llama local fallback.
 */
const OPENAI_CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini';
const OLLAMA_CHAT_URL =
  process.env.OLLAMA_CHAT_URL ||
  process.env.OLLAMA_URL ||
  'http://127.0.0.1:11434/api/chat';
const OLLAMA_BASE = OLLAMA_CHAT_URL.replace(/\/api\/chat\/?$/, '');
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2';

export function hasOpenAiKey() {
  return Boolean(process.env.OPENAI_API_KEY);
}

export function ollamaConfigured() {
  return String(process.env.OLLAMA_ENABLED || '1') !== '0';
}

export function llmProviderPreference() {
  const pref = String(process.env.LLM_PROVIDER || 'auto').toLowerCase();
  if (pref === 'openai' || pref === 'ollama') return pref;
  return 'auto';
}

export function chatAvailableSync() {
  if (llmProviderPreference() === 'ollama') return ollamaConfigured();
  if (llmProviderPreference() === 'openai') return hasOpenAiKey();
  return hasOpenAiKey() || ollamaConfigured();
}

export function isOpenAiFallbackError(err) {
  const s = String(err?.message || err).toLowerCase();
  return (
    s.includes('insufficient_quota') ||
    s.includes('exceeded your current quota') ||
    s.includes('billing') ||
    s.includes('429') ||
    s.includes('401') ||
    s.includes('invalid_api_key') ||
    s.includes('incorrect api key')
  );
}

async function callOpenAiChat(messages, { maxTokens = 700, jsonMode = false, model = OPENAI_CHAT_MODEL } = {}) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY not configured');

  const body = {
    model,
    max_tokens: maxTokens,
    temperature: 0.35,
    messages,
  };
  if (jsonMode) body.response_format = { type: 'json_object' };

  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify(body),
  });

  if (!r.ok) {
    const err = await r.text();
    throw new Error(err || `OpenAI error ${r.status}`);
  }

  const data = await r.json();
  return data.choices?.[0]?.message?.content?.trim() || '';
}

async function callOllamaChat(messages, { maxTokens = 700, jsonMode = false } = {}) {
  const body = {
    model: OLLAMA_MODEL,
    messages,
    stream: false,
    options: {
      temperature: 0.35,
      num_predict: maxTokens,
    },
  };
  if (jsonMode) body.format = 'json';

  const r = await fetch(OLLAMA_CHAT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!r.ok) {
    const err = await r.text();
    throw new Error(
      err ||
        `Ollama error ${r.status}. Is Ollama running? Try: ollama serve (model: ${OLLAMA_MODEL})`,
    );
  }

  const data = await r.json();
  return data.message?.content?.trim() || '';
}

export async function pingOllama() {
  if (!ollamaConfigured()) return false;
  try {
    const r = await fetch(`${OLLAMA_BASE}/api/tags`, { signal: AbortSignal.timeout(2500) });
    return r.ok;
  } catch {
    return false;
  }
}

/**
 * @returns {{ reply: string, provider: 'openai' | 'ollama' }}
 */
export async function chatCompletion(messages, options = {}) {
  const pref = llmProviderPreference();
  const canOpenAi = hasOpenAiKey() && pref !== 'ollama';
  const canOllama = ollamaConfigured() && pref !== 'openai';

  if (canOpenAi) {
    try {
      const reply = await callOpenAiChat(messages, options);
      return { reply, provider: 'openai' };
    } catch (err) {
      if (!canOllama || !isOpenAiFallbackError(err)) throw err;
      console.warn('[llm] OpenAI unavailable, falling back to Ollama:', String(err.message || err).slice(0, 200));
    }
  }

  if (canOllama) {
    const reply = await callOllamaChat(messages, options);
    return { reply, provider: 'ollama' };
  }

  throw new Error(
    'No chat LLM available. Add OPENAI_API_KEY or run Ollama locally (ollama serve — Llama already installed).',
  );
}

export function llmHealthSnapshot() {
  return {
    openai: hasOpenAiKey(),
    ollama: ollamaConfigured(),
    ollamaModel: OLLAMA_MODEL,
    ollamaUrl: OLLAMA_CHAT_URL,
    llmProvider: llmProviderPreference(),
    chatAvailable: chatAvailableSync(),
  };
}
