# S27: Make a private table

## Story record

- Planned owner: Royal.
- Workbook source: [User_Stories.xlsx](../../reference/User_Stories.xlsx), `User Stories!A29:M29`.
- Workbook points: 1; planned sprint points: 1.
- Priority: Low; epic: E18; NFR references: NFR1, NFR2, NFR7, NFR11.
- Tracked issue: [#40](https://github.com/chrissaia/Texas-Holdem-482/issues/40).

**User story:** as a host, i want to make a private table and invite friends, so that only invited people can join.

**Workbook acceptance target:** done when private tables need an invite to join.

The workbook is a planning snapshot, not a live acceptance record. Only professor/CTO acceptance establishes Done. Owner names describe the supplied plan, not inferred commit authorship.

## Implementation and scope

Private-table invitation/access behavior has not been established by this organization pass. Public table creation does not complete this story.

- [backend/tables/models.py](../../../backend/tables/models.py)
- [docs/architecture/contracts.md](../../architecture/contracts.md)

## Verification handoff

Demonstrate the workbook acceptance target using real persisted data, record applicable permission/error cases and link the actual automated checks. Record the source commit, actual test result, contributor hours and CTO decision when available; missing records are not zero or automatic acceptance.
