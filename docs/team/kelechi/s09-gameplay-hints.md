# S9 · Get hints

The workbook's S9 criterion is that players can turn hints on and off.
The hints appear in the existing Texas Hold'em betting controls only when the
seated player can act. Each explanation corresponds to an action the server
currently allows. Call hints distinguish an ordinary call from a short-stack
all-in call, and raise hints describe the legal total bet for the round.

Hints default to on. The toggle saves a preference in this browser, including
across reloads. If browser storage is unavailable, the toggle works for the
current visit. It controls explanatory text. The betting buttons, turn timer
and game rules operate independently. The feature uses the existing
`viewer.legal_actions` response and adds no API or database fields.

## Try it

1. Run `docker compose up --build -d`. This branch uses the gameplay stack,
   including Redis and the gameplay migrations.
2. Sign in as two registered test players in separate browser sessions. Create
   a public table, seat both players, and open its play screen. A hand starts
   when two funded players are seated.
3. On the acting player's screen, find **Hints: On** at the top and
   **Available moves** in the betting controls. Call or bet, then verify the
   other player's explanations reflect the new legal actions and chip amounts.
4. Select **Hints: Off**. Verify the explanations disappear and the betting
   controls still work. Reload to verify your choice persists, then turn
   hints back on. Verify no action hints appear while the other player acts.

This branch is based on Chris's `saia` gameplay branch at `f8ca051`. Review the
S9 diff against that gameplay base. Delivery on `main` depends on integrating
the gameplay branch.

## Tests

```powershell
docker compose exec frontend npm test -- src/features/tables/GamePage.test.tsx
docker compose exec frontend npm run test:coverage -- --reporter=junit --outputFile=coverage/s9-tests.xml
docker compose exec backend pytest tables/tests/test_gameplay.py -q
```

The hint tests cover on/off, persisted preference, live legal-action updates,
short-stack calls, waiting turns, and blocked browser storage.

The full frontend run passed 180 tests with 92.49% statement and 86.59% branch
coverage. The new hint and preference modules reached 100% on both measures.
The full backend run passed 564 tests with 94.74% statement and 87.10% branch
coverage. It includes the 15 targeted gameplay tests. This run measures the
existing gameplay engine and API that S9 consumes. Build, lint, Django checks and
migration drift checks passed. The live Docker stack served the changed play
screen code and reported a healthy database. The story owner confirmed the
hints worked in a manual check at a two-player table.

[Frontend coverage image](s9-testing/frontend-coverage.png) ·
[Backend coverage image](s9-testing/backend-coverage.png)
