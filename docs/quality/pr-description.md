Persist real XP and hidden achievement unlocks, and rank active accounts using the all-time XP ledger. Refs #45 (S32), #32 (S18), and #27 for the regular-player login correction. No story is automatically closed or declared accepted.

The leaderboard supports shared ranks, bounded pagination, private-field exclusions and a viewer's global rank even off-page. Review found a concurrent-deactivation failure in the personal-rank lookup; it is fixed with a regression test. Achievements use row locks, stable event IDs and one-time trophy records, with repeat win XP as documented.

Real avatar, public-table and theme actions award XP now. Game, tournament and social trophies have tested trusted hooks awaiting their authoritative integrations; this PR does not claim a shipped poker engine.

The report contains reconstructed Iteration 1 and current Iteration 2 planning/execution, the reported 16-/17-point team plans, branch/author evidence, full coverage images and a proposed gameplay sequence diagram. Chris reports sending the Iteration 2 planning email October 27, 2026 at 7:47 PM local time. Unknown actual hours remain pending. Course report authoring and upload packages are maintained outside the application repository.

Validation on measured source 1af0df00c3705298a7ae9c316a7ea330507ac55e: **363 backend tests and 115 frontend tests passed**, plus build, lint and Django system/migration checks. Full runtime coverage: backend 37 files, 97.89% statements / 96.67% branches; frontend 33 files, 96.43% / 92.63%. Raw JSON/XML, JUnit results, images and source hashes are committed. Report/tool output is evidence, not implementation LOC or extra story points.

A real-browser rehearsal exercised registration, table/lobby persistence, avatar/theme awards, two-account XP ranking, current-user rank and retry/guest states in both themes and widths 1440/768/390/320. Temporary records were removed. The UI has not changed since that rehearsal; the new lookup race is covered by API tests.

The live board has Acceptance Test immediately before Done. Only #32/#45 moved there. Both remain open and await professor acceptance. Kelechi (kelechi055) has been requested for peer review; the posted Codex-assisted review is not independent teammate approval.

Chris explicitly requested delivery to main after review and successful final checks. Use a merge commit to preserve the separate commit history. Other teammate branches, actual hours and instructor decisions remain separate team responsibilities.
