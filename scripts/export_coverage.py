#!/usr/bin/env python3
"""Preserve tool-generated, full-scope coverage evidence and readable report images.

Run AFTER the commands in docs/quality/README.md. Does not run tests, alter counts,
or turn an old feature-only report into current application coverage.
"""
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
from datetime import datetime, timezone

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs/quality/evidence"


def load(path):
    return json.loads(path.read_text())


def percent(covered, total):
    return round(100 * covered / total, 4) if total else None


def font(size):
    for path in ("/System/Library/Fonts/Menlo.ttc", "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf"):
        if Path(path).exists():
            return ImageFont.truetype(path, size)
    return ImageFont.load_default(size=size)


def screenshot(title, rows, totals, destination, source_commit):
    # A print of the generated tool report, not a screenshot of source code.
    lines = [title, "Measured runtime files (including unexecuted files)",
             "Source commit: " + source_commit, "File                                                        Statements      Branches", "-" * 87]
    for name, statement, branch in rows:
        lines.append(f"{name:58} {statement:>12} {branch:>12}")
    lines += ["-" * 87, f"TOTAL                                                      {totals[0]:>12} {totals[1]:>12}",
              "Tests, generated migrations and type-only declarations are excluded.",
              "Backend includes config and launchers; frontend includes main.tsx.",
              "See manifest.json and raw tool JSON for denominators and missing code."]
    image = Image.new("RGB", (1450, 100 + len(lines) * 28), "white")
    draw = ImageDraw.Draw(image)
    for index, line in enumerate(lines):
        draw.text((30, 28 + index * 28), line, fill="#172438", font=font(18))
    image.save(destination)


def source_manifest():
    names = subprocess.check_output(["git", "ls-files"], cwd=ROOT, text=True).splitlines()
    prefixes = ("backend/", "frontend/", "scripts/", ".github/")
    files = {}
    for name in names:
        if name.startswith(prefixes) and not name.endswith((".png", ".svg", ".woff", ".woff2")) and name != "backend/coverage.json":
            path = ROOT / name
            if path.is_file():
                files[name] = hashlib.sha256(path.read_bytes()).hexdigest()
    digest = hashlib.sha256(json.dumps(files, sort_keys=True).encode()).hexdigest()
    return {"sha256": digest, "files": files}


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    backend = load(ROOT / "backend/coverage.json")
    frontend_summary = load(ROOT / "frontend/coverage/coverage-summary.json")
    frontend = load(ROOT / "frontend/coverage/coverage-final.json")
    frontend_normalized = {}
    for name, value in frontend.items():
        relative = os.path.relpath(name, ROOT / "frontend")
        value["path"] = relative
        frontend_normalized[relative] = value
    summary_normalized = {"total": frontend_summary["total"]}
    for name, value in frontend_summary.items():
        if name != "total":
            summary_normalized[os.path.relpath(name, ROOT / "frontend")] = value
    (OUT / "backend-report.json").write_text(json.dumps(backend, indent=2) + "\n")
    (OUT / "frontend-report.json").write_text(json.dumps(frontend_normalized, indent=2) + "\n")
    (OUT / "frontend-summary.json").write_text(json.dumps(summary_normalized, indent=2) + "\n")
    shutil.copyfile(ROOT / "backend/coverage.xml", OUT / "backend-report.xml")
    b = backend["totals"]
    f = frontend_summary["total"]
    metrics = {
        "backend": {"statements": percent(b["covered_lines"], b["num_statements"]), "branches": percent(b["covered_branches"], b["num_branches"]), "files": len(backend["files"]), "covered_statements": b["covered_lines"], "statements_total": b["num_statements"], "covered_branches": b["covered_branches"], "branches_total": b["num_branches"]},
        "frontend": {"statements": f["statements"]["pct"], "branches": f["branches"]["pct"], "files": len(frontend), "covered_statements": f["statements"]["covered"], "statements_total": f["statements"]["total"], "covered_branches": f["branches"]["covered"], "branches_total": f["branches"]["total"]},
    }
    commit = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip()
    manifest = {"generated_at_utc": datetime.now(timezone.utc).isoformat(), "source_commit": commit,
                "source": source_manifest(), "tools": {"backend": backend["meta"]}, "metrics": metrics,
                "commands": ["cd backend && python -m pytest --cov --cov-report=json --cov-report=xml --cov-report=html --cov-report=term-missing", "cd frontend && npm run test:coverage", "backend/.venv/bin/python scripts/export_coverage.py"],
                "scope": {"backend": "All Python under backend, including config and launchers; excludes virtualenv, tests and generated migrations.", "frontend": "src/**/*.{ts,tsx}, including main.tsx; excludes tests, test setup and .d.ts declarations. Type-only modules compile to no executable code."}}
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    for side, raw in (("backend", backend), ("frontend", summary_normalized)):
        rows = []
        if side == "backend":
            for name, value in sorted(raw["files"].items()):
                s = value["summary"]
                rows.append((name, f'{s["covered_lines"]}/{s["num_statements"]}', f'{s["covered_branches"]}/{s["num_branches"]}'))
        else:
            for name, value in sorted(raw.items()):
                if name != "total":
                    rows.append((name, f'{value["statements"]["covered"]}/{value["statements"]["total"]}', f'{value["branches"]["covered"]}/{value["branches"]["total"]}'))
        m = metrics[side]
        screenshot(side.capitalize() + " full-application coverage", rows,
                   (f'{m["statements"]:.2f}%', f'{m["branches"]:.2f}%'), OUT / f"{side}-coverage.png", commit[:12])
    print(json.dumps(metrics, indent=2))
    # Enforce each side separately; do not average away a weak backend or frontend.
    for side, metric in metrics.items():
        if metric["statements"] is None or metric["branches"] is None or metric["statements"] <= 80 or metric["branches"] <= 50:
            raise SystemExit(f"{side}: exceeds-80 statement/exceeds-50 branch target not met; evidence retained honestly")


if __name__ == "__main__":
    main()
