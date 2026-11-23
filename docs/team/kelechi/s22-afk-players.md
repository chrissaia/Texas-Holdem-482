# S22 · Handle AFK players

The workbook asks for inactive players to be marked AFK so the game can
continue. This story builds on the gameplay branch's existing 30-second
turn deadline and check-or-fold rule.

The `turn-worker` Docker service checks saved deadlines once per second.
It rechecks each deadline under the same table lock as betting actions and
uses the existing game engine to check when no bet is owed or fold when
facing a bet. It also marks the seat **Sitting out**. The worker runs when
all browsers are closed. The frontend timer displays remaining time and
refreshes state after expiry. It shares the existing WebSocket notifications.

A sitting-out player keeps their seat and reserved chips. If they are still
in the current hand after an automatic check, subsequent turns are due
immediately while they are sitting out. They are skipped in the next deal.
The player can select **Resume play** to become eligible again. An expired
turn is resolved before resuming the seat. When two funded players are ready,
the engine starts another hand. Leaving to cash out follows the existing
seating rules.

The worker reads PostgreSQL deadlines rather than keeping timers in process
memory. Restarting the worker picks up deadlines that passed while it was
down. The worker uses the existing private WebSocket signal after the
transaction commits. Run one `turn-worker` service per deployment. The
table lock also prevents duplicate actions if a second worker runs.
The game screen includes the current hand and turn timestamp with each
betting action so a late click cannot affect a later turn.

## Two-player walkthrough

1. Run `docker compose up --build -d` and check `docker compose ps` for
   the running **turn-worker** and healthy **backend**.
2. Sign in as two funded demo players in separate browser sessions. Join
   the same public table and open **Open poker table** in both sessions.
3. With a bet to call, close **both** game tabs before the acting player
   responds. Wait about 35 seconds. Return using the other player's session.
   The hand should have settled, and the missed player should be listed
   under **Sitting out**. With just two seats, the game waits for one player
   to become ready before the next deal.
4. Reopen the missed player's play screen. Verify **You missed a turn and
   are sitting out** and that their remaining table chips are visible.
   Select **Resume play**. The label clears and the next hand starts.
5. To see automatic check, call the small blind in a fresh two-player hand
   and let the big blind's turn expire. The action list shows
   **Timed out: check** and the board advances.

Tested against Chris's `saia` gameplay branch at `dfdaeff`. Review S22 against
that branch until gameplay reaches `main`.

## Checks and evidence

```powershell
docker compose exec backend pytest tables/tests/test_gameplay.py tables/tests/test_live_updates.py tables/tests/test_seating.py -q
docker compose exec backend pytest --cov --cov-report=json:/tmp/s22-coverage.json --cov-report=html --junitxml=/tmp/s22-tests.xml -q
docker compose exec frontend npm run test:coverage -- --reporter=junit --outputFile=coverage/s22-tests.xml
```

| Full suite | Passed | Statements | Branches |
| --- | ---: | ---: | ---: |
| Backend | 569 | 95.19% (1,998/2,099) | 88.08% (458/520) |
| Frontend | 183 | 94.08% (1,065/1,132) | 88.12% (883/1,002) |

[Backend coverage image](s22-testing/backend-coverage.png) ·
[Frontend coverage image](s22-testing/frontend-coverage.png)

The play screen tests exercise AFK status, resuming, stale-turn protection,
and refreshing after a deadline. The PostgreSQL tests verify one-time
settlement, chip conservation, permissions, and automatic check/fold.
Build, lint, Django checks and migration drift checks passed. The Docker
worker started successfully. The story owner confirmed in the app that
players who miss their turn see the sitting-out message. The closed-tab and
resume paths were exercised by automated tests and remain demo steps.
Coverage images are calculated from the tool reports. Raw reports remain
in local ignored locations.
