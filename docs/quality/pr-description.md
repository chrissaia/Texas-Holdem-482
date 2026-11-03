Implements S18's real all-time XP leaderboard and repairs the documentation/testing/process gaps identified after Iteration 1. S32's existing core and real table/avatar/theme awards are included, with gameplay/social integration limits stated explicitly. Refs #32, #45 and the S13 login correction #27; no story is automatically closed or declared accepted.

The leaderboard reads persisted ledger XP, handles shared ranks and bounded pagination, shows the viewer's global rank, and omits private fields. The anonymous Create Table link now uses account login instead of staff-only admin login.

The deliverable includes reconstructed Iteration 1 and current Iteration 2 planning/execution, the reported 16-/17-point plans, fetched branch/author evidence, a compiled LaTeX/PDF report, a proposed main-gameplay sequence diagram, and a demo/acceptance runbook. Unknown actual hours, email sent timing and instructor decisions remain pending. Unmerged teammate branches are not counted as part of this measured candidate.

Validation on measured source 06063bc902d8eae7ec3c4e6f21221bbfd054e49b: 362 backend tests and 115 frontend tests passed; build, lint, system/migration checks passed. Full runtime coverage: backend 37 files, 97.89% statements / 96.63% branches; frontend 33 files, 96.43% / 92.63%. Raw coverage, JUnit XML, per-file images and source hashes are committed under docs/quality/evidence. The old two-file report is retained with a scope correction.

Real-browser rehearsal exercised registration, persisted table/lobby, avatar and theme awards, two-account XP ordering, own rank, repeat-proof theme changes, errors and guest restrictions. Both themes and widths 1440/768/390/320 passed with no overflow or page errors. Temporary demo records were removed. The PDF was compiled and every page rendered/visually inspected.

The live board now has Acceptance Test immediately before Done. Only #32/#45 moved to Acceptance Test; all other statuses and original author commits were preserved. The two issues have explicit criteria, Chris assigned, and 1-/3-point estimates. Professor acceptance is still pending.

Please review this draft before merging. The full team release still needs teammate branch integration, refreshed main-source evidence, actual time/email records, and delivery before the verified cutoff. The gameplay diagram and service-hook tests are not a shipped multiplayer/tournament engine. Hosted CI status should be checked separately from the local results above.
