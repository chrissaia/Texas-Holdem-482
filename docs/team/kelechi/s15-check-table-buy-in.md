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

Table settings validation exists, but it is not proof of an authoritative seating-time affordability check. Story completion is unverified.

- [backend/tables/serializers.py](../../../backend/tables/serializers.py)
- [docs/architecture/contracts.md](../../architecture/contracts.md)

## Verification handoff

Demonstrate the workbook acceptance target using real persisted data, record applicable permission/error cases and link the actual automated checks. Record the source commit, actual test result, contributor hours and CTO decision when available; missing records are not zero or automatic acceptance.
