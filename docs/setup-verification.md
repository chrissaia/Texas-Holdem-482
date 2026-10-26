# Foundation verification - October 19, 2026

This records the initial foundation checkpoint. See [S13 verification](s13-verification.md) for the later table-creation checkpoint, and [S10 verification](s10-verification.md) for the latest combined results.

Executed locally during repository setup:

- PostgreSQL 18.6 running in Docker, with a persistent named volume on host port 5433.
- Initial Django migrations applied successfully to PostgreSQL, including `accounts.User`.
- `manage.py check`: no issues.
- `manage.py makemigrations --check --dry-run`: no changes detected.
- Backend pytest: 4 passed using a separate PostgreSQL test database.
- Backend coverage: 21 measured statements, all executed. This narrow foundation currently contains no measured branch points; it provides no evidence of Sprint 1 branch-coverage completion.
- Frontend `npm run build` and `npm run lint`: passed.
- Frontend `npm test`: no test files; exits with code 1. No frontend feature coverage is claimed.
- Full Docker Compose stack built and started successfully: frontend, backend, and healthy PostgreSQL.
- Frontend container production build passed.
- Frontend HTTP page responded successfully, and `/api/health/` through the Vite proxy returned HTTP 200 with both status and database set to `ok`.

The root `.env`, virtual environments, node_modules, and coverage output are ignored by Git. This records infrastructure checks only; S13 and S10 are not implemented yet.
