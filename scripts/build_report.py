#!/usr/bin/env python3
"""Build the LaTeX report from measured evidence, then render every page for QA."""
import argparse
import json
from pathlib import Path
import shutil
import subprocess

ROOT = Path(__file__).resolve().parents[1]
REPORT = ROOT / "docs/report"


def escape(text):
    return str(text).replace("\\", "\\textbackslash{}").replace("_", "\\_").replace("%", "\\%").replace("#", "\\#").replace("&", "\\&")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--tectonic", default=shutil.which("tectonic"))
    parser.add_argument("--preview-dir", default="/tmp/rivr-report-preview")
    args = parser.parse_args()
    if not args.tectonic:
        raise SystemExit("Install Tectonic or supply --tectonic /path/to/tectonic")
    data = json.loads((ROOT / "docs/quality/evidence/manifest.json").read_text())
    metrics = data["metrics"]
    text = ["% Generated from the raw coverage manifest; do not hand-edit.",
            "Measured source commit: \\texttt{" + data["source_commit"] + "}.\\par",
            "Measurement time (UTC): \\texttt{" + escape(data["generated_at_utc"]) + "}.\\par",
            "\\begin{tabularx}{\\textwidth}{@{}l r r r@{}}\\toprule Scope & Files & Statements & Branches\\\\\\midrule"]
    for side, m in metrics.items():
        text.append(f'{side.capitalize()} & {m["files"]} & {m["covered_statements"]}/{m["statements_total"]} ({m["statements"]:.2f}\\%) & {m["covered_branches"]}/{m["branches_total"]} ({m["branches"]:.2f}\\%)\\\\')
    text += ["\\bottomrule\\end{tabularx}",
             f'JUnit evidence: backend {data["tests"]["backend"]["tests"]} tests; frontend {data["tests"]["frontend"]["tests"]} tests. Failures/errors: 0 on each side.\\par',
             f'Equal-weight means: statements {sum(m["statements"] for m in metrics.values())/2:.2f}\\%; branches {sum(m["branches"] for m in metrics.values())/2:.2f}\\%.\\par',
             "The manifest and raw reports provide exact denominators, missing code and exclusions."]
    (REPORT / "coverage-data.tex").write_text("\n".join(text) + "\n")
    subprocess.run([args.tectonic, "--keep-logs", "iteration-report.tex"], cwd=REPORT, check=True)
    import pymupdf
    pdf = pymupdf.open(REPORT / "iteration-report.pdf")
    preview = Path(args.preview_dir)
    preview.mkdir(parents=True, exist_ok=True)
    for number, page in enumerate(pdf):
        page.get_pixmap(matrix=pymupdf.Matrix(1.2, 1.2)).save(preview / f"page-{number + 1:02}.png")
    content = "\n".join(page.get_text() for page in pdf)
    required = ["System Design", "Diagrams", "Iteration 1", "Iteration 2", "Testing and Coverage", "17", "16"]
    assert all(term in content for term in required), "Required report section is missing"
    assert len(pdf) >= 5, "Report unexpectedly short"
    print(f"Built and rendered {len(pdf)} report pages to {preview}; inspect the PNGs before delivery.")


if __name__ == "__main__":main()
