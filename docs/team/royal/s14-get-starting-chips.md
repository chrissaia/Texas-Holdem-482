# S14: Get starting chips

## Story record

- Planned owner: Royal.
- Workbook source: [User_Stories.xlsx](../../iterations_and_LaTeX/User_Stories.xlsx), `User Stories!A16:M16`.
- Workbook points: --; planned sprint points: 1.
- Priority: High; epic: E10; NFR references: NFR6, NFR11.
- Tracked issue: [#28](https://github.com/chrissaia/Texas-Holdem-482/issues/28).

**User story:** as a new registered player, i want to start with 1,000 virtual chips, so that i can join a beginner table.

**Workbook acceptance target:** done when new accounts get 1,000 fake chips.

The workbook is a planning snapshot, not a live acceptance record. Only professor/CTO acceptance establishes Done. Owner names describe the supplied plan, not inferred commit authorship.

## Implementation and scope

Registration grants 1,000 virtual chips once. Existing accounts are not retroactively credited. Planned owner is Royal; Chris covered implementation.

- [backend/profiles/rewards.py](../../../backend/profiles/rewards.py)
- [backend/accounts/services.py](../../../backend/accounts/services.py)

See [profile and chip reward integration guide](profile-rewards.md) for detailed behavior and verification.

## Verification handoff

Demonstrate the workbook acceptance target using real persisted data, record applicable permission/error cases and link the actual automated checks. Record the source commit, actual test result, contributor hours and CTO decision when available; missing records are not zero or automatic acceptance.
