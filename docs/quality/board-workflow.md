# Board and issue traceability

Live board: https://github.com/users/chrissaia/projects/2 (Kanban).

The audited Status field originally had Backlog, Ready, In progress, In review, Done. It now has **Backlog → Ready → In progress → In review → Acceptance Test → Done**. Existing option IDs and all 39 item statuses were preserved when adding the column. The Done description reserves acceptance for the professor/CTO. A status option is not itself instructor approval.

Verified story issues:

| Story | Issue | Iteration owner / planned points |
| --- | --- | --- |
| S32 XP and achievements | [#45](https://github.com/chrissaia/Texas-Holdem-482/issues/45) | Chris / 3 |
| S18 leaderboard | [#32](https://github.com/chrissaia/Texas-Holdem-482/issues/32) | Chris / 1 |
| S19 friends | [#33](https://github.com/chrissaia/Texas-Holdem-482/issues/33) | Finn / 5 |
| S16 chip balance | [#30](https://github.com/chrissaia/Texas-Holdem-482/issues/30) | Kelechi / 2 |
| S15 buy-in | [#29](https://github.com/chrissaia/Texas-Holdem-482/issues/29) | Kelechi / 1 |
| S17 statistics | [#31](https://github.com/chrissaia/Texas-Holdem-482/issues/31) | Kelechi / 1 |
| S11 filtering | [#25](https://github.com/chrissaia/Texas-Holdem-482/issues/25) and older duplicate #23 | Royal / 1; team must select canonical task and confirm new work |
| S27 private table | [#40](https://github.com/chrissaia/Texas-Holdem-482/issues/40) | Royal / 1 |
| S26 spectator | [#39](https://github.com/chrissaia/Texas-Holdem-482/issues/39) | Royal / 2 |

No duplicates are closed automatically. Older S1/S11/S12/S23 duplicates exist; owners should resolve canonical issues together. S11 filters and chip persistence already have some earlier implementation: distinguish new iteration work from existing baseline and confirm incremental acceptance rather than counting the same work twice.

New commits use real references such as `S18: add all-time XP ranking (#32)` and `S32: document verified achievement scope (#45)`. Avoid `closes`/`fixes` before professor acceptance. Existing commits keep their original hashes/authorship; map them to the real story in the report instead of rewriting shared history.

Only our two selected stories are candidates for an internal readiness transition in this repair. Other teammates' statuses and instructor decisions remain untouched. Issue bodies document explicit criteria and limitations; tests do not mark Done. Actual hours and transition logs come from human records. Preserve original author commits when merging; a branch's existence is contribution evidence but not proof that its content is in the release.
