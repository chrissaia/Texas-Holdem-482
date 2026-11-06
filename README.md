# RIVR - Texas Hold’em

CS 482, Team 23: Chris, Finn, Kelechi, Royal. React/TypeScript + Django REST Framework + PostgreSQL. The shared foundation, S13 public-table creation, and S10 public lobby are implemented. Browse at `/lobby`; see [the lobby guide](docs/team/chris/s10-browse-public-tables.md). See [the S13 guide](docs/team/chris/s13-make-a-public-table.md) for the working flow and local sign-in instructions.

Avatars, 1,000 starting chips on registration, and daily 500-chip rewards are available at `/settings` and `/rewards`; see [the profile and rewards guide](docs/team/royal/profile-rewards.md).

The twenty-four hidden achievements and XP collection are available at `/achievements`; see [the XP guide](docs/team/chris/s32-earn-xp-and-achievements.md) for implemented triggers and future gameplay/social hooks.

[Requirements audit](docs/quality/requirements-audit.md) · [Full coverage evidence](docs/quality/README.md) · [Demo runbook](docs/quality/demo-runbook.md)

The S18 all-time XP leaderboard is at `/leaderboard`; see [its guide](docs/team/chris/s18-see-the-leaderboard.md). Both iteration plans and branch contribution evidence are documented without claiming instructor acceptance.

Teammates: start with [instructions.md](instructions.md) for setup, feature branches, commits, pushing, and pull requests.

## Repository

```text
frontend/                 React, TypeScript, Vite, Vitest
backend/                  Django, REST Framework, PostgreSQL driver, pytest
  config/                 Settings, routing, WSGI/ASGI entry points
  accounts/               Minimal custom Django user and initial migration
  profiles/               Avatar validation, atomic chip rewards, private API and tests
  core/                   Database readiness endpoint and tests
  tables/                 S13 settings, API, constraints, tests, migrations
docs/architecture/contracts.md         Shared interfaces and teammate boundaries
docs/reference/           System design PDF and user stories workbook
compose.yaml              Local PostgreSQL, backend, frontend services
.env.example              Configuration template (no real credentials)
```

## Prerequisites

Docker Desktop with Compose is sufficient for the full container workflow. For native application development, also install Python 3.13 and Node 22 (22.12 or newer) with npm. PostgreSQL runs in Docker; no host PostgreSQL install is required. This Compose setup uses development servers and is for local development.

## Quick start: everything in Docker

From the repository root:

```bash
cp .env.example .env
```

Edit `.env`: replace `DJANGO_SECRET_KEY` and `POSTGRES_PASSWORD` with independent random values. To generate a value locally, run `python3 -c 'import secrets; print(secrets.token_urlsafe(48))'`. Never commit `.env`. If `.env` already exists, keep it instead of overwriting it. The initial workspace setup generated these values automatically.

Start Docker Desktop, then:

```bash
docker compose up --build -d
docker compose logs -f backend
```

Open http://localhost:5173. Readiness: http://localhost:5173/api/health/ should return `{"status":"ok","database":"ok"}`. Backend direct access: http://localhost:8000/api/health/.

PostgreSQL is exposed only on `127.0.0.1:5433`; its data persists in a Docker volume. Django waits for database readiness, applies committed migrations, then starts. Frontend and backend source edits reload automatically.

```bash
docker compose ps
docker compose exec db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
docker compose stop
```

`docker compose down` removes containers but retains database data. Do not use `down -v` unless you intend to delete local database data. PostgreSQL initializes credentials only when its data volume is empty; changing `.env` later does not change an existing database password.

After frontend dependency changes, run `docker compose exec frontend npm ci`; the container has a separate dependency volume.

## Alternative: native frontend and backend, Docker database

Do not run native servers and the corresponding Compose services on the same ports. If the full stack is running, first run `docker compose stop frontend backend`.

From the repository root, with `.env` configured:

```bash
docker compose up -d --wait db
python3 -m venv backend/.venv
source backend/.venv/bin/activate
pip install -r backend/requirements.txt
python backend/manage.py migrate
python backend/manage.py check
python backend/manage.py runserver
```

In another terminal, from the repository root:

```bash
cd frontend
npm ci
npm run dev
```

The backend loads the root `.env` automatically. Vite proxies `/api`, `/admin`, and `/static` to Django, so browser requests use one origin without a CORS dependency. `frontend/.env.example` documents the optional proxy target override. Never put passwords or secret keys in `VITE_*` variables: those are exposed to the browser.

If port 5433 is occupied, change `POSTGRES_PORT` in `.env` and recreate the database container with `docker compose up -d db`. Native Django reads the same port; container Django always uses `db:5432`.

## Tests and checks

Container workflow:

```bash
docker compose exec backend python manage.py check
docker compose exec backend python manage.py makemigrations --check --dry-run
docker compose exec backend pytest --cov --cov-report=term-missing --cov-report=html
docker compose exec frontend npm run build
docker compose exec frontend npm run lint
docker compose exec frontend npm test
docker compose exec frontend npm run test:coverage
```

Native workflow:

```bash
cd backend
source .venv/bin/activate
pytest --cov --cov-report=term-missing --cov-report=html
```

From `frontend/`, use `npm run build`, `npm run lint`, `npm test`, and `npm run test:coverage`. Frontend tests cover creation and lobby behavior, filters/sorting/pagination, saved details, session failures, and API errors. Backend tests use a real, separate PostgreSQL test database (`test_rivr`), created and removed by pytest-django. The local database user has database-creation privileges; do not point tests at shared or production databases.

Backend HTML coverage: `backend/htmlcov/index.html`; frontend coverage: `frontend/coverage/index.html`. Current coverage includes all implemented runtime application code, including configuration and launchers; see `docs/quality/README.md` for exact scope and exclusions. It does not establish coverage of unimplemented stories. The sprint target is above 80% statement and above 50% branch coverage, with buffers of 85% and 55%; foundation results do not establish feature coverage. Keep pytest discovery and coverage inventory current as apps are added.

## Accounts and migrations

`accounts.User` extends Django’s `AbstractUser` before the first migration. Finn owns final registration/login/guest behavior. No temporary authentication bypass exists. For local administrative access, run:

```bash
docker compose exec backend python manage.py createsuperuser
```

Use `/login`, `/register` and `/guest` for the implemented account flows; `/admin/` remains Django's staff administration interface. Commit model migrations alongside their model changes, coordinate migration order, and refer to users using `settings.AUTH_USER_MODEL` or `get_user_model()`.

## Team workflow

Keep `main` stable. Create feature branches using your name, e.g. `git switch -c saia`. Make small commits referencing the story and actual GitHub issue number when available; never invent issue numbers or teammates’ authorship. Run relevant tests and request peer review before merging.

Commit source, migrations, lockfiles, and configuration examples. Do not commit `.env`, virtual environments, dependencies, uploaded media, or local coverage output. Finn will commit the final sprint coverage evidence deliberately under `docs/`.

Read [shared contracts](docs/architecture/contracts.md), the [system design](docs/reference/CS495_Project_System_Design.pdf), and the [stories workbook](docs/reference/User_Stories.xlsx) before extending interfaces.

## Documentation

[Documentation index](docs/README.md) · [Assigned user stories](docs/stories.md). Story guides are grouped by planned teammate ownership.
