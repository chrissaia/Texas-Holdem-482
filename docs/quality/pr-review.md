# S18/S32 PR review

Codex-assisted review of PR #53, performed for Chris. This is not an independent teammate approval or professor acceptance. Kelechi (`kelechi055`) has been requested as the agreed peer reviewer.

Reviewed: session/CSRF and ownership boundaries; row-locked/idempotent XP awards; replay and conflicting-event handling; split-pot exclusions; ranking ties and pagination; privacy-safe payloads; UI stale-response behavior; migration compatibility; full-scope coverage evidence; and report/draft provenance.

## Finding resolved before merge

**P2 — personal-rank lookup could fail during concurrent deactivation.** `LeaderboardView.list` used `accounts.get(pk=viewer_id)` on an active-account queryset after authentication. If another request deactivated that account in between, the lookup could raise DoesNotExist and return 500. It now uses a nullable lookup and omits the personal-rank section; public results remain available. A regression test simulates the cached authenticated-user state and verifies HTTP 200 with no personal rank or inactive entry. Fixed in `dd1e549`.

## Scope and evidence

The implemented core supports real avatar, table and theme XP and a real all-time ledger leaderboard. Trusted game/tournament/social hooks are tested service contracts; their future integrations are not represented as running gameplay. Actual hours are unknown and were not invented. The Iteration 2 email sent time is recorded as Chris reported: October 27, 2026 at 7:47 PM local time.

The full suite and hosted checks must pass for the final head before merge. Source/test/artifact evidence identifies the measured revision. No blocking findings remain in the reviewed implemented scope after the deactivation guard. Peer review remains a separate human process; no self-approval is being submitted. Stories remain in Acceptance Test until the professor decides acceptance.
