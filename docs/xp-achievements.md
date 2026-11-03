# S32: XP and twenty-four achievements

Trophies unlock once per registered account and may stack. Most award 50 XP once; Against the Odds awards 50 XP on each qualifying 7–2 offsuit win. Its first 50 XP is the unlock reward, not an additional second bonus. Winning a completed hand outright awards 100 XP per unique hand. Split pots award no win XP, cannot unlock First Pot, and reset the consecutive-win streak. A split or folded hand still counts as a completed dealt hand. Tournament wins award 1,000 XP per unique completed tournament, plus one-time trophies. No participation XP, levels, or leaderboard are added.

| Achievement | Condition | Current integration |
| --- | --- | --- |
| Welcome to the Table | Complete a dealt hand | Trusted hand-completion hook; gameplay pending |
| Picture Perfect | Save a profile picture | Real avatar upload |
| House Rules | Create a game | Real table creation |
| Poker Pal | Add an accepted friend | Trusted hook; friends pending |
| Say Hello | Send a direct message | Trusted hook; messaging pending |
| Getting Comfortable | Complete 10 dealt hands | Hand-completion hook |
| Regular Player | Complete 100 dealt hands | Hand-completion hook |
| Table Veteran | Complete 1,000 dealt hands | Hand-completion hook |
| First Pot | Win a hand outright | Hand-completion hook |
| On a Roll | Win three consecutive dealt hands outright | Hand-completion hook |


### Additional ten trophies

These use trusted gameplay/tournament hooks; the corresponding engines are not implemented yet. Trophies remain hidden until first earned. Against the Odds repeats its 50 XP reward; the other trophy bonuses remain one-time.

| Achievement | Condition |
| --- | --- |
| Pocket Rockets | Be dealt two aces; winning is not required |
| Against the Odds | Win outright holding 7–2 of different suits |
| All or Nothing | Go all-in before the flop and win outright |
| Straight Shooter | Win at showdown with a straight |
| Flush with Success | Win at showdown with a flush |
| Full House | Win at showdown with a full house |
| Four of a Kind | Win at showdown with four of a kind |
| Royal Treatment | Win at showdown with a royal flush |
| Tournament Debut | Complete a tournament |
| Champion | Win a tournament |

Showdown trophies match the final evaluated hand category exactly; a royal flush does not also award the ordinary flush trophy. Split pots cannot earn win trophies, but still count toward participation and may earn Pocket Rockets because it rewards being dealt aces.

Migration `progression.0002_event_facts` stores normalized facts with each event so conflicting retries cannot add or change facts after an award. Existing events retain empty facts; they are not retrospectively re-evaluated.

```python
record_event(user.pk, "hand", str(hand.pk), outcome="win", facts={
    "hole_cards": ["7s", "2h"],
    "preflop_all_in": True,
    "showdown": True,
    "category": "full_house",
})
record_event(user.pk, "tournament", str(tournament.pk), outcome="win")
# Tournament "loss" means completed participation without winning, not merely registration.
```

Cards use two-character notation (2–9, T, J, Q, K, A plus s/h/d/c), must be distinct, and are normalized so reversing card order is still the same event. Flags must be booleans; categories require a showdown. These structural checks do not replace the authoritative engine: it must verify actual dealt cards, final hand evaluation, preflop actions, tournament completion, and the winner. No event-submission HTTP endpoint is exposed. Deliver the complete facts with the first event and preserve them on retries.

## Discovery and UI

Open **Achievements** in navigation, or **Trophies** on mobile, at `/achievements`. The page follows inspected Figma frame `18:16972`, with its 48-pixel trophy emblem and the existing app layout/theme tokens. The approved hidden behavior supersedes the mockup's visible locked requirements and sample reward values. Locked cards reveal neither names, descriptions, progress nor stable achievement codes. The API sends only earned details and an overall count. No home-screen previews, notifications or automatic achievement announcements are added.

