# S16: Save chip balance

## Story record

- Planned owner: Kelechi.
- Workbook source: [User_Stories.xlsx](../../reference/User_Stories.xlsx), `User Stories!A18:M18`.
- Workbook points: 2; planned sprint points: 2.
- Priority: High; epic: E10; NFR references: NFR4, NFR6, NFR11.
- Tracked issue: [#30](https://github.com/chrissaia/Texas-Holdem-482/issues/30).

**User story:** as a player, i want my chip wins and losses to save, so that my balance stays correct.

**Workbook acceptance target:** done when chip balances should update correctly.

The workbook is a planning snapshot, not a live acceptance record. Only professor/CTO acceptance establishes Done. Owner names describe the supplied plan, not inferred commit authorship.

## Implementation and scope

Persisted balances and locked reward writes exist as baseline infrastructure. New iteration-specific completion/credit has not been established by this organization pass.

- [backend/accounts/models.py](../../../backend/accounts/models.py)
- [backend/profiles/rewards.py](../../../backend/profiles/rewards.py)

## Verification handoff

Demonstrate the workbook acceptance target using real persisted data, record applicable permission/error cases and link the actual automated checks. Record the source commit, actual test result, contributor hours and CTO decision when available; missing records are not zero or automatic acceptance.
