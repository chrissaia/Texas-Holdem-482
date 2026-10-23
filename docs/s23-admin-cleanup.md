# S23 administrator cleanup

Story 23 deletes selected old empty public tables through Django's existing admin.
The default inactivity threshold I set is 30 minutes, approved by Kelechi for this
implementation and pending peer review. Cleanup is manual; no scheduler runs.

## Try it

1. From this Downloads checkout, run docker compose up -d.
2. If you need a local administrator, run:
   docker compose exec backend python manage.py createsuperuser
   Choose your own local username and password.
3. Sign in at http://localhost:5173/admin/.
4. Open Tables > Poker tables, or /admin/tables/pokertable/.
5. Select the tables to inspect, choose "Clean up selected old empty public
   tables", and click Go.
6. Review the confirmation page. Cancel makes no changes. Confirm cleanup
   deletes only qualifying selected tables and reports deleted/skipped counts.
7. Refresh /lobby. Deleted tables disappear on its next fetch.

For a quick demonstration, temporarily use TABLE_CLEANUP_INACTIVITY_MINUTES=1
in your ignored local .env, then recreate the backend using:

`docker compose up -d --force-recreate backend`

Create two public tables through the app with a registered account, wait over
one minute, and create a third fresh table. Select all three in admin cleanup:
the older two should be deleted and the fresh third should survive. Change the
setting back to 30 and recreate the backend after the demo. Your local .env is
not changed by this implementation.

## Rules and permissions

- Staff administrators need tables.delete_pokertable plus normal admin page
  access; superusers already have these permissions.
- Normal users, guests, inactive users, and staff without delete permission
  cannot perform cleanup. Every browser confirmation retains Django CSRF checks.
- Only selected public tables with zero players and waiting/closed status qualify.
- last_activity_at must be strictly older than now minus the configured minutes.
  A table exactly at the cutoff survives. created_at is not the activity clock.
- Private, occupied, fresh, and playing tables survive.
- The service locks selected rows in primary-key order, then rechecks eligibility.
  Future seating/activity services must lock the same rows and write occupancy
  and activity atomically. The current app has no gameplay/seating service:
  occupancy remains server-owned and is not inferred from browser presence.
- There is no automatic cleanup and no new public cleanup API. Browsing does not
  refresh activity or cause deletion. Repeat cleanup is safe.
- Each actual deletion is recorded in Django admin LogEntry with actor, table
  ID/name, and cutoff. Logs and deletions share one transaction; failed batches
  roll back. The normal Django admin recent-actions panel shows deletion logs.
- Existing general-purpose Django admin deletion controls are separate from the
  S23 cleanup action and do not apply these eligibility rules.

## Files and tests

tables/cleanup.py has the permission guard, configuration validation,
transactional row locking, eligibility checks, audit, and deletion result.
tables/admin.py integrates the action and confirmation template.
No user/table models or migrations were changed.

Run S23 tests only:
`docker compose exec backend pytest tables/tests/test_cleanup.py -v`

Run the required backend checks and full measured coverage:
`docker compose exec backend python manage.py check`
`docker compose exec backend python manage.py makemigrations --check --dry-run`
`docker compose exec backend pytest --cov --cov-report=term-missing --cov-report=html`

Tests use a separate PostgreSQL test database. They cover eligibility and exact
cutoff boundaries, alternate/invalid configuration, selection scope, repeat runs,
admin/service permissions, CSRF, escaped names, preview and confirmation, failed
batch rollback, audit records, the real lobby/detail API, concurrent activity/
occupancy changes under actual PostgreSQL locks, and competing cleanup requests.
Professor acceptance remains pending.


## Measured verification

- Django system check passed; migration drift check reported no changes.
- All 213 backend tests passed, including 37 S23 cleanup tests.
- Configured backend coverage measured 100% statements and 100% branches:
  409 statements and 72 branches across accounts, core, and tables.
  Both tables/cleanup.py and tables/admin.py measured 100% statements/branches.
  Scope excludes tests and migrations; config/settings.py and HTML templates
  are outside the coverage source list. Coverage is not proof of acceptance.
- Actual PostgreSQL concurrency tests verified blocking on row locks, preservation
  after committed occupancy/activity/privacy/status changes, and single deletion/
  audit entry when two cleanup requests compete.
- Headless Edge used a temporary admin and five isolated local demo tables.
  Cancel preserved all tables. Confirm deleted the old empty public table and
  skipped fresh, occupied, private, and playing tables. The deleted table returned
  404 from the real detail API and disappeared from the real lobby screen.
  Verified the audit record and all four surviving records in PostgreSQL.
  No JavaScript page errors occurred. Visually inspected confirmation and lobby.
- Removed the temporary demo user, its remaining tables/logs, and temporary
  credentials after verification. Existing user data was not selected for cleanup.

For review, try the documented admin flow using your own local account and demo
tables. No implementation commits or pushes were made by the assistant.
