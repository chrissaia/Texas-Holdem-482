# Shared foundation and handoff

## Implemented interfaces

- User: `accounts.User`, initially Django `AbstractUser` without extra fields. Its primary key is an integer (`BigAutoField`). Finn owns account validation, uniqueness policies, registration, login/logout, guest representation, and the eventual session endpoint. Email is not uniquely constrained in this foundation; Finn must decide and implement that policy before registration.
- User references: foreign keys use `settings.AUTH_USER_MODEL`; runtime code uses `get_user_model()`. Passwords use Django’s hashing APIs.
- Authentication: DRF session authentication; endpoints require authenticated users by default. The readiness endpoint explicitly permits anonymous GET requests. Cookie-authenticated writes must retain CSRF protection. No client-supplied host ID or development identity headers will be trusted.
- `GET /api/health/`: HTTP 200 with `{"status":"ok","database":"ok"}` after a PostgreSQL query; HTTP 503 with `{"status":"unavailable","database":"unavailable"}` when the database is inaccessible. It does not expose connection errors or credentials.
- Datetimes: timezone-aware UTC. Database credentials and Django configuration come from the root `.env`. Vite uses same-origin relative `/api/` requests through its development proxy.

## Next milestone: agree before implementing tables

The Create Table and Poker Lobby frames have now been inspected directly. See [table-milestone.md](table-milestone.md) for observed fields, scope differences, and the proposed creation API. Its proposed rules remain pending the student's decision.

Chris owns the public-table schema, creation, and browsing APIs. Proposed fields: ID, name, host foreign key, public visibility, capacity, small/big blinds, buy-in, status, creation/activity timestamps. No table schema or endpoint is implemented yet.

Confirm permitted capacity, blind and buy-in rules, table-name constraints, filtering/sorting options, whether guests can create tables, and how pre-game seat occupancy is represented. Do not infer occupancy from the historical game participation model or automatically seat a host without an agreed requirement. The host must come from the authenticated request. Public browsing permissions must be explicit.

Use integer virtual-chip amounts; no real-money behavior. The backend validates all writes and controls activity time, occupancy, and ownership. The frontend will receive documented TypeScript contracts once the API shape is agreed.

## Ownership

- Chris: tables, lobby, table fixtures, API contracts, creation/browsing tests.
- Finn: accounts and session/guest contracts, authentication tests, team test and coverage coordination.
- Kelechi: saved theme preference and shared theme styles; admin cleanup after agreeing on inactivity threshold and authoritative occupancy. Cleanup must check current occupancy and permissions.
- Royal: avatar storage and validation, starting-chip and daily-reward fields/services. Reward amount/reset rules and atomic grant behavior require agreement.

Coordinate user field and migration changes before implementation. Royal and Kelechi extend the shared user model with their own reviewed migrations. Django staff/superuser flags support framework administration; any application-specific role mapping remains to be agreed with Finn.

## Scope and known document differences

The system design’s 60% coverage baseline is superseded for Sprint 1 by above 80% statement and above 50% branch coverage. Privacy options, bots, gameplay, joining tables, social features, and WebSocket synchronization remain future work. The UI starter has not yet been converted to the Figma design. No sprint feature is claimed complete by this infrastructure milestone.
