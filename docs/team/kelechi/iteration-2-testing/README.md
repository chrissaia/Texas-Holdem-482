# Iteration 2 local test results

These results cover the working files containing S16, S15, and S17.
All 515 backend tests and 153 frontend tests passed. Build, lint, Django system
checks, and the migration check passed. This is local testing evidence.

| Suite | Statement coverage | Branch coverage |
| --- | ---: | ---: |
| Backend | 98.47% (1,223/1,242) | 97.41% (263/270) |
| Frontend | 96.49% (771/799) | 92.43% (611/661) |

The backend text is the actual coverage.py console report. Frontend text is
extracted directly from the tool-generated HTML overview. The PNGs capture the
actual HTML reports. Python's HTML headline combines statement and branch
coverage; the table above reports them separately. Coverage includes unexecuted
runtime files and launchers; tests, generated migrations and dependencies are
excluded.

Full machine-readable output remains in the ignored local coverage folders;
we do not commit duplicate JSON/XML files here. Generated report lines do not
count as substantive application code.

Reproduce from the repository root:

```sh
docker compose exec backend pytest --cov --cov-report=term-missing --cov-report=html
docker compose exec frontend npm run test:coverage
```

Rerun team coverage after integration onto main. These checks do not establish
hosted CI success, professor acceptance, or actual poker engine integration.
Record actual hours and acceptance separately.
