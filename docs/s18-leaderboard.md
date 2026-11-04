# S18 — all-time XP leaderboard (#32)

Open `/leaderboard` or use Leaderboard / mobile Ranks. The screen follows inspected Figma frame `18:16210` with the existing app shell, real avatar imagery and 48/64-pixel podium fallback assets. It adapts the mockup to the implemented all-time XP metric: no invented levels, season, friends, win rates or game counts. XP comes only from the persisted progression ledger; virtual chips do not affect ranking.

`GET /api/leaderboard/?page=1&page_size=10` is public. Active registered accounts are included even at zero XP; inactive accounts are excluded. Ties use competition rank (1, 1, 3), and ID orders equal-XP rows stably. Page size is bounded at 50; invalid/unknown/repeated queries return 400 and nonexistent pages return 404. The response is non-cacheable because an authenticated response may include the viewer's own rank.

Response: `{count, page, page_size, total_pages, period: "all_time", current_user, results}`. Each row has `{id, username, avatar_url, total_xp, rank, is_current_user}`. `current_user` is null for anonymous/guest users; otherwise it reports their global rank even off the current page. Email, password, chip balance and private reward timestamps are never serialized. Usernames, selected avatars and total XP are public in this ranking view.

The backend aggregates XP and computes ranks in PostgreSQL. Public listing uses two queries without per-player queries; authenticated rank adds bounded queries. Rank may change while other players earn XP; manual refresh gets current data. Client submissions cannot set XP or choose sort columns. The UI handles loading, empty, retry, bad-page recovery, refresh and page boundaries, and ignores late responses after account changes.

See [acceptance criteria](quality/acceptance-checklist.md), [demo steps](quality/demo-runbook.md) and [full testing evidence](quality/README.md). Seasonal rankings are S33, outside this story. Professor acceptance remains pending.
