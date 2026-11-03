## S18 — See the leaderboard

Original backlog story; Iteration 2 reported owner: Chris. Planned estimate: **1 point**. Professor acceptance is pending.

### Implemented acceptance criteria
- [x] Show real active registered players ranked by persisted, all-time XP from the authoritative event ledger.
- [x] Equal XP shares competition rank (1, 1, 3); stable ID ordering supports bounded pagination.
- [x] Show the registered viewer's global rank even off the current page; public/guest browsing works.
- [x] Expose only ID, username, avatar URL, XP, rank and current-user flag; no private account fields.
- [x] Provide loading, empty, refresh, retry, bad-page recovery and page-boundary states.
- [x] Test PostgreSQL ranking, privacy, query count, invalid/repeated inputs and UI behavior.
- [ ] Complete peer review and merge the reviewed deliverable to main before the verified cutoff.
- [ ] Professor/CTO live-demo acceptance (only then move to Done).

### Scope and proof
All-time XP only. Friends/weekly/seasonal boards, fabricated levels, wins and win rates are excluded. Sources: backend/progression/leaderboard.py, frontend/src/features/leaderboard/, docs/s18-leaderboard.md. See docs/quality/acceptance-checklist.md and demo-runbook.md for the concrete demo and source/test evidence.

New implementation commits reference this issue with #32. Internal completion is not accepted points. Actual hours and sent planning-email timing require the student's records.
