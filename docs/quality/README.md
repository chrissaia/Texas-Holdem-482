# Full-application test and coverage evidence

Current evidence lives in [evidence/](evidence/), including raw tool JSON/XML, per-file report images and `manifest.json`. The manifest identifies source commit, file hashes, scope, measurement time and commands. Coverage images are generated prints of the actual tool report, never manually entered percentages.

The old [S23 image](../s23-coverage/coverage.png) and JSON are retained as historical **two-file cleanup coverage**, not overall team coverage. The older setup/S10/S13/theme/profile verification notes are dated feature-stage measurements, not the current deliverable's full coverage report. Fixing this now does not make the old submission complete retroactively.

## Reproduce

Start PostgreSQL with Docker and install the pinned backend/frontend dependencies. Run from the repository root:

```bash
docker compose up -d
# Use the host virtualenv, or the equivalent commands inside the containers.
(cd backend && .venv/bin/python -m pytest --junitxml=test-results.xml --cov --cov-report=term-missing --cov-report=json --cov-report=xml --cov-report=html)
npm --prefix frontend run test:coverage -- --reporter=default --reporter=junit --outputFile=coverage/test-results.xml
backend/.venv/bin/python scripts/export_coverage.py
npm --prefix frontend run build
npm --prefix frontend run lint
backend/.venv/bin/python backend/manage.py check
backend/.venv/bin/python backend/manage.py makemigrations --check --dry-run
```

Docker equivalents for the test/export commands:

```bash
docker compose exec backend pytest --junitxml=test-results.xml --cov --cov-report=term-missing --cov-report=json --cov-report=xml --cov-report=html
docker compose exec frontend npm run test:coverage -- --reporter=default --reporter=junit --outputFile=coverage/test-results.xml
```

The backend container lacks `.git` by design, so export using the host virtualenv after container tests; export requires Git metadata. The host export command above is the supported route. A CI workflow runs the checks and uploads HTML plus raw evidence; it does not commit generated reports automatically. CI has not run on GitHub until this branch is pushed. Local results are reported separately.

## Scope and interpretation

- Backend: every Python file under `backend/`, including app code, Django configuration, URLs and launchers. Virtualenv, tests and generated migrations are excluded; no business modules are excluded for being hard to cover.
- Frontend: every executable TS/TSX file under `src/`, including `main.tsx`. Tests, test setup and declaration files are excluded. Type-only modules compile to no executable JavaScript and may not appear in V8's executable-file list.
- Both tools include unexecuted runtime files. JSON/XML show exact numerators, denominators, exclusions and missing branches. CLI bootstraps may legitimately be uncovered by unit tests.
- Each side must exceed 80% statement and 50% branch coverage independently. Equal-weight averages may be shown for the rubric, but never replace the two separate scopes or hide a weaker side.
- Python statement coverage is measured executable lines; Istanbul/V8 statement coverage uses JavaScript statements. Their denominators are different; do not sum these as one cross-language percentage.
- Tests of trusted hand/tournament hooks are service tests, not evidence of a functioning poker engine. Browser checks use the real API for implemented actions; do not substitute mocked games for acceptance.

All source should be committed before exporting release evidence. Commit the resulting reports/images afterward and retain the manifest's source SHA, which deliberately identifies the measured source tree rather than the later evidence-only commit. Do not change raw counts to meet a target. A failing gate retains truthful evidence and exits nonzero.

This report measures the identified source revision of the saia review candidate. It does not include unmerged code on other teammates' branches; rerun after integrating the final main release. Frontend export normalizes absolute source paths to repository-relative paths only; tool-generated execution counters, statement/branch maps and percentages are unchanged. JUnit XML from both frameworks is retained alongside coverage, so passing test totals are independently inspectable.

Machine-generated coverage/JUnit/PDF artifacts are required evidence, not substantive application-code contributions. Their generated line counts are not claimed as story effort, implementation LOC or extra points.
