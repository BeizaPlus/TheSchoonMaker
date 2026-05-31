# Chatterbox TTS bridge (Schoonmaker)

Uses your local [Chatterbox](https://github.com/resemble-ai/chatterbox) install for **Read case** narration.

## Setup

1. Keep Chatterbox on this machine (default: `C:\Users\steve\chatterbox` with `.venv`).
2. Set a voice clone reference in `.env` (repo root `ER doc/.env`):

```env
CHATTERBOX_ROOT=C:\Users\steve\chatterbox
CHATTERBOX_PYTHON=C:\Users\steve\chatterbox\.venv\Scripts\python.exe
CHATTERBOX_VOICE_REF=C:\Users\steve\chatterbox\VoiceClone_STEF_AMP_under25MB.flac
```

3. First run loads the GPU model — expect 30–90s for a long case.

## Files

| File | Role |
|------|------|
| `read_case_tts.py` | CLI: text file → WAV via Chatterbox Turbo |
| `.case-tts-cache/` (repo root) | Cached narrations served at `/case-tts/` |

## Cache layout

Each case section is stored in structured folders:

```
.case-tts-cache/
  case-032/
    hpi/
      <textHash>/
        manifest.json   ← chunk list + status
        source.txt      ← full source text
        chunks/
          000.wav
          001.wav
          ...
```

Chunks are generated one at a time. If generation stops partway, finished chunks stay on disk and the next **Read case** resumes from the next missing chunk.

## Manual test

```powershell
$py = "C:\Users\steve\chatterbox\.venv\Scripts\python.exe"
$txt = "Day 1 emergency department. A 65-year-old man with chest pain."
Set-Content -Path .\tmp-case.txt -Value $txt -Encoding utf8
& $py .\tools\chatterbox\read_case_tts.py --text-file .\tmp-case.txt --out .\tmp-case.wav
```

This folder is a **fork of the workflow** from your Chatterbox workspace — not a copy of the full `.venv` (too large for git).
