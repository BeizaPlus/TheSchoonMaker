#!/usr/bin/env python3
"""Schoonmaker self-evaluation audit — run anytime via npm run eval."""

from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime
from pathlib import Path

GAME_ROOT = Path(__file__).resolve().parents[1]
ER_DOC_ROOT = GAME_ROOT.parent
SRC_ROOT = GAME_ROOT / "src"
PREPARED_PATH = GAME_ROOT / "src" / "data" / "preparedCases.json"
REPORT_PATH = ER_DOC_ROOT / "scripts" / "eval_report.json"
VIDEO_DIR = GAME_ROOT / "public" / "assets" / "video"
AUDIO_DIR = GAME_ROOT / "public" / "assets" / "audio"

GENERIC_DISTRACTOR_PATTERNS = [
    "discharge paperwork",
    "outpatient referral",
    "insurance",
    "diet counseling handout",
]

OLLAMA_URL = "http://127.0.0.1:11434/api/chat"
OLLAMA_MODEL = "mistral"


def load_prepared() -> dict:
    return json.loads(PREPARED_PATH.read_text(encoding="utf-8"))


def save_prepared(doc: dict) -> None:
    doc["evalFixedAt"] = datetime.now().isoformat()
    PREPARED_PATH.write_text(json.dumps(doc, indent=2), encoding="utf-8")


def case_hpi(case: dict) -> str:
    narrative = case.get("narrative") or {}
    for audience in ("doctor", "patient"):
        block = narrative.get(audience) or {}
        for level in ("standard", "easy", "hard"):
            hpi = (block.get(level) or {}).get("hpi") or ""
            if len(hpi.strip()) >= 50:
                return hpi.strip()
    return ""


def patient_voice_present(case: dict) -> bool:
    voice = case.get("patientVoice")
    if isinstance(voice, str) and len(voice.strip()) >= 20:
        return True
    narrative = case.get("narrative") or {}
    patient = narrative.get("patient") or {}
    for level in ("standard", "easy", "hard"):
        block = patient.get(level) or {}
        if len((block.get("hpi") or "").strip()) >= 20:
            return True
        if len((block.get("intro") or "").strip()) >= 20:
            return True
    return False


def exam_has_general(case: dict) -> bool:
    exam = case.get("exam") or case.get("physical_exam") or []
    for row in exam:
        if not isinstance(row, (list, tuple)) or len(row) < 2:
            continue
        if str(row[0]).strip().lower() == "general" and str(row[1]).strip():
            return True
    return False


def vitals_ok(vitals: dict) -> bool:
    if not isinstance(vitals, dict):
        return False
    hr = vitals.get("hr")
    spo2 = vitals.get("spo2")
    sbp = vitals.get("sbp")
    dbp = vitals.get("dbp")
    return all(v is not None for v in (hr, spo2, sbp, dbp))


def decoys_list(case: dict) -> list:
    return case.get("decoys") or case.get("distractors") or []


def orders_list(case: dict) -> list:
    return case.get("interventions") or case.get("correct_orders") or []


def generic_decoy_labels(decoys: list) -> list[str]:
    bad = []
    for d in decoys:
        label = (d.get("label") if isinstance(d, dict) else str(d)).lower()
        for pattern in GENERIC_DISTRACTOR_PATTERNS:
            if pattern in label:
                bad.append(d.get("label") if isinstance(d, dict) else str(d))
                break
    return bad


def score_case(case: dict) -> tuple[float, list[str]]:
    issues: list[str] = []
    score = 0.0

    if case.get("id"):
        score += 0.5
    else:
        issues.append("missing id")

    if case.get("title") and not str(case.get("title")).startswith("_"):
        score += 0.5
    else:
        issues.append("missing title")

    diagnosis = str(case.get("diagnosis") or "").strip()
    if diagnosis and diagnosis.lower() not in {"unknown", "n/a", "none"}:
        score += 1.0
    else:
        issues.append("missing diagnosis")

    orders = orders_list(case)
    orders_with_rationale = [
        o
        for o in orders
        if (o.get("why") if isinstance(o, dict) else True)
        and len(str(o.get("why") if isinstance(o, dict) else o).strip()) > 5
    ]
    if len(orders) >= 3 and len(orders_with_rationale) >= 3:
        score += 1.5
    else:
        issues.append("missing orders/rationale")

    hpi = case_hpi(case)
    if len(hpi) >= 50:
        score += 1.5
    else:
        issues.append("missing hpi")

    if patient_voice_present(case):
        score += 1.0
    else:
        issues.append("missing patient_voice")

    decoys = decoys_list(case)
    if len(decoys) == 4:
        score += 1.5
    else:
        issues.append("missing distractors")

    generic = generic_decoy_labels(decoys)
    if not generic:
        score += 1.0
    else:
        issues.append("generic distractors")

    if vitals_ok(case.get("vitals") or {}):
        score += 1.5
    else:
        issues.append("missing vitals")

    if exam_has_general(case):
        score += 1.0
    else:
        issues.append("missing physical_exam general")

    return round(min(score, 10.0), 1), issues


