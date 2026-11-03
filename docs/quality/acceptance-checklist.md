# Acceptance criteria and proof

A checked implementation criterion means internally verified, not professor acceptance. Use the live demo to request acceptance; only the CTO/professor can award accepted points or move a story to Done. S32 = [#45](https://github.com/chrissaia/Texas-Holdem-482/issues/45), S18 = [#32](https://github.com/chrissaia/Texas-Holdem-482/issues/32).

## S32 — earn XP and achievements (3 planned points)

| Criterion | Proof | Boundary |
| --- | --- | --- |
| Registered player earns persisted XP from actual actions | Create table, upload avatar or change recorded theme; collection and refresh show saved totals | No browser claim-XP endpoint |
| Trophies are hidden until earned | Collection API only returns earned names/requirements; locked cards are generic | 24-trophy catalogue is a server contract, not 24 integrated game features |
| Trophy bonuses are one-time and can stack | `test_progression.py`; concurrent actions, replay and conflicting-event tests | Against the Odds repeats its 50 XP bonus after first unlock |
| Win rewards use authoritative distinct results | 100 XP per outright hand win, 1,000 per tournament win; stable event IDs prevent duplicate payments | Tested trusted hooks; no working poker/tournament engine yet |
| Split pots never count as wins | Split tests deny win XP/trophies and break win streak | Participation and dealt-aces rules may still apply |
| Owner/session privacy and CSRF enforced | Anonymous/guest restrictions, owner isolation and CSRF tests | Achievements private; leaderboard only publishes public ranking fields |
| Theme and avatar real integration works | Actual upload and recorded theme choice persist, with one-time trophies | Browser theme remains local; recorded account choice starts dark |
| No fake gameplay claims | Demo clearly separates real UI actions from labelled backend service tests | Friend/message/tournament integrations are pending their owners' features |

Professor decision on S32 and any narrowed acceptance scope: **pending**. Do not automatically claim three accepted points from test success.

## S18 — see leaderboard (1 planned point)

| Criterion | Proof |
| --- | --- |
| Ranks real database accounts by all-time earned XP | PostgreSQL aggregation over the event ledger; no hard-coded opponents/results |
| Shared XP gives shared rank | Competition ranking 1, 1, 3; deterministic ID tie ordering and page-boundary tests |
| Public fields only | ID, username, avatar URL, XP, rank and current-user flag; no email/password/balance/timestamps |
| Inactive users excluded; zero-XP active users included | Automated API cases |
| Registered viewer sees own global rank even off page | Real authenticated request and API test |
| Bounded pagination and invalid inputs | Page size default 10/max 50; invalid/unknown/repeated query rejection and missing-page 404 |
| Loading, empty, retry, refresh and pagination work | Frontend tests plus real browser walkthrough |
| Both themes, keyboard-friendly controls and mobile layout | Semantic table, labelled pages, disabled boundaries, viewport/theme checks |
| No unsupported statistics or periods | All-time only; no fake levels, win rate, friends or seasonal rankings (S33 separate) |

Professor acceptance: **pending**.

## Delivery gates

- Full backend and frontend tests, build, lint, system/migration checks pass.
- Tool-generated full-scope report, per-file images, manifest and exclusions are committed.
- LaTeX source and visually checked PDF include both iterations, coverage images and the gameplay sequence diagram.
- Every selected story has actual issue links and accurate planned owner/points; actual hours and acceptance evidence are supplied by humans.
- Branches preserve each author's work. Main contains the reviewed deliverable before the verified cutoff.
- Planning email sent timestamp and Moodle/demo dates are confirmed.
- Every teammate attends and can explain their code; arrange any absence with the professor beforehand.