The collection shows total XP and achievement-only XP separately. Each trophy reveals its name, condition and award date after it is earned. Reload and manual refresh use persisted server data. Guests cannot earn or read an account collection. XP is separate from virtual chip balances.

## Backend contract and handoff

Migration `progression.0001_initial` adds progress counters, unique earned achievements and an XP event ledger without changing the shared user schema. Apply it with:

```bash
docker compose exec backend python manage.py migrate
```

`GET /api/achievements/` requires an active registered session and returns:

```json
{
  "total_xp": 50,
  "total_achievements": 24,
  "earned": [
    {
      "code": "picture",
      "name": "Picture Perfect",
      "description": "Save your first profile picture.",
      "xp": 50,
      "earned_at": "2026-11-03T00:00:00Z"
    }
  ]
}
```

The endpoint is private, non-cacheable and read-only. Browsers cannot submit events, choose an achievement, or claim XP. Awarding hooks execute in the originating action's database transaction; action and award roll back together. Avatar storage cleanup preserves the previous avatar if awarding fails. Table creation grants House Rules only after valid creation.

Future authoritative backend services call:

```python
from progression.services import record_event

# Within the completed hand transaction, once per dealt participant:
record_event(user.pk, "hand", str(hand.pk), outcome="win")
# Other outcomes: "loss" (including a fold) or "split" (any shared pot).
# Supply the same hand ID on retries; never call once per side pot.

# Only after friendship acceptance, not when sending a request:
record_event(user.pk, "friend", str(friendship.pk))
# After successfully persisting a sent direct message:
record_event(sender.pk, "message", str(message.pk))
```

The hand service must verify completion, participation and pot outcomes and deliver hands in completion order per account. Clients must never supply these facts to this service unchecked. Do not emit events for spectators, open/uncompleted hands, friend requests or failed messages. Friendship services should emit for both participating registered accounts upon acceptance, rejecting self-friendship; messaging services should emit only for the sender after authorization and successful persistence.

All event writes lock the same user row used by profile/reward services. Stable event IDs and database uniqueness prevent retries from counting hands or paying XP twice. A retry with a conflicting outcome is rejected; it cannot rewrite a completed hand. Different actions can stack achievements, but the `(user, achievement)` constraint makes each trophy lifetime-once. Existing tables and avatars are not silently backfilled; the next successful relevant action can earn their trophy.

Leaderboard and the actual tournament/game engines remain separate work. The leaderboard can consume the ledger's summed XP later; do not use chip balances as XP.

## Checks

Tests cover one-time awards, stacking, split handling, milestones, duplicate/conflicting events, permissions, hidden API details, owner isolation, action rollback, actual avatar/table integration, PostgreSQL concurrent awards, UI loading/retry/refresh and late responses after switching accounts.

```bash
docker compose exec backend pytest --cov
docker compose exec frontend npm test
docker compose exec frontend npm run build
docker compose exec frontend npm run lint
```

Earlier ten-achievement verification: all 274 backend tests and 100 frontend tests passed. The production build, lint and migration checks passed. An isolated headless Chrome walkthrough verified registration, ten hidden trophies, real avatar upload earning Picture Perfect and 50 XP, nine remaining hidden cards, 48×48 trophy geometry, dark/light themes, and widths 1440/768/390 with no horizontal overflow or page errors. Temporary browser accounts and avatars were removed afterward. Gameplay, friendship and messaging hooks are tested service contracts, not end-to-end integrations with features that do not yet exist.

Twenty-achievement extension verification: 58 focused backend progression tests and all 100 frontend tests passed. Build, lint, Django system checks and migration consistency checks passed. Tests include all ten new trophies, split/loss exclusions, suited versus offsuit cards, malformed facts, immutable retries, stacking, and tournament reward retries. No new gameplay or tournament end-to-end integration is claimed.


## Repeatable rewards

- Every unique outright hand win: 100 XP.
- Every unique tournament win: 1,000 XP.
- Every unique outright win with 7–2 offsuit: 50 XP, stacking with the 100 XP win award.

