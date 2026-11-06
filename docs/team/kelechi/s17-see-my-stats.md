# S17: See my stats

## Story record

- Planned owner: Kelechi.
- Workbook source: [User_Stories.xlsx](../../reference/User_Stories.xlsx), `User Stories!A19:M19`.
- Workbook points: 1; planned sprint points: 1.
- Priority: Medium; epic: E11; NFR references: NFR7, NFR11.
- Tracked issue: [#31](https://github.com/chrissaia/Texas-Holdem-482/issues/31).

**User story:** as a registered player, i want to see my poker stats, so that i can see how i am doing.

**Workbook acceptance target:** done when players can see their poker stats.

The workbook is a planning snapshot, not a live acceptance record. Only professor/CTO acceptance establishes Done. Owner names describe the supplied plan, not inferred commit authorship.

## Implementation and scope

Complete statistics UI and authoritative result aggregation have not been established by this organization pass. XP totals alone are not all poker statistics.

- [backend/progression/models.py](../../../backend/progression/models.py)
- [docs/architecture/contracts.md](../../architecture/contracts.md)

## Verification handoff

Demonstrate the workbook acceptance target using real persisted data, record applicable permission/error cases and link the actual automated checks. Record the source commit, actual test result, contributor hours and CTO decision when available; missing records are not zero or automatic acceptance.
