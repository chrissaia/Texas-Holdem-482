# S30 test and coverage evidence

Local S30 working tree on `feature/S30-rewarded-ads`, based on `d1d3ad4`.

| Suite | Passed | Statement coverage | Branch coverage |
| --- | ---: | ---: | ---: |
| Backend | 581 | 98.64% (1,674/1,697) | 96.47% (355/368) |
| Frontend | 200 | 94.72% (1,219/1,287) | 89.50% (972/1,086) |

Both suites had zero failures, errors, and skips. The [backend coverage
image](backend-coverage.png) and [frontend coverage image](frontend-coverage.png)
show the full configured scope and selected S30 files. The images use counts
read from the coverage.py and Vitest reports. Coverage tools round values
differently in their console summaries. Build, lint, Django system checks, and
migration drift checks passed.

The backend suite includes 24 S30 cases. They cover admin upload and
replacement, catalog publication, cap configuration, session and CSRF protections,
stale edits, daily rollover, expired or replaced ads, wallet bounds, and concurrent
claims. Frontend cases exercise the admin editor, account navigation permissions,
automatic ad discovery, the opt-in viewer, dismissal without a claim, and hidden
Lobby offers for guests and accounts at their limit. The live app served both
placements and denied anonymous management API access.
The story owner reported successfully trying the updated ad flow in the app.
The specific media formats and browser/device combinations used for that check
were not recorded. See the [demo guide](../s30-rewarded-ads.md).

Run from the repository root with Docker running:

```powershell
docker compose exec backend pytest --cov --cov-report=json:/tmp/s30-coverage.json --cov-report=html --junitxml=/tmp/s30-tests.xml -q
docker compose exec frontend npm run test:coverage -- --reporter=junit --outputFile=coverage/s30-tests.xml
```

Open `backend/htmlcov/index.html` and `frontend/coverage/index.html` for
per-file drilldown. Raw generated files stay in local ignored locations.
