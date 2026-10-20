# Shared foundation and handoff

## Implemented interfaces

- User: `accounts.User`, initially Django `AbstractUser` without extra fields. Its primary key is an integer (`BigAutoField`). Finn owns account validation, uniqueness policies, registration, login/logout, guest representation, and the eventual session endpoint. Usernames and non-blank emails are unique case-insensitively at the database level; see the accounts section below.
- User references: foreign keys use `settings.AUTH_USER_MODEL`; runtime code uses `get_user_model()`. Passwords use Django’s hashing APIs.
- Authentication: DRF session authentication; endpoints require authenticated users by default. The readiness endpoint explicitly permits anonymous GET requests. Cookie-authenticated writes must retain CSRF protection. No client-supplied host ID or development identity headers will be trusted.
- `GET /api/health/`: HTTP 200 with `{"status":"ok","database":"ok"}` after a PostgreSQL query; HTTP 503 with `{"status":"unavailable","database":"unavailable"}` when the database is inaccessible. It does not expose connection errors or credentials.
- Datetimes: timezone-aware UTC. Database credentials and Django configuration come from the root `.env`. Vite uses same-origin relative `/api/` requests through its development proxy.

## S2/S1/S4 accounts and sessions

Finn owns `backend/accounts/`. All endpoints live under `/api/auth/`, allow anonymous access, and enforce CSRF on every POST, including anonymous ones (DRF normally skips CSRF for anonymous requests).

- `GET session/`: sets the CSRF cookie and returns the session contract below.
- `POST register/`: `{username, email, password}`. Usernames are 3–30 characters of letters, numbers, `.`, `-`, `_`. Emails are stored lowercase. Both are unique case-insensitively, enforced by validation and by database constraints (concurrent duplicates return HTTP 400). Passwords use Django's validators and hashing. Success returns HTTP 201 and signs the new user in. Signed-in users get HTTP 400.
- `POST login/`: `{username, password}`; the username match is case-insensitive. Wrong passwords, unknown usernames, and inactive accounts all return HTTP 400 `{"non_field_errors": ["Invalid username or password."]}`. Login rotates the session key and CSRF token.
- `POST logout/`: deletes the server-side session; the old cookie no longer authenticates.
- `POST guest/`: `{name}`, trimmed, 2–20 characters of letters, numbers, spaces, `-`, `_`. Creates no database user. Guest names may repeat among guests but cannot match a registered username. The guest session expires after 24 hours or on logout. Signed-in users get HTTP 400.

Every response returns the session contract, including the current `csrf_token` because login and logout rotate it:

```json
{"state": "anonymous" | "guest" | "registered",
 "user": {"id": 1, "username": "...", "email": "...", "is_admin": false} | null,
 "guest": {"name": "..."} | null,
 "csrf_token": "..."}
```

Guests stay anonymous Django users with `request.session["is_guest"] = True` and `request.session["guest_name"]`, so `tables.permissions.can_host` already denies them. Logging in or registering removes both guest keys. `is_admin` maps to Django `is_staff`. `user.email` is only returned to the account's own session; public responses must keep using `{id, username}`.

Registration runs inside `accounts.services.register_user`, a single transaction. Royal's starting-chip grant should be called there so a failed grant rolls back the account.

Shared pytest fixtures live in `backend/conftest.py`: `registered_user`, `rivr_admin` (a superuser), `registered_client`, `rivr_admin_client`, and `guest_client`. The clients sign in through the real endpoints with CSRF enforced. They are named to avoid pytest-django's built-in `admin_user`/`admin_client`.

Open decisions: these username, guest-name, and guest-lifetime rules are Finn's implementation choices pending team agreement. Login rate limiting is not implemented.

## S13 public-table creation

Chris owns `backend/tables/` and the table feature UI. The student approved the following rules: names trimmed to 1–80 characters; capacity 2/4/6/8/9; positive whole-chip amounts; big blind exactly twice small blind; buy-in at least big blind; minimum balance at least buy-in. Duplicate names are allowed and IDs distinguish tables. Amounts are limited to 2,147,483,647 for PostgreSQL integer storage; the small blind is at most 1,073,741,823 so its double fits.

Implemented endpoints:

