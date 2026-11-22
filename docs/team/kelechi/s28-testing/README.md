# S28 coverage and test evidence

Measured source: `855d5a1` (`S28: add in-app user and table moderation dashboard`).
The manifest records the full source SHA, file hashes, generation timestamp,
test counts, commands, scope and exact coverage numerators/denominators.

| Suite | Passed | Statement coverage | Branch coverage |
| --- | ---: | ---: | ---: |
| Backend | 589 | 98.62% (1,570/1,592) | 96.89% (343/354) |
| Frontend | 199 | 95.09% (1,162/1,222) | 90.20% (921/1,021) |

Both suites had zero failures, errors and skipped tests. Build, lint, Django
system checks and migration drift checks passed. Frontend V8 totals can vary
slightly between runs; this table uses this evidence run, not an earlier result.

## View the actual coverage reports

- [Backend coverage image](backend-coverage.png)
- [Frontend coverage image](frontend-coverage.png)
- [Measurement manifest](manifest.json)


Images are generated prints of actual tool-measured per-file coverage using the
repository's `scripts/export_coverage.py`, not manually entered percentages.
The exporter enforces above 80% statement coverage and above 50% branch coverage
independently for backend and frontend. Test counts and coverage totals are
recorded in the compact manifest. The bulky JSON/XML reports remain local and
are ignored by Git; the normal HTML reports remain local as well.

The reports measure the full configured application scope, not only the new
dashboard. Tests, generated migrations and dependencies are omitted by the
existing configurations; the backend's existing scope also includes the root
`conftest.py` fixture module. Executable launchers and unexecuted runtime files
are included. Backend statement coverage is executable Python lines; frontend
statement coverage is V8/Istanbul JavaScript statements. Their denominators
should not be added together.

## Reproduce

From the repository root with Docker running:

```powershell
docker compose exec backend pytest --junitxml=test-results.xml --cov --cov-report=json --cov-report=xml --cov-report=html --cov-report=term -q
docker compose exec frontend npm run test:coverage -- --reporter=default --reporter=junit --outputFile=coverage/test-results.xml
```

HTML reports open at `backend/htmlcov/index.html` and
`frontend/coverage/index.html`. To export evidence, follow
`docs/quality/README.md`; this folder preserves the S28 snapshot separately from
the historical team evidence. The measurement used the repository exporter
through a temporary Windows/Docker path adapter, as recorded in the manifest.
The manifest lists the executed commands; raw report files are not included in
this compact evidence folder in Git.

This is local automated evidence. It does not claim hosted CI success,
browser layout verification, completion of gameplay moderation, or professor
acceptance. The student confirmed that the manual admin walkthrough worked:
search, suspend/reactivate, close/reopen and audit history. Automated visual,
responsive and cross-browser checks were not performed. Peer review remains
pending.
Existing Iteration 2 screenshots were not replaced.
