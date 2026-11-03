# LaTeX iteration report

`iteration-report.tex` is the main editable report source. It contains the System Design / Diagrams subsection, both iteration planning/execution chapters, the main planning table, testing images/discussion and retrospective. `coverage-data.tex` is generated from the full-coverage manifest; do not type percentages by hand. `iteration-report.pdf` is compiled from these sources using Tectonic, not a separately written PDF.

Build after running the quality checks/export:

```bash
python3 -m venv .venv-docs
.venv-docs/bin/pip install -r docs/requirements.txt
.venv-docs/bin/python scripts/render_gameplay_diagram.py
# Install Tectonic, or supply its absolute executable path.
.venv-docs/bin/python scripts/build_report.py --tectonic /path/to/tectonic
```

Every report page is rendered to `/tmp/rivr-report-preview/` for visual inspection. Check text/tables, per-file coverage images, diagram readability and page boundaries before committing the PDF. The `build_report.py` text checks are not a substitute for visual QA.

Complete the actual-hour, sent-email timestamp, acceptance and individual-reflection records with the team. Current unknowns are labelled pending, not invented. Rebuilding now does not backdate the Iteration 1 report or change historical acceptance.
