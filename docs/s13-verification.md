# S13 verification - October 19, 2026

This is the earlier S13 checkpoint. See [S10 verification](s10-verification.md) for the latest combined regression results.

## Executed checks

- Django `check`: no issues.
- `makemigrations --check --dry-run`: no changes detected after the source migration was generated and applied locally.
- PostgreSQL-backed pytest: **76 passed**. Separate test database; no SQLite substitution.
- Frontend TypeScript/Vite build: passed.
- Frontend oxlint: passed without warnings.
- Frontend Vitest: **26 passed** across three test files.
- `git diff --check`: passed.

## Measured coverage

| Scope | Statements | Branches |
| --- | --- | --- |
| Backend configured application modules | 155/155 (100.00%) | 20/20 (100.00%) |
| Frontend configured application source | 131/132 (99.24%) | 112/121 (92.56%) |

Backend scope: accounts, core, tables; excludes migrations and tests. Frontend scope: `src/**/*.ts` and `src/**/*.tsx`; excludes test files, test setup, and `main.tsx` bootstrap. No averaging of these different tools' percentages is claimed. Current measured scopes exceed the sprint thresholds; unimplemented features are not covered by these results.

Local reports: `backend/htmlcov/index.html`, `backend/coverage.json`, `frontend/coverage/index.html`, `frontend/coverage/coverage-summary.json`. Generated reports remain ignored; Finn can regenerate and preserve the final sprint evidence as agreed.

## Real browser and database integration

Used isolated headless Chrome profiles because no interactive Browser connection was available. No existing browser session was read. Checks used normal Django login and the running Docker frontend/API/PostgreSQL services, with a temporary local staff account:

1. Anonymous form disables creation and exposes sign-in.
2. Real Django login returns to the form and establishes the session.
3. Blank name and inconsistent blinds show validation errors.
4. Valid form submission sends the session cookie and CSRF token, receives HTTP 201, and displays success.
5. Saved settings load by public detail ID and survive a browser reload.
6. A separate phone touch flow creates a 9-seat table successfully.
7. Desktop/tablet/phone widths 1440, 768, and 390 have no horizontal overflow. Desktop and phone screenshots were visually inspected.
8. All 19 visible design image instances loaded from local assets and retained their SVG root dimensions. No runtime page errors were observed in the desktop flow.

The temporary browser-test tables/account were removed after verification. No persistent demo identity or authentication bypass was added. Browser checks cover Chromium only, not a complete cross-browser compatibility matrix.

## Completion boundaries

S13 is implemented for human review and demonstration; professor acceptance is pending. S10 list/filter/sort work, Finn's public auth UI, Kelechi's saved themes/admin cleanup, and Royal's chip/avatar features are not claimed complete. Private invitations, bots, joining, and gameplay remain outside this change. The approved creation behavior stores settings without moving chips or seating the host.

Changes remain local on `feature/S13-public-tables`; no commit, push, or pull request was created automatically.
