# S19: Add and remove friends

## Story record

- Planned owner: Finn.
- Workbook source: [User_Stories.xlsx](../../reference/User_Stories.xlsx), `User Stories!A21:M21`.
- Workbook points: 5; planned sprint points: 5.
- Priority: Medium; epic: E13; NFR references: NFR7, NFR11.
- Tracked issue: [#33](https://github.com/chrissaia/Texas-Holdem-482/issues/33).

**User story:** as a registered player, i want to add and remove friends, so that i can keep a list of people i play with.

**Workbook acceptance target:** done when players can add and remove friends.

The workbook is a planning snapshot, not a live acceptance record. Only professor/CTO acceptance establishes Done. Owner names describe the supplied plan, not inferred commit authorship.

## Implementation and scope

Friend requests, accept/decline/cancel, removal and lists are implemented. Consult the code for the current search interface; planned ownership stays Finn.

- [backend/friends/services.py](../../../backend/friends/services.py)
- [frontend/src/features/friends/FriendsPage.tsx](../../../frontend/src/features/friends/FriendsPage.tsx)

## Verification handoff

Demonstrate the workbook acceptance target using real persisted data, record applicable permission/error cases and link the actual automated checks. Record the source commit, actual test result, contributor hours and CTO decision when available; missing records are not zero or automatic acceptance.
