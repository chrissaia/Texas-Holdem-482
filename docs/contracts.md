# Shared foundation and handoff

## Implemented interfaces

- User: `accounts.User`, initially Django `AbstractUser` without extra fields. Its primary key is an integer (`BigAutoField`). Finn owns account validation, uniqueness policies, registration, login/logout, guest representation, and the eventual session endpoint. Email is not uniquely constrained in this foundation; Finn must decide and implement that policy before registration.
- User references: foreign keys use `settings.AUTH_USER_MODEL`; runtime code uses `get_user_model()`. Passwords use Django’s hashing APIs.
- Authentication: DRF session authentication; endpoints require authenticated users by default. The readiness endpoint explicitly permits anonymous GET requests. Cookie-authenticated writes must retain CSRF protection. No client-supplied host ID or development identity headers will be trusted.
- `GET /api/health/`: HTTP 200 with `{"status":"ok","database":"ok"}` after a PostgreSQL query; HTTP 503 with `{"status":"unavailable","database":"unavailable"}` when the database is inaccessible. It does not expose connection errors or credentials.
- Datetimes: timezone-aware UTC. Database credentials and Django configuration come from the root `.env`. Vite uses same-origin relative `/api/` requests through its development proxy.

## S13 public-table creation

Chris owns `backend/tables/` and the table feature UI. The student approved the following rules: names trimmed to 1–80 characters; capacity 2/4/6/8/9; positive whole-chip amounts; big blind exactly twice small blind; buy-in at least big blind; minimum balance at least buy-in. Duplicate names are allowed and IDs distinguish tables. Amounts are limited to 2,147,483,647 for PostgreSQL integer storage; the small blind is at most 1,073,741,823 so its double fits.

Implemented endpoints:

- `GET /api/tables/creation-context/`: public, returns `{host: {id, username} | null, csrf_token}` and sets the CSRF cookie for the form. This small form-specific interface can later consume Finn's session interface; it does not implement login or registration.
- `POST /api/tables/`: requires an active registered user's Django session and CSRF token. JSON fields: `name`, `max_players`, `buy_in`, `minimum_balance`, `small_blind`, `big_blind`. Returns HTTP 201 with the saved table. Missing/invalid/unknown/server-controlled fields return HTTP 400 with field-keyed error arrays. Session/CSRF permission failures return HTTP 403.
- `GET /api/tables/<id>/`: public read-back of a public table. Missing/private tables return HTTP 404. There is no listing/filtering API yet; S10 remains to be implemented.

Server-controlled output fields: `id`, `host` (only ID and username), `is_public`, `player_count`, `status`, `created_at`, and `last_activity_at`. Creation sets public visibility, zero occupancy, waiting status, and UTC timestamps. It does not seat the host, debit chips, start gameplay, or create bots/invitations. All writes use the authenticated host; client-supplied host/occupancy/status fields are rejected.

User references use `settings.AUTH_USER_MODEL` with `PROTECT` on deletion to prevent an accidental account delete from removing tables. Finn must coordinate account deletion behavior with Chris if adding it later. Registered accounts currently mean active Django users; guests must remain anonymous/session-only or expose an explicit `user.is_guest` or session `is_guest` marker. Both markers deny creation. Finn owns the eventual permanent guest representation and must preserve this boundary.

For Kelechi: `player_count` is server-owned and constrained to capacity. It stays zero until a future seating service updates it. `last_activity_at` is initialized on creation and indexed; reads do not refresh it. Future seating/game services must update occupancy and activity atomically, locking the table row. Cleanup must recheck occupancy under the same lock. The inactivity threshold and cleanup implementation remain Kelechi's work. `status` permits `waiting`, `playing`, `closed`; only `waiting` is created by this endpoint.

The form is at `/tables/create`; saved settings can be read at `/tables/<id>`. Local development uses Django's existing admin login with a local staff account, then returns to the form. Finn's final login UI remains separate. See [the S13 guide](s13-public-tables.md) for exact commands and acceptance evidence.

## Ownership

- Chris: tables, lobby, table fixtures, API contracts, creation/browsing tests.
- Finn: accounts and session/guest contracts, authentication tests, team test and coverage coordination.
- Kelechi: saved theme preference and shared theme styles; admin cleanup after agreeing on inactivity threshold and authoritative occupancy. Cleanup must check current occupancy and permissions.
- Royal: avatar storage and validation, starting-chip and daily-reward fields/services. Reward amount/reset rules and atomic grant behavior require agreement.

Coordinate user field and migration changes before implementation. Royal and Kelechi extend the shared user model with their own reviewed migrations. Django staff/superuser flags support framework administration; any application-specific role mapping remains to be agreed with Finn.

## Scope and known document differences

The system design’s 60% coverage baseline is superseded for Sprint 1 by above 80% statement and above 50% branch coverage. Privacy options, bots, gameplay, joining tables, social features, and WebSocket synchronization remain future work. S13 now has a working form/API and tests; professor acceptance remains pending. S10 and other owners’ stories remain separate. The Create Table layout uses inspected Figma frame 12:1619, adapting private/bot areas to the approved public-only scope.
