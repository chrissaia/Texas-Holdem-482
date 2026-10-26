# S5 avatars, S14 starting chips, S29 daily rewards

Implemented on `saia` at Chris's request to cover Royal's three feature stories. This records implementation and verification, not professor acceptance, story-point changes, or time spent. Royal's final shared LaTeX/PDF report still requires the team's actual results and hours.

## Run and try

From the repository root, keep your existing `.env` and start Docker Desktop:

```bash
docker compose up --build -d
docker compose exec backend python manage.py migrate
```

Rebuilding installs the pinned Pillow dependency. Migration `accounts.0003` adds the shared profile and reward fields without rewriting existing migrations.

1. Open http://localhost:5173/register and create a new account. Registration grants 1,000 virtual chips exactly once, in the same transaction as account creation.
2. Open `/settings`. Select a JPEG, PNG or WebP image and choose **Save avatar**. The saved avatar also appears in navigation and survives reload. The existing appearance picker remains available.
3. Open **Store / Get Chips** (`/rewards`). Claim 500 chips. The balance becomes 1,500, persists on reload, and another claim that UTC day cannot pay again.
4. The next claim becomes available at 00:00 UTC on the next calendar date. Eligibility is calculated using server time and checked again while the account is locked.

Existing accounts, including accounts created with `createsuperuser`, keep their current balance and receive no automatic starting-chip backfill. They can claim daily chips. Guests and signed-out visitors must sign in with a registered account to use these features.

## Rules and integration

The user approved 500 chips per UTC calendar day and JPEG/PNG/WebP uploads up to 2 MiB. Uploads must also be still images no larger than 4096×4096 pixels. The backend verifies actual image content and MIME type, applies orientation, strips metadata, and saves a cropped 256×256 WebP under a generated name. The old avatar is removed after the database commits; failed replacements preserve the old avatar.

Balances and reward timestamps are server-owned. PostgreSQL row locks prevent concurrent retries from paying twice; failed grants roll back without changing eligibility. Any future spending or reward service must lock the same account row before updating its balance. Table creation still neither seats a user nor spends chips.

See [contracts.md](contracts.md#s5s14s29-profiles-and-virtual-chips) for exact endpoints and response shapes. Profile responses are private; public table host data remains ID and username only. Uploads stay under ignored `backend/media/`; do not commit them. Docker preserves them through the backend bind mount. Django serves them only in development (`DEBUG`); production requires a configured media server or storage service.

The Account panel and rewards layout use inspected Figma frames `26:3283` and `26:3466`, with their image assets. Daily streaks, advertising, purchases, email changes, gameplay and cash-out are outside these stories. Kelechi's light/dark theme controls remain intact.

## Verification

Frontend: 94 tests passed across eight files; production build and lint passed. Tests include avatar validation and server errors, CSRF, guest access, claim errors and duplicate submission, midnight refresh, account switching, persisted balances, and theme integration.

An isolated headless Chrome walkthrough exercised real registration → 1,000 chips → avatar upload → reload → daily claim → 1,500 chips → reload. Uploaded media returned successfully. Settings and rewards were checked in dark/light themes and at 1440, 768 and 390 pixel widths, with no page errors or horizontal overflow.

Backend: 247 tests passed; configured coverage scope reached 100% statements (563/563) and 98.98% branches (97/98). Django system checks and migration consistency checks passed. Backend verification covers actual registration integration and rollback, image validation/replacement cleanup, owner isolation, CSRF, UTC date boundaries, balance bounds and real concurrent PostgreSQL grant/claim requests. Run checks locally:

```bash
docker compose exec backend python manage.py check
docker compose exec backend python manage.py makemigrations --check --dry-run
docker compose exec backend pytest --cov --cov-report=term-missing --cov-report=json
docker compose exec frontend npm run test:coverage
docker compose exec frontend npm run build
docker compose exec frontend npm run lint
```
