"""
Native Chatterbox Turbo TTS for Schoonmaker — one model load, fast multi-chunk generation.

Usage:
  python read_case_tts.py --cache-dir .case-tts-cache/case-032/hpi/<hash> [--voice-ref path.flac]
  python read_case_tts.py --text-file case.txt --out narration.wav [--voice-ref path.flac]
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

import torch
import torchaudio as ta

from chatterbox.tts_turbo import ChatterboxTurboTTS

SR = 24000
PAUSE_S = 0.35


def split_into_chunks(text: str, max_chars: int = 380) -> list[str]:
    text = text.strip()
    if not text:
        return []
    blocks = [b.strip() for b in re.split(r"\n\s*\n", text) if b.strip()]
    chunks: list[str] = []
    for block in blocks:
        if len(block) <= max_chars:
            chunks.append(block)
            continue
        parts = re.split(r"(?<=[.!?])\s+", block)
        buf = ""
        for p in parts:
            if not p.strip():
                continue
            if len(buf) + len(p) + 1 <= max_chars:
                buf = (buf + " " + p).strip()
            else:
                if buf:
                    chunks.append(buf)
                buf = p.strip()
                while len(buf) > max_chars:
                    chunks.append(buf[:max_chars])
                    buf = buf[max_chars:].strip()
        if buf:
            chunks.append(buf)
    return [c for c in chunks if c]


def resolve_voice_ref(explicit: str | None) -> Path:
    if explicit:
        p = Path(explicit).expanduser().resolve()
        if p.is_file():
            return p
        raise FileNotFoundError(f"Voice reference not found: {p}")

    env = __import__("os").environ.get("CHATTERBOX_VOICE_REF", "").strip()
    if env:
        p = Path(env).expanduser().resolve()
        if p.is_file():
            return p

    root_raw = __import__("os").environ.get("CHATTERBOX_ROOT", "").strip()
    if not root_raw:
        home = Path.home()
        root = home / "chatterbox"
    else:
        root = Path(root_raw).expanduser()
    for pattern in ("VoiceClone*.flac", "VoiceClone*.wav", "VoiceClone*.mp3", "*.flac"):
        matches = sorted(root.glob(pattern))
        if matches:
            return matches[0].resolve()

    raise FileNotFoundError(
        "No voice reference. Set CHATTERBOX_VOICE_REF or pass --voice-ref."
    )


def write_manifest(path: Path, manifest: dict) -> None:
    manifest["updatedAt"] = datetime.now(timezone.utc).isoformat()
    path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")


def generate_cache_dir(cache_dir: Path, voice_ref: str | None) -> int:
    """Native fast path: load Turbo once, generate all pending chunks, save structured cache."""
    cache_dir = cache_dir.resolve()
    manifest_path = cache_dir / "manifest.json"
    chunks_dir = cache_dir / "chunks"
    if not manifest_path.is_file():
        print(f"Missing manifest: {manifest_path}", file=sys.stderr)
        return 2

    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    chunks_dir.mkdir(parents=True, exist_ok=True)
    ref = resolve_voice_ref(voice_ref)

    pending = []
    for chunk in manifest.get("chunks", []):
        out = chunks_dir / chunk["file"]
        if chunk.get("status") == "ready" and out.is_file():
            continue
        pending.append(chunk)

    if not pending:
        print(f"OK all {len(manifest.get('chunks', []))} chunks cached", flush=True)
        return 0

    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"device={device} ref={ref.name} pending={len(pending)}", flush=True)
    model = ChatterboxTurboTTS.from_pretrained(device)

    prompted = False
    for chunk in pending:
        idx = chunk["index"]
        text = chunk["text"]
        out = chunks_dir / chunk["file"]
        print(f"[chunk {idx + 1}] {len(text)} chars", flush=True)
        wav = model.generate(
            text,
            audio_prompt_path=str(ref) if not prompted else None,
            norm_loudness=True,
        )
        prompted = True
        w = wav.squeeze().cpu().float()
        if w.ndim == 1:
            w = w.unsqueeze(0)
        ta.save(str(out), w, SR)
        chunk["status"] = "ready"
        chunk["durationSec"] = round(w.shape[-1] / SR, 2)
        write_manifest(manifest_path, manifest)

    # Optional full concat for single-file playback
    pieces: list[torch.Tensor] = []
    silence = torch.zeros(1, int(SR * PAUSE_S))
    ordered = sorted(manifest.get("chunks", []), key=lambda c: c["index"])
    for i, chunk in enumerate(ordered):
        fp = chunks_dir / chunk["file"]
        if not fp.is_file():
            continue
        audio, sr = ta.load(str(fp))
        if sr != SR:
            import torchaudio.functional as F
            audio = F.resample(audio, sr, SR)
        pieces.append(audio)
        if i < len(ordered) - 1:
            pieces.append(silence.clone())

    if pieces:
        full = torch.cat(pieces, dim=-1)
        ta.save(str(cache_dir / "full.wav"), full, SR)
        dur = full.shape[-1] / SR
        print(f"OK full.wav duration={dur:.1f}s", flush=True)

    print(f"OK cache-dir {cache_dir}", flush=True)
    return 0


def generate_full_file(text_file: Path, out_path: Path, voice_ref: str | None) -> int:
    text = text_file.read_text(encoding="utf-8").strip()
    if not text:
        print("Empty text", file=sys.stderr)
        return 2
    ref = resolve_voice_ref(voice_ref)
    chunks = split_into_chunks(text)
    device = "cuda" if torch.cuda.is_available() else "cpu"
    model = ChatterboxTurboTTS.from_pretrained(device)
    pieces: list[torch.Tensor] = []
    silence = torch.zeros(1, int(SR * PAUSE_S))
    for i, chunk in enumerate(chunks):
        print(f"[{i + 1}/{len(chunks)}] {len(chunk)} chars", flush=True)
        wav = model.generate(
            chunk,
            audio_prompt_path=str(ref) if i == 0 else None,
            norm_loudness=True,
        )
        w = wav.squeeze().cpu().float()
        if w.ndim == 1:
            w = w.unsqueeze(0)
        pieces.append(w)
        if i < len(chunks) - 1:
            pieces.append(silence.clone())
    full = torch.cat(pieces, dim=-1)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    ta.save(str(out_path), full, SR)
    print(f"OK {out_path} duration={full.shape[-1] / SR:.1f}s", flush=True)
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Schoonmaker native Chatterbox Turbo TTS")
    parser.add_argument("--cache-dir", default=None, help="Structured cache folder with manifest.json")
    parser.add_argument("--text-file", default=None, help="UTF-8 text file (full-file mode)")
    parser.add_argument("--out", default=None, help="Output WAV (full-file mode)")
    parser.add_argument("--voice-ref", default=None, help="Voice clone reference audio")
    args = parser.parse_args()

    try:
        if args.cache_dir:
            return generate_cache_dir(Path(args.cache_dir), args.voice_ref)
        if args.text_file and args.out:
            return generate_full_file(
                Path(args.text_file).resolve(),
                Path(args.out).resolve(),
                args.voice_ref,
            )
        print("Use --cache-dir or --text-file + --out", file=sys.stderr)
        return 2
    except FileNotFoundError as e:
        print(str(e), file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
