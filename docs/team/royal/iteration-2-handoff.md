# Royal's Iteration 2 implementation handoff

Work is on `saia`, following Chris's request. Planned ownership stays Royal; commit authorship and actual hours must remain truthful.

- **S11:** existing filters retained; minimum buy-in range and inverted-range validation added.
- **S27:** private creation, friend invitations, private discovery and invitation checks integrated with the shared seating/buy-in service.
- **S26:** read-only waiting-table observer added; live hand/betting projection is still blocked on the gameplay engine. This remains partial.

Iteration 1's avatar upload, 1,000 starting chips and 500-per-UTC-day claim were already implemented; they were not rewritten or recredited here. The latest shared chip-result and statistics work was merged into `saia` rather than duplicated. Existing friend-search and automatic-blind edits survived merge conflict resolution.

## Try it

Apply migrations, sign in and create a private table. With two accepted friends, invite one. The invited account can find the table through the lobby's private-table link, watch without taking a seat, and join with the normal buy-in. An uninvited account cannot retrieve its detail, seat state or spectator state. Leave before revoking an invitation so chips are refunded safely. Watching never consumes a seat or chips.

Run `cd backend && .venv/bin/python -m pytest` against local PostgreSQL and `cd frontend && npm test`, followed by build/lint. Specific new behavior is covered in `tables/tests/test_private_spectating.py` and `PrivateAndSpectator.test.tsx`. Measured results are recorded after execution, not assumed from this checklist. No instructor acceptance or teammate hours are inferred.


## Observed validation — November 9, 2026

- Full backend suite: **530 passed**, PostgreSQL test database.
- Full frontend suite: **163 passed**. After the final creation-copy adjustment, all 14 creation tests were rerun and passed.
- Frontend production build and lint passed.
- Django system check and migration consistency check passed.
- Local development database applied chips 0001, table seats 0002 and table invitations 0003.
- No new coverage percentage, real-browser visual check, professor acceptance or actual hours are claimed.

The merge into `saia` is committed; the new Royal feature changes remain local and uncommitted pending Chris's requested commit workflow. No branch push or PR merge was performed.
