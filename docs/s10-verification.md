# S10 verification - October 19, 2026

## Executed checks

- Django configuration check: no issues.
- Migration consistency check: no changes detected. No schema migration was needed.
- PostgreSQL-backed pytest: **114 passed**, including S13 regression tests and 38 new lobby cases.
- Frontend TypeScript/Vite build: passed.
- Frontend oxlint: passed without warnings.
- Frontend Vitest: **39 passed** across four files, including 13 new lobby cases and existing S13 regression tests.
- `git diff --check`: passed.

## Measured coverage

| Configured scope | Statements | Branches |
| --- | --- | --- |
| Backend accounts/core/tables | 213/213 (100.00%) | 40/40 (100.00%) |
| Frontend application source | 194/197 (98.47%) | 176/191 (92.14%) |

Migrations and tests are excluded; frontend `main.tsx` bootstrap is excluded. Results exceed the sprint targets within these implemented scopes. They do not establish coverage of teammates' future features, and percentages from different tools are not averaged here.

Backend HTML/JSON reports are under `backend/htmlcov/` and `backend/coverage.json`; frontend reports are under `frontend/coverage/`. The already tracked backend JSON report was regenerated; other local generated outputs remain ignored.

## API evidence

Tests cover public-only active retrieval; no private account data; global versus filtered totals; name/host search; combined filters; all supported sorts with stable ties; real occupancy; bounded pagination; invalid/repeated/unknown query errors; empty results; three-query anonymous listing without per-host queries; and actual creation appearing in public results. Reads preserve activity timestamps.

## Browser evidence

Used isolated headless Chrome profiles with the running Docker React/Django/PostgreSQL services. Temporary labeled tables and a temporary staff account exercised:

1. Anonymous browsing of actual database records, excluding private and closed entries.
2. Next/previous pages, name sorting, search, buy-in filtering and reset, and available-seat filtering.
3. Public saved-detail links and return navigation.
4. Normal Django login followed by real form creation, the **See it in the lobby** link, and reload persistence.
5. Desktop/tablet/phone widths 1440/768/390 without page-wide horizontal overflow. The data table scrolls inside its own region on smaller viewports.
6. Phone header navigation and access to the table's action column after horizontal scrolling.
7. All 20 visible desktop design image instances loaded locally and kept their SVG root geometry; no runtime page errors occurred in the full flow.

Screenshots were visually inspected. A tablet overflow caused by absolutely positioned screen-reader text and a stretched notice icon were found and corrected, then the real browser flow was rerun successfully.

All 12 temporary records and their temporary host were removed after verification. No demo rows were left in the application. Chromium checks do not constitute a full multi-browser compatibility matrix.

## Handoff

Work remains local on `saia`, uncommitted and unpushed. S10 is ready for human review; professor acceptance is pending. Filters are tracked separately as S11 in the workbook even though requested technical behavior is implemented. Joining, friends, bots, reward services, saved themes, and cleanup were not implemented by this change.