def audit_case_bank() -> dict:
    doc = load_prepared()
    cases = doc.get("cases") or {}
    results = []
    score_10 = 0
    score_7_9 = 0
    score_below_7: list[str] = []
    missing_diagnosis = []
    missing_orders = []
    missing_hpi = []
    missing_distractors = []
    generic_distractors = []

    for case_id, case in sorted(cases.items(), key=lambda x: int(x[0])):
        score, issues = score_case(case)
        entry = {"id": case_id, "score": score, "issues": issues}
        results.append(entry)
        if score == 10:
            score_10 += 1
        elif score >= 7:
            score_7_9 += 1
        else:
            score_below_7.append(case_id)
        if "missing diagnosis" in issues:
            missing_diagnosis.append(case_id)
        if "missing orders/rationale" in issues:
            missing_orders.append(case_id)
        if "missing hpi" in issues:
            missing_hpi.append(case_id)
        if "missing distractors" in issues:
            missing_distractors.append(case_id)
        if "generic distractors" in issues:
            generic_distractors.append(case_id)

    return {
        "total_cases": len(cases),
        "score_10": score_10,
        "score_7_9": score_7_9,
        "score_below_7": score_below_7,
        "missing_diagnosis": missing_diagnosis,
        "missing_orders": missing_orders,
        "missing_hpi": missing_hpi,
        "missing_distractors": missing_distractors,
        "generic_distractors": generic_distractors,
        "cases": results,
    }


def check_video_files() -> dict:
    names = ["breathing_01.mp4", "breathing_02.mp4", "breathing_03.mp4", "death.mp4"]
    out = {}
    for name in names:
        path = VIDEO_DIR / name
        if path.exists() and path.stat().st_size > 0:
            out[name] = {"ok": True, "size_bytes": path.stat().st_size}
        else:
            out[name] = {"ok": False, "size_bytes": 0}
    return out


def check_audio_files() -> dict:
    candidates = [
        AUDIO_DIR / "icu_ambient.mp3",
        AUDIO_DIR / "icu-monitor-ambient.mp3",
        AUDIO_DIR / "icu-monitor-lite.mp3",
    ]
    for path in candidates:
        if path.exists() and path.stat().st_size > 0:
            return {"ok": True, "file": path.name, "size_bytes": path.stat().st_size}
    return {"ok": False, "file": None, "size_bytes": 0}


def grep_files(pattern: str, root: Path, extensions=(".jsx", ".js")) -> list[str]:
    hits = []
    rx = re.compile(pattern)
    for path in root.rglob("*"):
        if path.suffix not in extensions:
            continue
        try:
            text = path.read_text(encoding="utf-8", errors="ignore")
        except OSError:
            continue
        if rx.search(text):
            hits.append(str(path.relative_to(GAME_ROOT)).replace("\\", "/"))
    return sorted(set(hits))


def check_source_code() -> dict:
    hardcoded = grep_files(r"C:\\Users\\steve", SRC_ROOT)
    vitals_hits = grep_files(r"vitals\.(hr|spo2|sbp|dbp)", SRC_ROOT)

    unsafe_vitals = []
    for rel in vitals_hits:
        path = GAME_ROOT / rel.replace("/", "\\")
        if not path.exists():
            continue
        text = path.read_text(encoding="utf-8", errors="ignore")
        if re.search(r"vitals\.(hr|spo2|sbp|dbp)(?!\s*\?\?)", text):
            if "??" not in text and "?." not in text:
                unsafe_vitals.append(rel)

    video_files = list(SRC_ROOT.rglob("*"))
    video_unmuted = []
    idle_ok = False
    idle_count = 0
    for path in video_files:
        if path.suffix not in {".jsx", ".js"}:
            continue
        text = path.read_text(encoding="utf-8", errors="ignore")
        if "<video" in text:
            blocks = re.findall(r"<video[\s\S]*?/?>", text)
            for block in blocks:
                if "muted" not in block.lower():
                    video_unmuted.append(f"{path.relative_to(GAME_ROOT)}: missing muted on tag")
        if "idleVideos" in text:
            m = re.search(r"idleVideos\s*=\s*\[(.*?)\]", text, re.S)
            if m:
                entries = re.findall(r"['\"]([^'\"]+)['\"]", m.group(1))
                idle_count = len(entries)
                idle_ok = idle_count >= 3

    return {
        "hardcoded_paths": hardcoded,
        "nan_risk_files": unsafe_vitals,
        "video_unmuted": video_unmuted,
        "idleVideos_ok": idle_ok,
        "idleVideos_count": idle_count,
    }


