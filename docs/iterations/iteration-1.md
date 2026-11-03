# Iteration 1 — reconstructed planning and execution record

Prepared November 3, 2026 to repair the missing documentation noted by the professor. This is a retrospective reconstruction, not a document claimed to have existed at the original deadline. See the [team-reported plans](../reference/iteration-plans.md), [main report source/PDF](../report/) and [current testing evidence](../quality/README.md).

## Planning

The updated team plan selected S13/S10 (Chris, 4), S2/S1/S4 (Finn, 4), S23/S35 (Kelechi, 4), and S5/S14/S29 (Royal, 4), for 16 planned points. The original window was October 12–22, 2026, with an October 21 internal target and an October 22 nominal due date to verify on Moodle. The planning content is available; proof of when it was emailed is still pending.

## Execution and evidence

| Stories | Planned owner | Observed implementation evidence | Historical acceptance / hours |
| --- | --- | --- | --- |
| S13/S10 | Chris | Tables API, PostgreSQL model, create/lobby UI and tests; S13 commit `9b87b7d`; current S10/S13 guides | Pending actual records |
| S2/S1/S4 | Finn | `402f931`, `03cb335`, `a8606f1`; account/session and UI tests | Pending actual records |
| S23/S35 | Kelechi | `54bae1f`, `d3e56f2`, `f0ac4cb`; cleanup permissions/transactions and saved themes | Pending actual records |
| S5/S14/S29 | Royal assigned; Chris later covered implementation as requested in this session | `9b21c1e` is authored by Chris, October 26; avatar/starting/daily code and tests exist now | Original delivery/acceptance and contributor hours pending |

The fetched `origin/main` tip at audit start is `7a3d567` (October 26). That current tree does not prove all features were present at the original cutoff. The October 26 avatar/reward commit must not be backdated or reattributed to Royal. Other branches are assessed separately; absence from this clone is not evidence of no work. No hours are inferred from LOC, commit count or elapsed dates.

## Testing correction

The professor observed that a two-file image was presented as broad coverage. The retained S23 report measures only cleanup/admin (61 statements, 12 branches). It is now explicitly labelled historical feature-only evidence. Current full-application evidence includes all runtime app source, unexecuted files, exact denominators, report images and source hashes. It does not retroactively replace the evidence actually submitted for Iteration 1.

## Reflection and process changes

Proposed team reflection, awaiting each member's confirmation: maintain the report during development; verify scope before publishing coverage; keep acceptance distinct from internal review; link actual issues in commits; rehearse the real database flow; have every member explain their own code and communicate absences in advance. Branch activity is evidence of contribution; main delivery and acceptance remain separate responsibilities.

Planned points: 16. Accepted points, team velocity, cycle time and actual hours: **pending instructor/team records**, not zero. The professor reported Kelechi presented alone; attendance explanations should be supplied by the affected students, not reconstructed by an assistant.
