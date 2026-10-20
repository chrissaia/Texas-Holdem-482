# S10 — Browse public tables

Implemented on `saia` for Chris's second selected story (2 points). Professor acceptance is pending. Search/filter/sort behavior also fulfills the technical scope from Chris's original request; filtering remains S11 in the workbook and no additional accepted points are claimed automatically.

## Try it

With Docker Desktop running, from the repository root:

```bash
docker compose up -d
```

Open http://localhost:5173/lobby. Browsing requires no account. The sidebar, mobile header, and home page link to the lobby.

- Create a real table through `/tables/create` using the existing local sign-in workflow in [the S13 guide](s13-public-tables.md).
- Select **See it in the lobby** on success. Its saved name, host, blinds, buy-in, minimum balance, capacity, occupancy, and status appear from PostgreSQL.
- Search by table name or host, choose filters/sorting, and navigate pages. Search submits with Enter or **Search**; dropdowns apply immediately.
- **Available seats** starts enabled; turn it off to include full tables. **Reset filters** clears search/sort/page and restores the default available-seat view.
- Open **View Table** to inspect the saved settings, then **Back to lobby** to browse again.
- **Refresh tables** retrieves current records. No fixtures are automatically inserted into the running application's database.

If there are no tables, the page invites creating the first one. If filters match nothing, it suggests changing them. API/network failures show a retry action. Invalid filters and missing pages offer reset guidance. Search/filter/sort/page state is stored in the URL and survives reload, sharing, and browser Back.

## API

`GET /api/tables/` shares the existing route with S13's permission-protected POST. GET allows anonymous users and cannot expose private tables. Closed tables are excluded; waiting/playing tables remain visible without inventing an inactivity threshold.

| Parameter | Behavior |
| --- | --- |
| `search` | Case-insensitive substring of table name or host username; trimmed, at most 150 characters |
| `max_buy_in` | Inclusive maximum buy-in, positive whole chips |
| `big_blind` | Exact big-blind amount, positive whole chips |
| `max_players` | Exact capacity: 2, 4, 6, 8, or 9 |
| `available_seats` | `true` requires occupancy below capacity; `false` includes full tables |
| `status` | Optional `waiting` or `playing` |
| `ordering` | `newest` (default), `name`, `buy_in`, `-buy_in`, `blinds`, or `players` |
| `page` | Positive page number, default 1 |
| `page_size` | 1–50 results, default 8 |

Filters combine with AND; search matches either name OR host. Unknown/repeated/invalid parameters return HTTP 400 with field-keyed errors. An out-of-range page returns HTTP 404. Blank search matches everything. The API includes full tables unless `available_seats=true`; the frontend explicitly sends true by default to match the design's selected toggle.

Name sorting ignores case. Newest sorts creation time descending, buy-in sorting supports both directions, blinds sort ascending, and players sorts occupancy descending. Each ordering has an ID tie-breaker so equal values have a deterministic order.

The response includes `count`, `next`, `previous`, `page`, `page_size`, `total_pages`, and `results`. Each result reuses S13's public table contract. `total_tables` and `total_players` summarize all active public tables before search, filters, or pagination; `count` is the number matching the filters. Host data contains only ID and username. Listing does not change activity timestamps or occupancy.

The result query joins hosts to avoid a database query per row. A regression test verifies three queries for an anonymous list request: global totals, filtered count, and paginated rows. No schema migration or new dependency is required. Very large lobby counts/search indexes can be tuned against measured load in a later milestone.

## Files

- `backend/tables/views.py`: combined list/create endpoint, query filters, safe sort mapping, totals.
- `backend/tables/serializers.py`: strict query validation.
- `backend/tables/pagination.py`: bounded pagination and response metadata.
- `backend/tables/tests/test_lobby.py`: PostgreSQL acceptance and query-count tests.
- `frontend/src/features/tables/LobbyPage.tsx`, `lobby.css`: lobby screen and responsive result table.
- `frontend/src/features/tables/LobbyPage.test.tsx`: behavior, errors, URL navigation, and integration tests.
- Existing navigation, API types, creation success, and table detail links connect the two stories.

## Design and boundaries

Inspected Figma frame [Poker Lobby 12:1291](https://www.figma.com/design/Rpni0LkJsoCyH7MSfLUKgb/texas-holdem-ui?node-id=12-1291). The screen reuses S13's shell/tokens/fonts and downloaded icons. It follows the title/search/filter/result/notice layout. At small widths, controls stack and the semantic results table scrolls inside a labeled, keyboard-focusable region rather than overflowing the page.

The mockup's friend counts, affordability, stake categories, bots, and reward controls require data/features outside these stories. The functional table shows minimum balance instead of inventing stake tiers or friend counts. **Quick Join**, **Friends playing**, and **Bot tables** remain unavailable. **View Table** replaces join/spectate actions until those features exist. The notice uses actual virtual-chip context rather than a sample player's balance. Public tables remain enforced regardless of URL manipulation.

This is REST-based browsing with explicit refresh, not automatic WebSocket updates. Closing old empty tables remains Kelechi's S23. Player occupancy remains server-owned; there is no simulated player activity. Saved theme selection remains Kelechi's S35.

## Verification

```bash
docker compose exec backend python manage.py check
docker compose exec backend python manage.py makemigrations --check --dry-run
docker compose exec backend pytest --cov --cov-report=term-missing
npm --prefix frontend run build
npm --prefix frontend run lint
npm --prefix frontend run test:coverage
```

See [S10 verification](s10-verification.md) for observed results and browser checks. No commit, push, or pull request is created by this implementation alone.
