# S13 - Public table creation

## Story record

- Planned owner: Chris.
- Workbook source: [User_Stories.xlsx](../../reference/User_Stories.xlsx), `User Stories!A15:M15`.
- Workbook points: 2; planned sprint points: 2.
- Priority: High; epic: E9; NFR references: NFR5, NFR9, NFR10, NFR11.
- Tracked issue: [#27](https://github.com/chrissaia/Texas-Holdem-482/issues/27).

**User story:** as a host, i want to create a public table, so that other players can join my game.

**Workbook acceptance target:** done when hosts can make a table and choose the settings.

The workbook is a planning snapshot, not a live acceptance record. Only professor/CTO acceptance establishes Done. Owner names describe the supplied plan, not inferred commit authorship.

## Feature guide

Chris's Iteration 1 stories are S13 public table creation (2 points) and S10 browse public tables (2 points). This change implements S13 for team review; professor acceptance remains pending. S10 listing/filtering is implemented separately; see [the lobby guide](s10-browse-public-tables.md).

## Try it locally

From the repository root, with Docker Desktop running and the root `.env` configured as described in `README.md`:

```bash
docker compose up --build -d
docker compose exec frontend npm ci
docker compose restart frontend
docker compose exec backend python manage.py migrate
```

Use `/register` to create a normal account or `/login` for an existing one. Finn's real account UI is integrated; a staff account is not required to host. For administrator cleanup only, create a local staff/superuser with `docker compose exec backend python manage.py createsuperuser` after migrations. Keep credentials out of commits.

1. Open http://localhost:5173/tables/create.
2. If signed out, select **Sign in** and use the regular account login. After signing in, return to **Create Table** from Home.
3. Enter a name, choose seats, and configure chip values. Example: 6 seats, 1,000 buy-in, 1,000 minimum balance, 25 small blind, 50 big blind.
4. Select **Create Table**. The button disables while saving, and a successful response shows **Table created!**.
5. Select **View your table** and refresh, or **See it in the lobby** to browse the newly saved table. The settings are fetched from PostgreSQL again.
6. To exercise validation, try a blank name, 51 big blind with 25 small blind, or a minimum balance below the buy-in. No invalid table is stored.

Anonymous and guest visitors can configure the form but cannot create a table. Session expiry, CSRF failures, unavailable API responses, and field errors produce feedback while retaining inputs. The form does not automatically retry writes after a network failure: check for an existing table before manually retrying if a connection was lost during submission.

The home page links to creation. Cancel returns home without submitting. A successful creation cannot be resubmitted accidentally; **Create another table** resets the form.

## Approved settings and behavior

- Names are trimmed and must contain 1–80 characters; duplicate names are allowed.
- Capacity: 2, 4, 6, 8, or 9, matching Figma's explicit choices.
- Positive whole-chip amounts only; maximum 2,147,483,647. Small blind is capped at half that maximum.
- Big blind equals twice small blind; buy-in is at least big blind; minimum balance is at least buy-in.
- Server derives host from the active registered user's session. Anonymous, inactive, and explicitly marked guests cannot create.
- New tables are public, waiting, and empty. Creation does not seat the host, debit a balance, create bots/invites, or start poker gameplay.

Validation runs in the React form, DRF/model validation, and PostgreSQL constraints. The last layer protects direct database writes too. Tables protect their host foreign key against accidental deletion. See `docs/architecture/contracts.md` for occupancy/activity and guest handoffs.

## Files and architecture

```text
backend/tables/
  models.py                 Settings, relational host, constraints, activity data
  serializers.py            Input validation and public response contract
  permissions.py            Registered-host boundary
  views.py / urls.py        Creation, CSRF/context, public detail
  admin.py                  Standard Django admin integration
  migrations/0001_initial.py
  tests/test_creation.py
frontend/src/
  api/client.ts             Same-origin fetch and structured errors
  components/               Reusable form fields and application shell
  features/tables/          Typed API, validation, form, saved details, tests
  assets/figma/             Downloaded SVG design assets
  index.css / App.css       Shared tokens and responsive layouts
```

React Router provides `/`, `/tables/create`, and `/tables/:id`. The API uses the existing Vite proxy and session cookies; it adds no JWT, CORS dependency, or replacement login flow. Fonts are bundled locally through Fontsource packages.

## HTTP contract

`GET /api/tables/creation-context/` returns `{host: {id, username} | null, csrf_token}` and sets the CSRF cookie. Its response disables caching. The form sends that token in `X-CSRFToken`.

`POST /api/tables/` accepts:

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

Success is HTTP 201 with those settings plus ID, public host, visibility, occupancy, waiting status, and UTC timestamps. Invalid data is HTTP 400 with arrays of field errors. Unknown and server-controlled input fields (including host and status) are rejected. Anonymous/guest/session/CSRF failures use HTTP 403 under DRF SessionAuthentication.

`GET /api/tables/<id>/` reads public settings. Private/missing IDs return HTTP 404. This supports confirmation and persistence checks, alongside S10's public list API.

## Tests and measured evidence

```bash
docker compose exec backend python manage.py check
docker compose exec backend python manage.py makemigrations --check --dry-run
docker compose exec backend pytest --cov --cov-report=term-missing --cov-report=html
```

From `frontend/`:

```bash
npm run build
npm run lint
npm run test:coverage
```

Historical S13 measurements are recorded in `s13-verification.md`. For current full-application reports, including the previously excluded bootstrap files, see [quality evidence](../../quality/README.md). Historical narrow results are not evidence for unimplemented stories or the final team release.

## Design and scope

Implemented from Figma file `Rpni0LkJsoCyH7MSfLUKgb`, Create Table frame `12:1619`, with table details `12:1704` inspected separately. Colors, fonts, shell, spacing, controls, and two-column panels follow the design. Desktop, tablet, and phone layouts were checked.

Intentional scope adaptations: public selection replaces the mockup's private selection; the invitation panel becomes public-table information; bots are unavailable; the summary does not claim that chips are transferred; account identity comes from the actual session instead of the design's sample RiverJay/balance/XP. Other navigation items remain unavailable until their stories are implemented. Light/dark theme selection and saved preference remain Kelechi's S35; this change supplies shared CSS variables without implementing that story.
