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

Chris reported the Iteration 2 email sent time as October 27, 2026 at 7:47 PM local time. Complete actual hours, acceptance and individual reflections with the team. Current unknowns are labelled pending, not invented. Rebuilding now does not backdate the Iteration 1 report or change historical acceptance.


## Paste into Overleaf

Open `overleaf-draft.tex` and paste its contents into Overleaf's `main.tex`. It has inline measured coverage values and a built-in sequence-diagram fallback, so it compiles by itself. Missing coverage images appear as explicit upload placeholders rather than invented evidence.

For the complete version, upload `overleaf-project.zip` as a new Overleaf project. The ZIP contains `main.tex`, both measured coverage images and the full gameplay diagram PDF. Compile with pdfLaTeX. Actual work hours remain pending and must be filled from real records. Regenerate both files with `python3 scripts/package_overleaf.py` after rebuilding the source report.
