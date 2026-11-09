# S2: Make an account

## Story record

- Planned owner: Finn.
- Workbook source: [User_Stories.xlsx](../../reference/User_Stories.xlsx), `User Stories!A4:M4`.
- Workbook points: 2; planned sprint points: 2.
- Priority: High; epic: E1; NFR references: NFR1, NFR7, NFR10.
- Tracked issue: [#9](https://github.com/chrissaia/Texas-Holdem-482/issues/9).

**User story:** as a new player, i want to register with my email username and password, so that my progress can be saved.

**Workbook acceptance target:** done when users can make an account and usernames are different

The workbook is a planning snapshot, not a live acceptance record. Only professor/CTO acceptance establishes Done. Owner names describe the supplied plan, not inferred commit authorship.

## Implementation and scope

Account registration validates identity/password input and grants starting chips transactionally.

- [backend/accounts/services.py](../../../backend/accounts/services.py)
- [frontend/src/features/auth/RegisterPage.tsx](../../../frontend/src/features/auth/RegisterPage.tsx)

## Verification handoff

Demonstrate the workbook acceptance target using real persisted data, record applicable permission/error cases and link the actual automated checks. Record the source commit, actual test result, contributor hours and CTO decision when available; missing records are not zero or automatic acceptance.