- `GET /api/tables/creation-context/`: public, returns `{host: {id, username} | null, csrf_token}` and sets the CSRF cookie for the form. This small form-specific interface can later consume Finn's session interface; it does not implement login or registration.
- `POST /api/tables/`: requires an active registered user's Django session and CSRF token. JSON fields: `name`, `max_players`, `buy_in`, `minimum_balance`, `small_blind`, `big_blind`. Returns HTTP 201 with the saved table. Missing/invalid/unknown/server-controlled fields return HTTP 400 with field-keyed error arrays. Session/CSRF permission failures return HTTP 403.
- `GET /api/tables/<id>/`: public read-back of a public table. Missing/private tables return HTTP 404. S10 now adds GET listing/filtering on `/api/tables/`; see the lobby contract below.

Server-controlled output fields: `id`, `host` (only ID and username), `is_public`, `player_count`, `status`, `created_at`, and `last_activity_at`. Creation sets public visibility, zero occupancy, waiting status, and UTC timestamps. It does not seat the host, debit chips, start gameplay, or create bots/invitations. All writes use the authenticated host; client-supplied host/occupancy/status fields are rejected.

User references use `settings.AUTH_USER_MODEL` with `PROTECT` on deletion to prevent an accidental account delete from removing tables. Finn must coordinate account deletion behavior with Chris if adding it later. Registered accounts currently mean active Django users; guests must remain anonymous/session-only or expose an explicit `user.is_guest` or session `is_guest` marker. Both markers deny creation. Finn owns the eventual permanent guest representation and must preserve this boundary.

For Kelechi: `player_count` is server-owned and constrained to capacity. It stays zero until a future seating service updates it. `last_activity_at` is initialized on creation and indexed; reads do not refresh it. Future seating/game services must update occupancy and activity atomically, locking the table row. Cleanup must recheck occupancy under the same lock. The inactivity threshold and cleanup implementation remain Kelechi's work. `status` permits `waiting`, `playing`, `closed`; only `waiting` is created by this endpoint.

The form is at `/tables/create`; saved settings can be read at `/tables/<id>`. Local development uses Django's existing admin login with a local staff account, then returns to the form. Finn's final login UI remains separate. See [the S13 guide](s13-public-tables.md) for exact commands and acceptance evidence.

## S10 public lobby

`GET /api/tables/` is public and paginated. It includes public tables whose status is not `closed`, using the same safe host serialization as S13. POST remains registered-session-only with CSRF enforcement.

The request supports name/host `search`, `max_buy_in`, exact `big_blind`, exact `max_players`, `available_seats=true|false`, `status=waiting|playing`, fixed `ordering` choices, `page`, and bounded `page_size`. Unknown/repeated/invalid queries are HTTP 400; missing pages are HTTP 404. See [s10-lobby.md](s10-lobby.md) for exact defaults and sort behavior.

Response: `{count, next, previous, page, page_size, total_pages, total_tables, total_players, results}`. `results` uses the existing table response shape. `count` reflects applied filters; the two `total_*` values describe all active public tables. The frontend explicitly filters available seats by default, saves view state in the URL, and supports manual refresh.

No client can request private entries, supply arbitrary sort columns, or mutate occupancy/activity by browsing. Kelechi's eventual cleanup will be reflected on the next fetch. There is no inferred inactivity expiry until an agreed cleanup rule exists. The React lobby is `/lobby`, linked from navigation and S13 success. Row actions read saved settings; joining/gameplay and affordability are still future integration.

## Ownership

- Chris: tables, lobby, table fixtures, API contracts, creation/browsing tests.
- Finn: accounts and session/guest contracts, authentication tests, team test and coverage coordination.
- Kelechi: saved theme preference and shared theme styles; admin cleanup after agreeing on inactivity threshold and authoritative occupancy. Cleanup must check current occupancy and permissions.
- Royal: avatar storage and validation, starting-chip and daily-reward fields/services. Reward amount/reset rules and atomic grant behavior require agreement.

Coordinate user field and migration changes before implementation. Royal and Kelechi extend the shared user model with their own reviewed migrations. Django staff/superuser flags support framework administration; any application-specific role mapping remains to be agreed with Finn.

## Scope and known document differences

The system design’s 60% coverage baseline is superseded for Sprint 1 by above 80% statement and above 50% branch coverage. Privacy options, bots, gameplay, joining tables, social features, and WebSocket synchronization remain future work. S13 now has a working form/API and tests; professor acceptance remains pending. S10 now provides real public browsing, filters, sorting, and pagination; other owners’ stories remain separate. The Create Table layout uses inspected Figma frame 12:1619, adapting private/bot areas to the approved public-only scope.