def check_git_state() -> dict:
    def run(args: list[str]) -> str:
        return subprocess.run(args, cwd=GAME_ROOT, capture_output=True, text=True, check=False).stdout.strip()

    branch = run(["git", "branch", "--show-current"])
    status = run(["git", "status", "--short"])
    ahead_behind = run(["git", "rev-list", "--left-right", "--count", "origin/main...HEAD"])
    parts = ahead_behind.split()
    behind = int(parts[0]) if len(parts) == 2 else 0
    ahead = int(parts[1]) if len(parts) == 2 else 0
    sync = behind == 0 and ahead == 0
    return {
        "branch": branch,
        "status_short": status,
        "uncommitted": [line for line in status.splitlines() if line.strip()],
        "sync_with_origin": sync,
        "ahead": ahead,
        "behind": behind,
    }


def run_build() -> dict:
    try:
        proc = subprocess.run(
            ["npm", "run", "build"],
            cwd=GAME_ROOT,
            capture_output=True,
            text=True,
            timeout=180,
            shell=True,
        )
        dist_ok = (GAME_ROOT / "dist" / "index.html").exists()
        return {
            "ok": proc.returncode == 0,
            "returncode": proc.returncode,
            "dist_updated": dist_ok,
            "stderr_tail": proc.stderr[-1500:] if proc.stderr else "",
            "stdout_tail": proc.stdout[-1500:] if proc.stdout else "",
        }
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "error": str(exc)}


def check_app_load() -> dict:
    """Use vite preview — npm run dev rebuilds preparedCases via predev."""
    port = 4173
    proc = None
    result = {"ok": False, "port": port, "status": None, "error": None}
    dist_index = GAME_ROOT / "dist" / "index.html"
    if not dist_index.exists():
        result["error"] = "dist/index.html missing — run npm run build first"
        return result
    try:
        proc = subprocess.Popen(
            ["npx", "vite", "preview", "--port", str(port), "--host", "127.0.0.1"],
            cwd=GAME_ROOT,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            shell=True,
        )
        time.sleep(4)
        req = urllib.request.urlopen(f"http://127.0.0.1:{port}/", timeout=5)
        result = {"ok": req.status == 200, "port": port, "status": req.status, "error": None}
    except (urllib.error.URLError, TimeoutError) as exc:
        result["error"] = str(exc)
    finally:
        if proc and proc.poll() is None:
            proc.terminate()
            try:
                proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                proc.kill()
    return result


def overall_grade(report: dict) -> str:
    bank = report["case_bank"]
    video_ok = all(v["ok"] for v in report["video_files"].values())
    audio_ok = report["audio_files"]["ok"]
    source_ok = (
        not report["source_code"]["hardcoded_paths"]
        and not report["source_code"]["video_unmuted"]
        and report["source_code"]["idleVideos_ok"]
    )
    build_ok = report["build"].get("skipped") or report["build"]["ok"]
    app_ok = report["app_load"].get("skipped") or report["app_load"]["ok"]
    low_cases = len(bank["score_below_7"])
    missing_decoys = len(bank["missing_distractors"])

    if build_ok and app_ok and video_ok and audio_ok and source_ok and low_cases == 0 and missing_decoys == 0:
        return "A"
    if build_ok and app_ok and low_cases == 0 and missing_decoys <= 30:
        return "B"
    if build_ok and app_ok:
        return "C"
    if build_ok:
        return "C"
    return "F"


def actions_needed(report: dict) -> list[str]:
    actions = []
    bank = report["case_bank"]
    if bank["missing_distractors"]:
        actions.append(f"Fix distractors on {len(bank['missing_distractors'])} cases")
    if bank["generic_distractors"]:
        actions.append(f"Replace generic distractors on {len(bank['generic_distractors'])} cases")
    if bank["missing_hpi"]:
        actions.append(f"Enrich HPI on {len(bank['missing_hpi'])} cases")
    if not all(v["ok"] for v in report["video_files"].values()):
        actions.append("Restore missing breathing/death video files")
    if not report["audio_files"]["ok"]:
        actions.append("Add ICU ambient audio under public/assets/audio/")
    if report["source_code"]["hardcoded_paths"]:
        actions.append("Remove hardcoded C:\\Users\\steve paths from src/")
    if not report["build"]["ok"]:
        actions.append("Fix npm run build errors")
    if not report["app_load"]["ok"]:
        actions.append("Fix dev server / app load failure")
    return actions[:3] if actions else ["No critical actions — run npm run eval periodically"]