The trophy collection still has one entry per achievement. The first 7–2 win awards its trophy's 50 XP; subsequent qualifying wins award a repeat bonus of 50 XP. There is no double 50 XP payment on the first win. First Pot and Champion keep their one-time trophy bonuses in addition to the repeatable base win XP. Other achievements stay one-time. Split/loss events and retries cannot receive repeat win XP. Existing recorded events are not backfilled.

Earned API entries include `repeat_xp` (50 for Against the Odds, otherwise zero). Only earned repeatable trophies display the repeat reward in the UI. Total XP includes all repeat rewards; Achievement XP in the summary counts trophy-unlock bonuses only. Gameplay and tournament hooks still await real engine integration.


## Remaining collection: four more trophies

The collection contains 24 achievements from the brainstorm. Sharing the Spoils is excluded because split-pot achievements were rejected. All four additional trophy bonuses are one-time, 50 XP, hidden until earned:

| Trophy | Rule | Integration |
| --- | --- | --- |
| Comeback Kid | Outright win after starting with the unique smallest stack among dealt participants; ties for smallest do not qualify | Trusted completed-hand hook |
| Final Table | Reach the final table in a tournament that began with at least two tables | Trusted stage-transition hook |
| Heads-Up Hero | Reach the final two in a tournament with at least three entrants | Trusted stage-transition hook |
| Make It Yours | Change the recorded theme choice | Real Settings theme picker and private API |

For Comeback Kid, provide `starting_stack` and `starting_stacks` in hand facts. Include the player's stack in the list of 2–9 dealt participants' positive starting stacks, before blinds/antes or bets. Values must be whole chips. Stack lists are normalized on retry. Split and loss outcomes cannot earn this trophy.

```python
record_event(user.pk, "hand", str(hand.pk), outcome="win", facts={
    "starting_stack": 100,
    "starting_stacks": [100, 500, 1000],
})
record_event(user.pk, "tournament_stage", f"{tournament.pk}:final_table", facts={
    "stage": "final_table", "entrants": 18, "starting_tables": 2,
})
record_event(user.pk, "tournament_stage", f"{tournament.pk}:heads_up", facts={
    "stage": "heads_up", "entrants": 18, "starting_tables": 2,
})
```

The authoritative tournament service must verify actual player advancement and emit each transition separately. Stage events do not grant Tournament Debut, Champion, or the 1,000 XP winner reward; those wait for the completed tournament event. Stable stage-specific IDs prevent replay awards; all trophies remain lifetime-once across tournaments.

`POST /api/profile/theme/` accepts exactly `{"theme":"light"}` or `{"theme":"dark"}`, requires a registered active session and CSRF, and derives the account from the session. Migration `progression.0003_progress_theme` adds the recorded choice, initially dark. A different choice updates the record and awards Make It Yours atomically. Unchanged choices do not award XP. Subsequent changes remain allowed without paying again. Browser rendering still follows the existing local preference; the account record tracks explicit choices and does not override local preferences at login. An existing browser already set to light can select dark without changing the initially dark account record; choosing light afterward earns the trophy. Anonymous/guest changes remain local only. Failed account updates retain the browser theme and display an error, with no automatic trophy announcement.

The gameplay and tournament trophies are service contracts with automated tests, not completed integration with a poker/tournament engine. The new trophies require no UI redesign; the existing collection automatically shows 24 slots and reveals only earned details.

Remaining-collection verification: 341 backend tests and 107 frontend tests passed; production build, lint, system checks and migration checks passed. The isolated browser verified 24 hidden slots, avatar earning 50 XP, a completed authenticated theme update earning Make It Yours (100 XP total), desktop/mobile widths and both themes without page errors or overflow. The theme picker now waits for identity/profile loading so an early selection cannot be mistaken for an anonymous local-only change. Browser fixtures were removed afterward.
