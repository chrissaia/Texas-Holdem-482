# RIVR teammate instructions

Use this guide to set up your machine, work on your own branch, and push changes for review. Run commands from the repository root unless a step says otherwise.

See [the agent team plan](docs/agent-team.md) for assistant specialties, story mapping, and coordination boundaries.

For reusable assistant instructions, choose your role from [.agents/README.md](.agents/README.md) and include its file path in your prompt. Each teammate has a dedicated brief.

## 1. Get the project

Install Git and Docker Desktop, then start Docker Desktop. The Docker workflow runs PostgreSQL, Python, and Node for you; separate installations are optional.

If you have not cloned the repository:

```bash
git clone https://github.com/chrissaia/Texas-Holdem-482.git
cd Texas-Holdem-482
```

If you already have a clone, open it in VS Code. Run `git status` and commit your current work on its feature branch before switching branches.

## 2. Create your feature branch

Start from an up-to-date `main`:

```bash
git switch main
git pull --ff-only origin main
git switch -c feature/S2-registration
```

Replace `feature/S2-registration` with your story and feature. Examples:

| Teammate | Stories | Example branch |
| --- | --- | --- |
| Chris | S13 public tables, S10 browsing | `feature/S13-public-tables` |
| Finn | S2 registration, S1 login/logout, S4 guests | `feature/S2-registration` |
| Kelechi | S23 admin cleanup, S35 themes | `feature/S35-themes` |
| Royal | S5 avatars, S14 starting chips, S29 daily chips | `feature/S5-avatar-upload` |

Create a separate branch for each logical feature. To return to a branch you already created, use `git switch feature/S2-registration` without `-c`.

## 3. Configure your local environment

For first-time setup only:

```bash
cp .env.example .env
```

Keep an existing `.env`; do not overwrite it when pulling updates. Edit your new `.env` and replace `DJANGO_SECRET_KEY` and `POSTGRES_PASSWORD` with independent random values. A password manager can generate them. If Python is installed, you can also generate each value with:

```bash
python3 -c 'import secrets; print(secrets.token_urlsafe(48))'
```

The root `.env` is ignored by Git and stays on your machine. Commit changes to `.env.example` when introducing a configuration variable, using placeholders rather than real credentials.

## 4. Start and verify the application

```bash
docker compose up --build -d
docker compose ps
docker compose logs -f backend
```

The first build downloads dependencies and may take several minutes. Press Ctrl+C to leave the log view; the containers keep running.

- Frontend: http://localhost:5173
- Database readiness through the frontend proxy: http://localhost:5173/api/health/
- Backend directly: http://localhost:8000/api/health/
- PostgreSQL from your machine: `127.0.0.1:5433`, using your `.env` credentials.

The health endpoint should return `{"status":"ok","database":"ok"}`. The frontend includes S10 browsing at `/lobby` and S13 public-table creation at `/tables/create`; see [the S13 guide](docs/s13-public-tables.md) for local sign-in and a walkthrough. Each teammate has a separate local database; your database records are not shared through Git.

Useful commands:

```bash
docker compose logs -f frontend
docker compose logs -f db
docker compose stop
docker compose up -d
```

Database data persists when containers stop. `docker compose down -v` deletes the project's local database volume; avoid it during normal development. PostgreSQL reads its initial password when the volume is created, so changing `.env` later does not update the existing database password.

If a native Vite or Django server already occupies ports 5173 or 8000, stop that server before running the corresponding container. For the native-development alternative and port configuration, see [README.md](README.md).

## 5. Work in the right files

| Location | Purpose |
| --- | --- |
| `frontend/src/` | React components, screens, and styles |
| `backend/accounts/` | Shared user model and account functionality |
| `backend/core/` | Shared API infrastructure |
| `backend/config/` | Django settings and routing |
| `backend/requirements.txt` | Pinned Python dependencies |
| `docs/contracts.md` | Shared interfaces and ownership |
| `docs/reference/` | System design PDF and user stories workbook |

