# S1: Login and logout

## Story record

- Planned owner: Finn.
- Workbook source: [User_Stories.xlsx](../../reference/User_Stories.xlsx), `User Stories!A3:M3`.
- Workbook points: 1; planned sprint points: 1.
- Priority: High; epic: E1; NFR references: NFR1, NFR7, NFR10.
- Tracked issue: [#8](https://github.com/chrissaia/Texas-Holdem-482/issues/8).

**User story:** as a registered player, i want to log in and out, so that i can use my account.

**Workbook acceptance target:** done when users can log in and log out

The workbook is a planning snapshot, not a live acceptance record. Only professor/CTO acceptance establishes Done. Owner names describe the supplied plan, not inferred commit authorship.

## Implementation and scope

Account login/logout endpoints and screens exist. Instructor acceptance remains separate.

- [backend/accounts/views.py](../../../backend/accounts/views.py)
- [frontend/src/features/auth/SignInPage.tsx](../../../frontend/src/features/auth/SignInPage.tsx)

## Verification handoff

Demonstrate the workbook acceptance target using real persisted data, record applicable permission/error cases and link the actual automated checks. Record the source commit, actual test result, contributor hours and CTO decision when available; missing records are not zero or automatic acceptance.
