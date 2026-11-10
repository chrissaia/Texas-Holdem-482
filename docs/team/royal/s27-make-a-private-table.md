# S27: Make a private table

## Story record

- Planned owner: Royal.
- Workbook source: [User_Stories.xlsx](../../iterations_and_LaTeX/User_Stories.xlsx), `User Stories!A29:M29`.
- Workbook points: 1; planned sprint points: 1.
- Priority: Low; epic: E18; NFR references: NFR1, NFR2, NFR7, NFR11.
- Tracked issue: [#40](https://github.com/chrissaia/Texas-Holdem-482/issues/40).

**User story:** as a host, i want to make a private table and invite friends, so that only invited people can join.

**Workbook acceptance target:** done when private tables need an invite to join.

The workbook is a planning snapshot, not a live acceptance record. Only professor/CTO acceptance establishes Done. Owner names describe the supplied plan, not inferred commit authorship.

## Implementation and scope

Registered hosts can select **Private table** on `/tables/create`. The server creates an empty private waiting table, using the existing settings validation and host identity from the session. It does not automatically seat the host or debit chips.

Open the saved table to invite an **accepted friend**. Invitations belong to specific account IDs, not transferable secret links. Invitees find the table under **My private tables and invitations** in the lobby. Public lists, totals and filters exclude private tables. Host and invitation holders can read, watch and join; other accounts receive 404. Join and leave reuse S15's locked affordability, capacity and refund services.

Hosts can revoke access before an invitee takes a seat. Revoking a seated player is rejected with 409 so reserved chips cannot be stranded; the player must leave first. Removing a social friendship does not silently delete an already issued table invitation. Hosts manage those grants explicitly. Inactive accounts cannot access private tables. Only registered hosts can issue invitations, and all writes enforce CSRF.

## API

- `GET /api/tables/private/`: hosted/invited private tables and a CSRF token, registered-only.
- `POST /api/tables/private/`: the same settings object as public creation; server fixes private visibility and host.
- `GET /api/tables/<id>/invitations/`: host-only account identities and CSRF token.
- `POST` / `DELETE` on that invitation path: exactly `{user_id}` to invite/revoke.
- Existing detail, seat and watch endpoints apply the shared visibility policy. Private data is not cacheable.

## Verification and ownership

`backend/tables/tests/test_private_spectating.py` covers discovery, host-only actions, friends-only grants, retries, CSRF, inactive users, malformed input, private seat funding/refunds, revocation and hidden public listings. `frontend/src/features/tables/PrivateAndSpectator.test.tsx` exercises the screens; the creation suite checks the private endpoint.

Royal remains the planned owner. This implementation was performed by Chris's assistant at Chris's request on `saia`; this does not fabricate Royal's authorship, hours or instructor acceptance. Gameplay remains a separate dependency.