Read [docs/contracts.md](docs/contracts.md) before modifying shared models or authentication. Coordinate user-model changes with Finn and table-model changes with Chris. Keep your own feature code, tests, and documentation in your commits.

For a model change, generate and apply a migration, replacing `accounts` with the relevant app:

```bash
docker compose exec backend python manage.py makemigrations accounts
docker compose exec backend python manage.py migrate
```

Commit the generated migration with the model change. Do not delete or rewrite migrations that teammates have already applied. New backend apps must be registered in Django settings; add their tests and source to `backend/pytest.ini` and `backend/.coveragerc` as appropriate.

Frontend source changes reload automatically. When adding a frontend dependency, install it through the container and commit both `frontend/package.json` and `frontend/package-lock.json`. After pulling another teammate's frontend dependency changes:

```bash
docker compose exec frontend npm ci
```

After changing Python requirements, rebuild and restart the backend:

```bash
docker compose up --build -d backend
```

## 6. Run checks before pushing

```bash
docker compose exec backend python manage.py check
docker compose exec backend python manage.py makemigrations --check --dry-run
docker compose exec backend pytest --cov --cov-report=term-missing --cov-report=html
docker compose exec frontend npm run build
docker compose exec frontend npm run lint
```

When working on frontend features, add tests and run:

```bash
docker compose exec frontend npm test
docker compose exec frontend npm run test:coverage
```

Frontend tests now cover S13 creation and S10 browsing, including filters, sorting, pagination, API communication, validation, and error states. Backend tests use a separate PostgreSQL test database. Write tests for your feature's successful behavior, invalid input, and permission checks.

The sprint requires above 80% code coverage and above 50% branch coverage; aim for 85% and 55%. Report measured results and scope. Local coverage reports are ignored; coordinate the final committed coverage evidence with Finn.

## 7. Commit and push your branch

Check your branch and review what changed:

```bash
git branch --show-current
git status
git diff
```

Stage only the files for your feature. For example, if you changed account models and added a migration:

```bash
git add backend/accounts/models.py backend/accounts/migrations/
git diff --cached
git commit -m "S2: add registration model validation"
git push -u origin feature/S2-registration
```

Replace the paths, story, message, and branch with your actual work. Include the task and real GitHub issue number in the commit message when available, for example `S2: validate registration email (closes #42)` only if issue 42 is the actual issue you are completing. Stage relevant tests and documentation too.

The first push uses `-u` to connect your local branch to its remote branch. For subsequent commits on that branch:

```bash
git push
```

GitHub may prompt you to authenticate using your configured Git credential manager or SSH setup. Do not put tokens or passwords in repository files or remote URLs.

Never commit `.env`, passwords, tokens, `.venv/`, `node_modules/`, database files, or uploaded images. If `git status` shows unexpected files, review them before staging. Push your feature branch rather than pushing directly to `main`.

## 8. Open a pull request

On GitHub, open the pushed branch and select **Compare & pull request**. Set the base to `main` and the compare branch to your feature branch. Include:

- Story ID and actual linked issue/task.
- What changed and how to try it.
- Tests run and their actual results.
- Any incomplete behavior or integration dependencies.

Request the agreed peer review: Chris and Kelechi review each other; Finn and Royal review each other. Fix review feedback on the same branch, commit, and `git push` again; the pull request updates automatically. Merge after review and relevant checks pass.

## 9. Keep your branch current

With your work committed on your feature branch:

```bash
git fetch origin
git merge origin/main
```

If there are conflicts, resolve the marked sections in VS Code, stage the resolved files, and complete the merge with `git commit`. Run checks again, then `git push`. If you are unsure how to resolve a conflict, ask its author before changing shared behavior. Do not force-push a shared branch.

After your pull request is merged and you are ready for the next story:

```bash
git switch main
git pull --ff-only origin main
git switch -c feature/S1-login-logout
```

Use your next story's branch name. Keep your story status and time log current: internal completion moves work to Acceptance Test; only professor acceptance moves a story to Done.
