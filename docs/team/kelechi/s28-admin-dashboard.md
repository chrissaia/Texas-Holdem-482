# S28 - In-app administrator dashboard

## Scope and ownership

Kelechi's Iteration 3 moderation milestone, on `feature/S28-admin-dashboard`.
The workbook story is S28, "manage users and tables", row 30 of
`docs/iterations_and_LaTeX/User_Stories.xlsx`. It lists 13 points; the student
requested an 8-point slice. This implementation does not change that estimate,
assert professor acceptance, or claim the whole gameplay-management story.
Actual work hours, planning email, issue number and professor-approved estimate
must be recorded by the team rather than inferred.

Basic Django user/table editing and S23 cleanup predate this milestone and are
not counted as new behavior here. The new interface lives inside RIVR at
`/moderation`, using existing shell, fonts and light/dark tokens. No dedicated
admin Figma reference was available in the repository; this is an adaptation of
the existing app rather than a claim of matching an inspected admin frame.

## Behavior

- Search and paginate registered users by username and active/suspended status.
- Search public/private tables by name or host; filter waiting/playing/closed.
- Suspend/reactivate regular accounts with an explicit confirmation and reason.
- Close/reopen empty tables outside play with confirmation and reason.
- Review the newest moderation changes, with actor, target, timestamp, reason,
  action and before/after state. Search targets or administrator usernames.
- Staff-only navigation uses the current viewer's identity response. Direct
  navigation and every API independently enforce server-side permissions.

Suspension uses existing `User.is_active`. It denies subsequent authenticated
requests and login, retains records and funds, and does not delete sessions.
Reactivation permits login again; an existing still-valid cookie can become
usable again. This is a reversible suspension, not a permanent session purge.
Self, staff/superuser accounts and accounts with a funded seat are protected.
Suspending a host does not delete their tables or change other players' funds.

Close/reopen locks the table using seating's existing lock order. Both the
occupancy counter and actual seats are checked; a stale zero counter cannot
bypass protection. Playing, occupied and funded tables are rejected. Closing
removes a table from the normal lobby and blocks joins; reopening returns it to
waiting. No player is kicked and no wallet/stack is edited.

Actions check the expected state and return 409 on conflicts or stale requests.
A repeated old request cannot create a duplicate audit entry. Mutations and
Django `admin.LogEntry` writes are atomic: an audit failure rolls back the change.
Audit rows are read-only through this dashboard. Existing trusted Django admin
and direct database access are separate administrative surfaces.

## Access and API

All routes are under `/api/moderation/`, require an active staff session, and
return private/no-store responses. No passwords, emails or account wallets are
included. Private table names are visible only to appropriately authorized staff.

| Route | Method | Permission / purpose |
| --- | --- | --- |
| `/` | GET | Staff context, capabilities, CSRF token |
| `/users/` | GET | `accounts.view_user` |
| `/users/<id>/action/` | POST | `accounts.view_user` + `accounts.change_user` |
| `/tables/` | GET | `tables.view_pokertable` |
| `/tables/<id>/action/` | POST | `tables.view_pokertable` + `tables.change_pokertable` |
| `/audit/` | GET | `admin.view_logentry`; S28 entries only |

Superusers have these permissions automatically. Ordinary staff require the
listed model permissions to be deliberately assigned by an existing administrator.
This feature neither creates administrators nor grants privileges.

Lists accept only `q` (up to 80 characters), `state` and `page` (20 records per
page). Unknown/repeated parameters and invalid filters are rejected. Writes
require CSRF and exactly `{action, expected, reason}`. Reasons are trimmed,
3-300 characters. User actions are `suspend`/`reactivate`, expected states
`active`/`suspended`. Table actions are `close`/`reopen`, expected states are
the current table status. There are no delete, promote, balance-edit, audit-write
or forced in-game action endpoints.

The only extension to the existing identity contract is a top-level `is_admin`
boolean in `GET /api/tables/creation-context/`, for the current viewer only.
Public table host objects remain `{id, username}`. There is no model migration,
new dependency, poker engine or AFK implementation.

## Demo

1. Sign in using an existing local superuser at `/login` (not a normal player).
2. Open Administration, or visit `http://localhost:5173/moderation`.
3. Search a designated, unseated regular demo player. Suspend with a reason.
   Verify that player's login/API access is denied, then reactivate them.
4. Find a designated empty waiting table. Close it, check it disappears from
   the public lobby, then reopen it and refresh the lobby.
5. Open Audit trail and show the real recorded actions and reasons.
6. Show protected admin/occupied/playing records; the backend rechecks even if
   a client bypasses the disabled UI. Sign in as an ordinary player to show denial.

Use designated demo records; no production data is required. If no local admin
exists, follow the existing setup guide's interactive `createsuperuser` workflow.
No credentials or elevated accounts are automatically created by this feature.

## Checks

```powershell
docker compose exec backend pytest core/tests/test_moderation.py -v
docker compose exec frontend npm test -- --run src/features/moderation/AdminDashboard.test.tsx
docker compose exec backend pytest --cov --cov-report=json --cov-report=html
docker compose exec frontend npm run test:coverage
docker compose exec backend python manage.py check
docker compose exec backend python manage.py makemigrations --check --dry-run
docker compose exec frontend npm run build
docker compose exec frontend npm run lint
```

Tests cover real session/CSRF denial, permissions, protected targets, stale
requests, field privacy, invalid inputs, atomic audit rollback and a PostgreSQL
join/close race. UI tests cover confirmation, cancellation, search, errors,
expired-session clearing, stale responses and escaped audit content.
Automated DOM tests do not prove visual/responsive browser compatibility.
Browser automation was unavailable during this milestone. The student later
confirmed a successful manual admin walkthrough: searching records, suspending
and reactivating a demo user, closing and reopening an empty table, and checking
the audit trail. This is student-reported functional verification, not an
automated visual/responsive or cross-browser check. Peer review, hosted CI and
professor acceptance remain pending.

### Local results (November 21, 2026)

[S28 coverage images and measurement summary](s28-testing/README.md)
identify measured source commit `855d5a1`. Bulky raw reports remain local;
images, a compact manifest and testing notes provide repository evidence.

- Final full backend suite: 589 passed, including 32 focused moderation checks.
- Final full frontend suite: 199 passed, including 12 dashboard/navigation tests.
- Backend full-scope coverage: 98.62% statements, 96.89% branches.
- Frontend full-scope coverage (fresh evidence run): 95.09% statements, 90.20% branches.
- Dashboard component: 86.40% statements, 86.15% branches; admin link: 100% each.
- Build, lint, Django system check, migration drift and whitespace checks passed.
- Live server returned 200 for `/moderation`, served the new dashboard source,
  and returned 403 for anonymous `/api/moderation/` access. An existing active
  local staff account was available; no accounts or privileges were created.

These measurements describe application source commit `855d5a1`, not hosted CI
or proof of browser layout. Coverage images and a compact manifest are in
`s28-testing/`; bulky raw reports remain local and are ignored by Git. The tracked `backend/coverage.json` was also refreshed. Existing
Iteration 2 screenshots were not replaced. After changes to application source,
regenerate evidence using the repository's quality workflow.
