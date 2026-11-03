## S32 — Earn XP and achievements

Original backlog story; Iteration 2 reported owner: Chris. Planned estimate: **3 points**. Professor acceptance is pending.

### Implemented core and real integrations
- [x] Persist XP and one-time trophy unlocks atomically using server-owned event IDs and account row locks.
- [x] Hide locked trophy names/requirements in the API and UI; show trophy icons for earned achievements.
- [x] Award real avatar upload, public table creation and recorded theme-change actions.
- [x] Support stacking, safe retries, conflicting-event rejection and concurrent actions without duplicate payouts.
- [x] Preserve repeat rewards: 100 XP per outright hand win, 1,000 XP per tournament win, and 50 XP per qualifying 7–2 offsuit win. Split pots do not count as wins.
- [x] Provide tested contracts and validation for 24 trophies, including tournament stages and starting-stack conditions.
- [ ] Integrate gameplay/tournament/friend/message trophies with their authoritative features as those owners deliver them; service tests are not a real game engine.
- [ ] Complete peer review and merge the reviewed deliverable to main before the verified cutoff.
- [ ] Professor/CTO decides whether the demonstrated scope satisfies the story and accepts it (only then move to Done).

### Traceability and limitations
Sources: backend/progression/, frontend/src/features/achievements/, docs/xp-achievements.md. Real action walkthrough and partial-integration boundaries: docs/quality/acceptance-checklist.md and demo-runbook.md. Current full-application coverage is under docs/quality/evidence/ and does not establish coverage of missing game/social features.

Earlier S32 commits lacked the actual #45 reference; their original hashes/authorship are preserved and mapped in documentation. New commits reference #45. Do not claim three accepted points from a passing test suite. Chris reports sending the Iteration 2 planning email October 27, 2026 at 7:47 PM local time. Actual hours remain pending.