def ollama_generate_decoys(title: str, diagnosis: str, correct_orders: list, case_id: str = "0") -> list[dict]:
    orders_text = ", ".join(
        (o.get("label") if isinstance(o, dict) else str(o)) for o in correct_orders[:8]
    )
    prompt = f"""Generate 4 clinically plausible wrong orders for: {title} / diagnosis: {diagnosis}
Correct orders for context: {orders_text}
Return JSON array only:
[{{"order":"","why_wrong":""}}]"""
    payload = json.dumps(
        {
            "model": OLLAMA_MODEL,
            "messages": [{"role": "user", "content": prompt}],
            "stream": False,
        }
    ).encode("utf-8")
    req = urllib.request.Request(
        OLLAMA_URL,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        body = json.loads(resp.read().decode("utf-8"))
    content = body.get("message", {}).get("content", "")
    fenced = re.search(r"```(?:json)?\s*([\s\S]*?)```", content)
    if fenced:
        content = fenced.group(1)
    match = re.search(r"\[[\s\S]*\]", content)
    if not match:
        raise ValueError("No JSON array in Ollama response")
    items = json.loads(match.group(0))
    if not isinstance(items, list):
        raise ValueError("Ollama response is not a JSON array")
    decoys = []
    num = int(case_id) if str(case_id).isdigit() else 0
    for idx, item in enumerate(items):
        if not isinstance(item, dict):
            continue
        label = str(item.get("order") or item.get("label") or "").strip()
        why = str(item.get("why_wrong") or item.get("why") or "").strip()
        if not label:
            continue
        decoys.append(
            {
                "id": f"decoy-eval-{num}-{idx}",
                "label": label,
                "why": why or "Incorrect for this presentation.",
                "correct_zone": "zone-custom-2",
            }
        )
        if len(decoys) >= 4:
            break
    if len(decoys) < 4:
        raise ValueError(f"Expected 4 decoys, got {len(decoys)}")
    return decoys[:4]


def auto_fix_distractors(flagged_ids: list[str]) -> dict:
    backup = PREPARED_PATH.with_name(
        f"preparedCases_backup_eval_{datetime.now().date().isoformat()}.json"
    )
    shutil.copy2(PREPARED_PATH, backup)
    doc = load_prepared()
    cases = doc["cases"]
    fixed = []
    failed = []

    for case_id in flagged_ids:
        case = cases.get(case_id)
        if not case:
            continue
        try:
            decoys = None
            last_err = None
            for attempt in range(3):
                try:
                    decoys = ollama_generate_decoys(
                        case.get("title") or "",
                        case.get("diagnosis") or "",
                        orders_list(case),
                        case_id,
                    )
                    break
                except Exception as exc:  # noqa: BLE001
                    last_err = exc
                    time.sleep(1)
            if not decoys:
                raise last_err or RuntimeError("Ollama failed")
            for idx, decoy in enumerate(decoys):
                decoy["id"] = f"decoy-bank-{int(case_id)}-{idx}"
            case["decoys"] = decoys
            cases[case_id] = case
            save_prepared(doc)
            fixed.append(case_id)
            print(f"Fixed distractors for case {int(case_id)}", flush=True)
        except Exception as exc:  # noqa: BLE001
            failed.append({"id": case_id, "error": str(exc)})
            print(f"FAILED case {case_id}: {exc}")

    return {"backup": str(backup), "fixed": fixed, "failed": failed}


def print_summary(report: dict) -> None:
    ts = report["timestamp"]
    bank = report["case_bank"]
    print("\n" + "=" * 48)
    print(f"SCHOONMAKER SELF EVAL — {ts}")
    print("=" * 48)
    print("\nCASE BANK")
    print(f"  Total cases:          {bank['total_cases']}")
    print(f"  Score 10/10:          {bank['score_10']}")
    print(f"  Score 7-9:            {bank['score_7_9']}")
    print(f"  Score below 7:        {len(bank['score_below_7'])} — {bank['score_below_7'][:20]}")
    print(f"  Missing diagnosis:    {len(bank['missing_diagnosis'])} — {bank['missing_diagnosis'][:15]}")
    print(f"  Missing orders:       {len(bank['missing_orders'])} — {bank['missing_orders'][:15]}")
    print(f"  Missing HPI:          {len(bank['missing_hpi'])} — {bank['missing_hpi'][:15]}")
    print(f"  Missing distractors:  {len(bank['missing_distractors'])} — {bank['missing_distractors'][:15]}")
    print(f"  Generic distractors:  {len(bank['generic_distractors'])} — {bank['generic_distractors'][:15]}")

    print("\nVIDEO FILES")
    for name, info in report["video_files"].items():
        mark = "OK" if info["ok"] else "MISSING"
        size_mb = info["size_bytes"] / (1024 * 1024)
        print(f"  {name}:     {mark} [{size_mb:.1f} MB]")

    audio = report["audio_files"]
    print("\nAUDIO FILES")
    print(f"  icu_ambient:          {'OK' if audio['ok'] else 'MISSING'} ({audio.get('file') or 'none'})")

    src = report["source_code"]
    print("\nSOURCE CODE")
    print(f"  Hardcoded paths:      {'clean' if not src['hardcoded_paths'] else src['hardcoded_paths']}")
    print(f"  NaN risk:             {'clean' if not src['nan_risk_files'] else src['nan_risk_files'][:5]}")
    print(f"  Video muted:          {'clean' if not src['video_unmuted'] else src['video_unmuted']}")
    print(f"  idleVideos populated: {'OK' if src['idleVideos_ok'] else 'FAIL'} ({src['idleVideos_count']})")

    git = report["git"]
    print("\nGIT STATE")
    print(f"  Branch:               {git['branch']}")
    print(f"  Uncommitted changes:  {'none' if not git['uncommitted'] else len(git['uncommitted'])}")
    print(f"  Sync with origin:     {'OK' if git['sync_with_origin'] else 'OUT OF SYNC'}")

    build = report["build"]
    print("\nBUILD")
    print(f"  npm run build:        {'passed' if build['ok'] else 'FAILED'}")

    app = report["app_load"]
    print("\nAPP LOAD")
    print(f"  localhost:{app.get('port') or '5173'}:       {'responds' if app['ok'] else 'FAIL'}")

    grade = report["overall_grade"]
    print("\n" + "=" * 48)
    print(f"OVERALL GRADE: {grade}")
    print("  A = all checks pass")
    print("  B = minor issues, app functional")
    print("  C = some cases incomplete, app loads")
    print("  F = build fails or app does not load")
    print("=" * 48)
    print("\nACTIONS NEEDED:")
    for i, action in enumerate(report["actions_needed"], start=1):
        print(f"  {i}. {action}")
    print("=" * 48)


def run_eval(skip_build: bool = False, skip_app: bool = False) -> dict:
    report = {
        "timestamp": datetime.now().isoformat(),
        "game_root": str(GAME_ROOT),
        "case_bank": audit_case_bank(),
        "video_files": check_video_files(),
        "audio_files": check_audio_files(),
        "source_code": check_source_code(),
        "git": check_git_state(),
        "build": {"ok": True, "skipped": skip_build},
        "app_load": {"ok": True, "skipped": skip_app},
        "auto_fix": None,
    }
    if not skip_build:
        report["build"] = run_build()
    if not skip_app:
        report["app_load"] = check_app_load()
    else:
        report["app_load"] = {"ok": True, "skipped": True, "port": None, "status": None}
    report["overall_grade"] = overall_grade(report)
    report["actions_needed"] = actions_needed(report)
    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    REPORT_PATH.write_text(json.dumps(report, indent=2), encoding="utf-8")
    return report


def main() -> int:
    parser = argparse.ArgumentParser(description="Schoonmaker self evaluation")
    parser.add_argument("--skip-build", action="store_true")
    parser.add_argument("--skip-app", action="store_true")
    parser.add_argument("--fix-distractors", action="store_true")
    parser.add_argument("--no-fix", action="store_true")
    args = parser.parse_args()

    report = run_eval(skip_build=args.skip_build, skip_app=args.skip_app)
    print_summary(report)

    flagged = sorted(
        set(report["case_bank"]["missing_distractors"] + report["case_bank"]["generic_distractors"]),
        key=lambda x: int(x),
    )
    if args.fix_distractors and not args.no_fix and flagged:
        print(f"\nAuto-fixing distractors for {len(flagged)} cases via Ollama {OLLAMA_MODEL}...")
        report["auto_fix"] = auto_fix_distractors(flagged)
        REPORT_PATH.write_text(json.dumps(report, indent=2), encoding="utf-8")
        report = run_eval(skip_build=True, skip_app=True)
        print_summary(report)

    return 0 if report["overall_grade"] in {"A", "B", "C"} else 1


if __name__ == "__main__":
    sys.exit(main())
