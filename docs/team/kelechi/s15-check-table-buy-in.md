# S15: Check table buy in

## Story record

- Planned owner: Kelechi.
- Workbook source: [User_Stories.xlsx](../../reference/User_Stories.xlsx), `User Stories!A17:M17`.
- Workbook points: 1; planned sprint points: 1.
- Priority: Low; epic: E10; NFR references: NFR6, NFR9.
- Tracked issue: [#29](https://github.com/chrissaia/Texas-Holdem-482/issues/29).

**User story:** as a player, i want the game to stop me from joining if i dont have enough chips, so that table buy ins are followed.

**Workbook acceptance target:** done when players need enough chips to join a table.

The workbook is a planning snapshot, not a live acceptance record. Only professor/CTO acceptance establishes Done. Owner names describe the supplied plan, not inferred commit authorship.

## Implementation and scope

Registered players can join a public waiting table from its existing detail page.
GET/POST/DELETE /api/tables/<id>/seat/ reads, joins, or leaves only the session's seat.
Writes require CSRF and an empty object. The server reads its own buy-in, minimum
balance, occupancy, and saved account balance. Both balance thresholds apply.

A successful join reserves the buy-in: the wallet decreases and a TableSeat holds
that amount. One funded table per account is allowed. Repeated joins do not debit
again. Leaving a waiting/closed table refunds the reserved stack once; leaving
while playing is rejected. A seat and its account/table cannot be deleted through
ordinary admin actions while funds are held. Admin cannot hide a funded public table.

All writes lock the table then account in one transaction, updating occupancy and
activity with the seat. Capacity, simultaneous joins, refunds, and storage failures
cannot silently lose chips. Cleanup also checks actual seat existence.

Gameplay is separate: this joins a waiting table; no cards are dealt. Future engine
writes must hold the same table lock, move reserved stacks/pots atomically, and
never deduct the original buy-in twice through the S16 wallet service. Guests
cannot join funded tables because session guests have no persisted chip account.
Private-table admission belongs to its separate story.

## Verification

- 37 S15 backend tests; all 190 table tests passed.
- 10 SeatPanel frontend tests passed; frontend build/lint and Django checks passed.
- Real browser: register temporary account, join, refresh and retain seat, leave
  and restore wallet, reject unaffordable table. Verified 390px layout with no
  horizontal overflow or JavaScript errors. Temporary fixtures were removed.

Run `docker compose exec backend python manage.py migrate`, then
`docker compose exec backend pytest tables/tests/test_seating.py -v`.
Frontend: `docker compose exec frontend npm test -- --run src/features/tables/SeatPanel.test.tsx`.

Manual demo: create a table whose buy-in/minimum exceed your wallet and confirm
Join is disabled. Try an affordable table; verify wallet debit, refresh persistence,
and the refund after Leave. Use a separate test account. Professor acceptance and
actual hours must be recorded separately; no acceptance or hours are invented.
