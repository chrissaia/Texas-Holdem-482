# S11: Filter tables

## Story record

- Planned owner: Royal.
- Workbook source: [User_Stories.xlsx](../../iterations_and_LaTeX/User_Stories.xlsx), `User Stories!A13:M13`.
- Workbook points: 1; planned sprint points: 1.
- Priority: Medium; epic: E7; NFR references: NFR5, NFR9, NFR10.
- Tracked issue: [#25](https://github.com/chrissaia/Texas-Holdem-482/issues/25).

**User story:** as a player, i want to filter the table list, so that i can find the kind of game i want.

**Workbook acceptance target:** done when players can use filters to find tables.

The workbook is a planning snapshot, not a live acceptance record. Only professor/CTO acceptance establishes Done. Owner names describe the supplied plan, not inferred commit authorship.

## Implementation and scope

Public lobby filtering supports search, capacity, availability, status, blind level and maximum buy-in from the existing baseline. This change adds **minimum buy-in**, combines it with the maximum bound, rejects inverted ranges, and resets it with the other filters. Private tables remain excluded regardless of the chosen range.

Open `/lobby`, enter a minimum buy-in, choose a maximum using the existing Buy-in filter and inspect the matching records. The range is saved in the URL, and changing filters resets pagination. Reset filters restores the default available-seat view.

## Verification

`backend/tables/tests/test_private_spectating.py` checks combined inclusive ranges, inverted ranges and private-table exclusion. `frontend/src/features/tables/LobbyPage.test.tsx` checks the minimum parameter and reset behavior. Existing S10 filtering behavior is baseline, not additional newly earned story points. Professor acceptance is pending.
