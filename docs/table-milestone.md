# Chris's next milestone: S13 table creation backend

Status: design inspected; proposed contract awaiting the table-rule and access decisions below. No table model or endpoint has been implemented by this review.

## Direct design references

Inspected using Figma design context and screenshots:

- [Create Table, frame 12:1619](https://www.figma.com/design/Rpni0LkJsoCyH7MSfLUKgb/texas-holdem-ui?node-id=12-1619)
- [Table details, node 12:1704](https://www.figma.com/design/Rpni0LkJsoCyH7MSfLUKgb/texas-holdem-ui?node-id=12-1704)
- [Poker Lobby, frame 12:1291](https://www.figma.com/design/Rpni0LkJsoCyH7MSfLUKgb/texas-holdem-ui?node-id=12-1291)

The table form contains table name, game type, privacy, seat options **2, 4, 6, 8, 9**, starting buy-in, minimum balance, small blind, and big blind. Its example selects 6 seats and shows 1,000 buy-in, 1,000 minimum balance, and 25/50 blinds. These displayed examples do not define all legal ranges or relationships.

The lobby shows table name, host, stakes, blinds, buy-in, occupancy, size, friends, status, and actions. It includes search, sort, buy-in/blind/player filters, available-seat/public/friends/bot controls, and pagination. Static example rows and balances are design content, not application data.

The form mockup selects a private table and includes bot configuration, invitations, and chip transfer on creation. Sprint 1 public-table creation will use the public option. Private invitations, bots, seating, and chip transfer need their own implemented stories; the UI must not claim those actions occurred. Friends counts, affordability, quick joining, and spectating also depend on features outside Chris's current milestone.

## Proposed contract — not yet agreed

`POST /api/tables/` creates a public Texas Hold'em table. Django derives the host from the session. Body fields:

```json
{
  "name": "Friday poker",
  "max_players": 6,
  "buy_in": 1000,
  "minimum_balance": 1000,
  "small_blind": 25,
  "big_blind": 50
}
```

Proposed rules needing the student's decision:

- Trim the name; require 1–80 characters. Duplicate display names are allowed; IDs identify tables.
- Capacity is one of the five explicit design choices.
- Chip amounts are positive integers; big blind equals twice small blind; buy-in is at least big blind; minimum balance is at least buy-in. These numeric relationships are proposals, not statements from Figma or the workbook.
- Authenticated registered users may create; anonymous users may browse. Guest creation stays denied unless Finn's guest contract explicitly enables it.
- Creation does not seat the host, move chips, or start a game. Occupancy begins at zero.

After agreement, also document the integer storage limit, invalid/unknown-field behavior, host-deletion policy, status representation, and activity updates before writing migrations. Server-controlled fields include ID, host, occupancy, status, visibility, and timestamps. Clients cannot override them.

Success: HTTP 201 with the saved table, public host ID/username, and server fields. Invalid input: HTTP 400 with field-keyed error arrays. Session-authenticated writes retain CSRF enforcement. Unauthorized writes follow the existing DRF session permission behavior.

The milestone includes a read-back endpoint for verification. Full lobby retrieval, filtering, sorting, and pagination are the following S10 milestone; S11 remains a separate story in the workbook and no extra points are implicitly claimed.

## Planned implementation files

```text
backend/tables/
  models.py                 Persistent table settings and database constraints
  serializers.py            Request validation and public response fields
  views.py                  Session-protected creation and read-back
  urls.py                   Table API routes
  admin.py                  Standard Django admin registration
  migrations/0001_initial.py
  tests/test_creation.py    PostgreSQL-backed acceptance tests
```

Register the app and routes in `backend/config/`, and extend `backend/pytest.ini` and `backend/.coveragerc` so tests and coverage include it. Keep users in Finn's existing custom model, referenced through `settings.AUTH_USER_MODEL`.

Use the normal Django admin session for local API development until Finn's real login UI exists. This is a development workflow using Django's authentication, not a new login implementation or identity bypass.

## Verification for this milestone

Test successful creation and database persistence; all agreed invalid boundaries and input types; unauthenticated denial; attempted host/occupancy/status overrides; enforced session CSRF; safe host serialization; and read-back of the created table. Exercise database constraints directly where they protect writes outside the API. Record actual PostgreSQL test results and coverage scope.

```bash
docker compose exec backend python manage.py makemigrations tables
docker compose exec backend python manage.py migrate
docker compose exec backend python manage.py check
docker compose exec backend pytest --cov --cov-report=term-missing
```

These are planned commands for after implementation; they have not yet been run for a tables app. The next checkpoint is a working, tested creation API. The React form follows after that checkpoint, using the inspected design and locally downloaded Figma assets.
