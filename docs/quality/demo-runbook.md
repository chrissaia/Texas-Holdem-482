# Live-demo rehearsal and release runbook

Prepare together before the November 5 nominal delivery date; verify exact Moodle cutoff and actual presentation time. Do not use the demo date as a release extension. This script proves implemented behavior; it does not simulate a missing poker engine as if it were shipped.

## Before the session

1. Each author pushes their feature branch, links actual issues, requests peer review and resolves integration failures. Confirm main includes the reviewed work before the cutoff. Never force-push shared history.
2. Run `scripts/run_quality.sh` against the intended release source; review missing coverage, update the separately maintained course report and commit application testing evidence. Check the GitHub CI run after pushing; local success alone is not a green hosted run.
3. Assign speaking roles: Chris S32/S18; Finn S19; Kelechi S16/S15/S17; Royal S11/S27/S26. Each owner supplies their actual branch, commits, hours, completed/partial criteria and demo steps. This runbook does not assert their features are merged or ready.
4. Agree on presenter/backup, attendance and screen-sharing. Record a short backup walkthrough showing the source SHA and real app; this supports the live demo and does not excuse an unapproved absence. Contact the professor in advance if someone cannot attend.
5. Use a fresh labelled demonstration account through registration. Do not display credentials, `.env`, private emails or real user uploads on screen. Keep a clean browser and the database-backed services running.

## Chris — approximately six minutes

| Step | Action | Expected proof |
| --- | --- | --- |
| 1 | Show branch/commit SHA, #45/#32 and the board | Real traceability; Acceptance Test immediately before Done |
| 2 | Register a new demo account and open Achievements | 1,000 starting chips are virtual currency, not XP; collection begins hidden |
| 3 | Create one valid public table, then check the lobby | Real persisted table; House Rules adds 50 XP once |
| 4 | Upload a valid PNG/JPEG/WebP in Settings and reload | Persisted avatar; Picture Perfect adds 50 XP |
| 5 | Change the theme to light after account loading completes | Make It Yours adds 50 XP; both themes render; choose dark/light again without a second trophy bonus |
| 6 | Open Leaderboard and refresh | Actual ledger total of 150 XP and current global rank; avatar/name visible without private account data |
| 7 | Create another table or replace the avatar | Trophy remains one-time and total stays 150; no duplicate payout |
| 8 | Show invalid input and privacy briefly | Invalid table/file rejection; signed-out achievement view asks to sign in; public leaderboard still works |
| 9 | Show focused tests for wins/ties/concurrency | Clearly label these as trusted service tests, not real multiplayer gameplay |
| 10 | Show full per-file coverage and report PDF | Explain source SHA, denominators, omitted tests/migrations and uncovered bootstrap code; show gameplay diagram as proposed design |

For leaderboard comparisons, have a second fresh account perform one real qualifying action (50 XP), then observe relative order and equal-XP ties. Production UI never loads seeded opponents. Existing accounts may have different totals; inspect actual totals rather than forcing the expected rank to be #1. No manual editing of balances/XP is needed.

## Questions to rehearse

- How does an event retry avoid a second award? Show stable `(user, kind, source)` and row locks.
- Why do ties share rank while order is stable? Explain XP rank versus ID tie ordering.
- What is incomplete? State gameplay/tournament/social integrations and teammate branch/main status honestly.
- What does 99% coverage mean? Explain file scope, statement/branch denominators and why it does not prove all backlog features exist.
- What was velocity/cycle time? Use recorded accepted points and actual transition timestamps; say pending when records are absent. Never derive work hours from commit timestamps.
- Who wrote each part? Use original authors and reviewed branches; do not substitute story ownership for authorship or LOC for proof of behavior.

After the demo, record the professor's decisions. Accepted items may move to Done. Rejected items return to Backlog with the actual reason and follow-up task. Do not close or mark stories accepted preemptively.
