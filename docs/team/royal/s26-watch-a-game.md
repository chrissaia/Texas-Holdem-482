# S26: Watch a game

## Story record

- Planned owner: Royal.
- Workbook source: [User_Stories.xlsx](../../iterations_and_LaTeX/User_Stories.xlsx), `User Stories!A28:M28`.
- Workbook points: 2; planned sprint points: 2.
- Priority: Low; epic: E17; NFR references: NFR7, NFR9, NFR10.
- Tracked issue: [#39](https://github.com/chrissaia/Texas-Holdem-482/issues/39).

**User story:** as a user, i want to watch a table without taking a seat, so that i can watch friends or learn.

**Workbook acceptance target:** done when people can watch games without playing.

The workbook is a planning snapshot, not a live acceptance record. Only professor/CTO acceptance establishes Done. Owner names describe the supplied plan, not inferred commit authorship.

## Implementation and scope — partial

`/tables/<id>/watch` is a read-only spectator foundation. It displays actual saved table status, blinds, seated usernames and table stacks. It polls the server every five seconds while visible, refreshes on focus, provides manual refresh and clears private state if access is revoked.

Watching does not reserve a seat, debit chips, update occupancy or prolong table activity. Public tables can be watched without registration; private tables require host/invited-account access. The response explicitly lists safe fields and never includes account balances, emails or hole cards. Spectator POST and DELETE requests are rejected.

**Not complete against the full story:** no authoritative live poker-hand engine is present. Community cards, betting, turns and showdown cannot yet be watched. The UI and API state this limitation (`gameplay_available: false`), and no fake game state or hidden-card stream is invented. This story must remain partial until the actual gameplay service publishes a tested public projection. The proposed sequence diagram is not runtime evidence.

## Verification

`backend/tables/tests/test_private_spectating.py` checks the public-field allowlist, private invitations/revocation, read-only HTTP behavior and unchanged chips/seats/activity. `frontend/src/features/tables/PrivateAndSpectator.test.tsx` checks rendering, GET-only refresh, access loss and the visible gameplay limitation. Browser visual validation is not implied by DOM tests.

Royal remains the planned owner. Work on `saia` was requested by Chris; no Royal authorship, hours, accepted points or full S26 completion is claimed.
