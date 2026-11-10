# S5: Pick an avatar

## Story record

- Planned owner: Royal.
- Workbook source: [User_Stories.xlsx](../../iterations_and_LaTeX/User_Stories.xlsx), `User Stories!A7:M7`.
- Workbook points: 3; planned sprint points: 2.
- Priority: Medium; epic: E4; NFR references: NFR7, NFR9, NFR10.
- Tracked issue: [#12](https://github.com/chrissaia/Texas-Holdem-482/issues/12).

**User story:** as a registered player, i want to pick an avatar, so that i can make my profile look how i want.

**Workbook acceptance target:** done when players can pick an avatar and save it.

The workbook is a planning snapshot, not a live acceptance record. Only professor/CTO acceptance establishes Done. Owner names describe the supplied plan, not inferred commit authorship.

## Implementation and scope

Validated image upload, normalization and persisted avatars exist. Planned owner is Royal; Chris covered implementation at the user’s request.

- [backend/profiles/avatars.py](../../../backend/profiles/avatars.py)
- [frontend/src/features/profile/AccountCard.tsx](../../../frontend/src/features/profile/AccountCard.tsx)

See [profile and chip reward integration guide](profile-rewards.md) for detailed behavior and verification.

## Verification handoff

Demonstrate the workbook acceptance target using real persisted data, record applicable permission/error cases and link the actual automated checks. Record the source commit, actual test result, contributor hours and CTO decision when available; missing records are not zero or automatic acceptance.
