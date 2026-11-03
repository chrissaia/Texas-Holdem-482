# Final local verification — November 3, 2026

Measured source: `06063bc902d8eae7ec3c4e6f21221bbfd054e49b` (source hashes in [manifest](evidence/manifest.json)). Runtime source files are unchanged from the full test run. This is the saia review candidate, not an assertion that unmerged teammate branches are covered.

| Scope | Tests passed | Runtime files | Statements | Branches |
| --- | --- | --- | --- | --- |
| Backend | 362 | 37 | 880/899 (97.89%) | 201/208 (96.63%) |
| Frontend | 115 | 33 | 541/561 (96.43%) | 453/489 (92.63%) |

Both JUnit reports contain zero failures, errors and skipped tests. Django system/migration checks, TypeScript/Vite build, lint and the coverage gate passed. Backend source inventory has no missing tracked runtime Python files; frontend main.tsx is included (unexecuted bootstrap is not excluded to inflate results).

An isolated real-browser rehearsal registered two temporary accounts, created a real table and found it in the lobby, uploaded an avatar, changed theme and verified 150 XP for the first account versus 50 XP for the second. The leaderboard used those real ledger values and current-user rank. Further theme changes paid no extra trophy bonus. Bad-page recovery and anonymous collection restrictions passed. Desktop/mobile widths 1440, 768, 390 and 320 and both themes had no overflow or page errors; 22 visible assets loaded and all static dimensions matched. Temporary accounts, their tables and avatars were removed afterward. No existing user data was changed.

The LaTeX report was compiled to PDF, all pages rendered for layout inspection, and the proposed gameplay sequence diagram checked. This is modelling, not running gameplay. Report-tool smoke checks do not claim coverage of a nonexistent engine. Hosted CI and final-main release status must be checked after push/integration.

Live board: Acceptance Test was added before Done and only #32/#45 were moved there. All other item statuses were preserved. Neither story was closed or marked professor-accepted. Ownership and estimates for those two issues reflect Chris's supplied plan. See [board change log](board-change-log.json).
