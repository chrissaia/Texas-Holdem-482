# S17: See my stats

## Story record

- Planned owner: Kelechi.
- Workbook source: [User_Stories.xlsx](../../iterations_and_LaTeX/User_Stories.xlsx), `User Stories!A19:M19`.
- Workbook points: 1; planned sprint points: 1.
- Priority: Medium; epic: E11; NFR references: NFR7, NFR11.
- Tracked issue: [#31](https://github.com/chrissaia/Texas-Holdem-482/issues/31).

**User story:** as a registered player, i want to see my poker stats, so that i can see how i am doing.

**Workbook acceptance target:** done when players can see their poker stats.

The workbook is a planning snapshot, not a live acceptance record. Only professor/CTO acceptance establishes Done. Owner names describe the supplied plan, not inferred commit authorship.

## Implementation and scope

The Statistics navigation entry opens `/statistics`. The private, read-only
`GET /api/profile/stats/` endpoint aggregates the signed-in account's existing
`progression.Event` hand results in one database query. It returns hands played,
hands won, hands lost, split hands, and all-time win rate to one decimal place.
Win rate = outright wins / all recorded hands; a split is participation, not a win.

The server derives the user from the session. Anonymous/guest/inactive access is
denied, query parameters cannot select another user or an unsupported period,
writes return 405, and responses have no-store caching headers. Existing unique
(user, kind, source) events prevent retries from increasing totals twice.

The page supports loading, retry, manual refresh, logout/account-switch privacy,
and a truthful zero-hand empty state. It reuses existing shell/tokens/fonts and
Figma Statistics frame 18:16682 (overview and outcome breakdown), adapted to the
available data. It supports light/dark themes and narrow screens. Time-series,
pot/action metrics, exports, and complete game counts are absent because those
facts are not recorded in the existing hand ledger. No mock chart/history ships.

No new statistics counter or model migration is needed. The shared trusted
`progression.services.record_event(user_id, "hand", stable_hand_id, outcome=...)`
hook is the source of hand facts. Saving a wallet delta alone does not establish
a completed poker hand. The separately planned engine must record actual completed
hands through this existing hook; no player event-submission endpoint is added.

## Verification

- 16 focused backend tests: aggregation, empty account, split policy, retries,
  per-account isolation, forbidden writes/filters, rollback, rewards excluded,
  and persistence across logout/login.
- 8 frontend tests: populated and empty views, refresh/retry, guest gating,
  expired-session privacy, and late responses after switching accounts.
- Real Edge check: a temporary account first showed zero hands; explicitly
  synthetic server-side fixtures (two wins, three losses, one split) produced
  six hands and 33.3% wins. Verified refresh, reload, new login, logout denial,
  light/dark appearance and 1440/768/390/320px layouts without page errors or
  horizontal overflow. Test fixtures were removed afterward. This checks S17's
  recorded-results display; it does not claim a real played poker game.

Run `docker compose exec backend pytest profiles/tests/test_statistics.py -v`
and `docker compose exec frontend npm test -- --run src/features/statistics/StatisticsPage.test.tsx`.
Sign in and choose Statistics to see your own recorded results. A normal account
with no completed hand events correctly shows zeros. The earlier S16 wallet test
on your account does not fabricate hand statistics.

Professor acceptance, actual hours, peer review, and final main integration must
be recorded separately. The story commits contain implementation and measured
checks; they do not establish professor acceptance or hosted CI results.


## Full regression results

All 515 backend tests and 153 frontend tests passed, with Django checks, migration
drift check, frontend build and lint clean. Full-scope coverage: backend 98.47%
statements / 97.41% branches; frontend 96.49% statements / 92.43% branches.
[Compact coverage reports and screenshots](iteration-2-testing/README.md) cover the
working tree containing all three stories. These are measured local results.
