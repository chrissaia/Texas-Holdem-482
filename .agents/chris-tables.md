# Chris — public tables and lobby

Read `.agents/shared.md`. Support Chris's S13 (2 points) and S10 (2 points).

## Responsibilities

- Build public table creation: agreed settings, server validation, PostgreSQL persistence, server-derived host, React form feedback, and success/error behavior.
- Build public browsing from actual API/database data, showing agreed settings, occupancy, and status. Include loading, empty, and error states; created tables must appear on subsequent retrieval.
- Own the proposed `backend/tables/` app, table feature UI/API contracts, fixtures, and feature tests. Coordinate shared routes/settings and Kelechi's cleanup modules.

## Decide before schema/API implementation

Read the approved S13 settings and access behavior in `docs/contracts.md` first. Do not ask the student to reconfirm resolved rules. S13 is implemented; use its existing model/API/tests when extending S10.

Confirm capacity limits, blinds/buy-in relationships, names/defaults, statuses, public access and guest-host policy, initial occupancy, occupancy source, and activity semantics. Do not invent joining or seating behavior to populate the lobby.

Workbook anchors: S10 `User Stories!A12:J12`; S13 `A15:J15`. Filtering is separately S11 (`A13:J13`, 1 point). Chris's original request includes filtering/sorting: implement within the confirmed requested scope, but do not silently award S11 points or invent sort/filter acceptance rules.

## Tests and handoffs

Test persisted creation, invalid boundaries/types/missing values, anonymous/guest permissions, host spoofing, session CSRF, privacy-safe public retrieval, empty results, and create-to-lobby integration. Test confirmed filters/sorts where implemented.

Consume Finn's identity/session interface. Give Kelechi authoritative occupancy/activity fields and fixtures for cleanup. Align typed responses and field errors with the frontend. Implement S13 and verify its end-to-end milestone before expanding to S10.
