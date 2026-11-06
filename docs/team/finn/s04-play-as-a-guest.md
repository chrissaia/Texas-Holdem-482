# S4: Play as a guest

## Story record

- Planned owner: Finn.
- Workbook source: [User_Stories.xlsx](../../reference/User_Stories.xlsx), `User Stories!A6:M6`.
- Workbook points: 1; planned sprint points: 1.
- Priority: Low; epic: E3; NFR references: NFR7, NFR9, NFR10.
- Tracked issue: [#10](https://github.com/chrissaia/Texas-Holdem-482/issues/10).

**User story:** as a guest, i want to play without making an account, so that i can try the game right away.

**Workbook acceptance target:** done when guests can pick a name without making an account.

The workbook is a planning snapshot, not a live acceptance record. Only professor/CTO acceptance establishes Done. Owner names describe the supplied plan, not inferred commit authorship.

## Implementation and scope

Guest-name/session support exists; this does not establish a complete playable poker engine.

- [backend/accounts/views.py](../../../backend/accounts/views.py)
- [frontend/src/features/auth/GuestPage.tsx](../../../frontend/src/features/auth/GuestPage.tsx)

## Verification handoff

Demonstrate the workbook acceptance target using real persisted data, record applicable permission/error cases and link the actual automated checks. Record the source commit, actual test result, contributor hours and CTO decision when available; missing records are not zero or automatic acceptance.
