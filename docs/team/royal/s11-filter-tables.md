# S11: Filter tables

## Story record

- Planned owner: Royal.
- Workbook source: [User_Stories.xlsx](../../reference/User_Stories.xlsx), `User Stories!A13:M13`.
- Workbook points: 1; planned sprint points: 1.
- Priority: Medium; epic: E7; NFR references: NFR5, NFR9, NFR10.
- Tracked issue: [#25](https://github.com/chrissaia/Texas-Holdem-482/issues/25).

**User story:** as a player, i want to filter the table list, so that i can find the kind of game i want.

**Workbook acceptance target:** done when players can use filters to find tables.

The workbook is a planning snapshot, not a live acceptance record. Only professor/CTO acceptance establishes Done. Owner names describe the supplied plan, not inferred commit authorship.

## Implementation and scope

The lobby already contains server-side filters. New iteration-specific work and credit must be distinguished from this baseline.

- [backend/tables/serializers.py](../../../backend/tables/serializers.py)
- [frontend/src/features/tables/LobbyPage.tsx](../../../frontend/src/features/tables/LobbyPage.tsx)

## Verification handoff

Demonstrate the workbook acceptance target using real persisted data, record applicable permission/error cases and link the actual automated checks. Record the source commit, actual test result, contributor hours and CTO decision when available; missing records are not zero or automatic acceptance.
