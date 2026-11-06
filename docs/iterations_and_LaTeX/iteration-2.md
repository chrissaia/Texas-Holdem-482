# Iteration 2 — planning and execution

As of November 3, 2026. Nominal due date supplied by the assignment: November 5; verify exact Moodle cutoff and live-demo schedule. The team-reported email content selects **17 points**, not 16: Chris 4 (S32/S18), Finn 5 (S19), Kelechi 4 (S16/S15/S17), Royal 4 (S11/S27/S26). See [the complete plan](../reference/iteration-plans.md). Chris reports that the planning email was sent October 27, 2026 at 7:47 PM local time. The release date still needs confirmation to assess the assignment's email deadline.

## Current work and boundaries

| Owner | Scope | Evidence and state | Actual hours | Professor-accepted points |
| --- | --- | --- | --- | --- |
| Chris | S32 (3), S18 (1) | 24 hidden trophies; real avatar/game/theme awards; atomic trusted gameplay/social hooks; real all-time XP leaderboard and tests on saia | Pending | Pending |
| Finn | S19 (5) | Fetched feature/S19-friends branch has `798af8e`, `09166e7`, `e3c7733`; not yet in the audited main tree | Pending | Pending |
| Kelechi | S16 (2), S15 (1), S17 (1) | Work is on teammate branches as reported; current fetched snapshot alone cannot establish all current work | Pending | Pending |
| Royal | S11 (1), S27 (1), S26 (2) | Work is on teammate branches as reported; do not infer absence of work from missing/unpushed refs | Pending | Pending |

S32's XP/achievement core and three real existing-action integrations are implemented. Gameplay, tournament, friends and messaging trophies still require authoritative feature integrations. They are not presented as completed poker/social features. S18 ranks actual ledger XP and does not fabricate games, win rates, levels, seasons or opponents.

## Acceptance and tests

Use [the acceptance checklist](../quality/acceptance-checklist.md) and [demo runbook](../quality/demo-runbook.md). Link S32 work to [#45](https://github.com/chrissaia/Texas-Holdem-482/issues/45) and S18 to [#32](https://github.com/chrissaia/Texas-Holdem-482/issues/32). New coverage evidence measures all current app source separately for backend/frontend and includes executable launchers; source/config and report scope are recorded.

The main-gameplay sequence diagram is a **proposed multiplayer design** placed in the report's System Design / Diagrams subsection. It includes validation failure, transaction boundaries, authoritative payouts, duplicate-safe progression and recipient-filtered post-commit publication. The game engine and Channels are not implemented by the diagram.

## Process and completion

The live board's Status field now includes Acceptance Test immediately before Done, with Backlog first; all existing statuses were preserved. Only professor/CTO acceptance authorizes Done. Actual work, planned points, internally verified work and accepted points are not interchangeable. Completed/partial work and hours must be confirmed with the author. The point estimates here are planning values, not a claim that 17 points have been delivered.

Actual velocity = professor-accepted story points during the iteration. Cycle time = actual Acceptance Test entry minus actual In Progress entry under the team's documented convention. Historical transitions and accepted points are not known; no cycle time or velocity is invented. Track future transitions and use the supplied work-log template.

The review candidate was pushed as PR #53. Integration with teammate branches and delivery to main must be tracked separately from professor acceptance. Do not overwrite teammates' work or treat an individual feature branch as the finished team release. Optional refactoring, spikes and card animation tasks are not claimed as extra points here.
