# S3: see the disclaimer

[Finn’s stories](README.md) · [All user stories](../../stories.md)

> As a player, I want to see and accept the play money disclaimer, so that I know what the game is.
> Done when users have to accept the disclaimer before playing.

## What was built

- **Server-enforced gate:** joining a table (`POST /api/tables/<id>/seat/`) returns 403 with `code: "disclaimer_required"` until the player accepts. No chips move. Leaving a table is never blocked.
- **Saved acceptance:** `accounts.User.disclaimer_accepted_at` (migration `0004`) is set the first time an account accepts. It carries across logins and devices. Guest acceptance lasts only for the guest session.
- **Endpoint:** `POST /api/auth/disclaimer/` with `{}` and the CSRF token. The session response (`GET /api/auth/session/`) now includes `disclaimer_accepted`.
- **Dialog:** clicking **Join table** before accepting opens a "Before you take a seat" dialog. **I accept** stays disabled until the player checks the play-money and age confirmation. Accepting saves the acceptance and then joins. **Not now** or Escape closes the dialog without joining.
- **Page:** anyone can read the disclaimer at `/disclaimer`, linked from the sidebar's "Play money only" note. Signed-in players and guests can accept it there.

See the S3 section of [the contracts](../../architecture/contracts.md#s3-play-money-disclaimer) for the full interface.

## Design

There is no disclaimer frame in Figma. The age wording matches the Register screen's "Age confirmation" checkbox (frame 12:778). The dialog uses the shared panel, button and notice styles.

## Try it

```bash
docker compose up -d
docker compose exec backend python manage.py migrate
```

Register a new account, claim chips at `/rewards`, open a table from `/lobby`, and click **Join table**.

## Tests

- Backend: `backend/accounts/tests/test_disclaimer.py` covers saved acceptance, the guest session and logout, guest acceptance not carrying into a login, anonymous access, extra fields, CSRF, method, and joining before and after acceptance.
- Frontend: `frontend/src/features/disclaimer/DisclaimerPage.test.tsx` and the S3 tests in `frontend/src/features/tables/SeatPanel.test.tsx`.

```bash
docker compose exec backend pytest accounts/tests/test_disclaimer.py tables/tests
docker compose exec frontend npm test -- src/features/disclaimer src/features/tables/SeatPanel.test.tsx
```

## Open decisions

The disclaimer text has no version number, and the age confirmation is self-declared. Existing accounts must accept before their next join.
