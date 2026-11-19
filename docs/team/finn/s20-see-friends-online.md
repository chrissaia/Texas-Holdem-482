# S20: see friends online

[Finn’s stories](README.md) · [All user stories](../../stories.md)

> As a player, I want to see which friends are online or at a table, so that I can find and play with them.
> Done when players can see if their friends are online.

## What was built

- **Status on every friend card:** a **Playing**, **Online** or **Offline** badge, a green dot on online friends' avatars, and one line about what they're doing, such as "Blue Hour · 4 / 6 players" or "Browsing RIVR".
- **Join Game:** for a friend at a table you can see, this opens that table so you can take a seat. Full tables show a disabled **Table full** instead.
- **Online tab:** shows only friends who are online, with friends at a table listed first. It shows a message when nobody is online.
- **Top bar:** "N friends online" on every page, linking to `/friends`.
- **Live updates by polling:** the friends page refreshes every 15 seconds and the top bar every 30. Any API request from a signed-in player keeps them online. Players go offline 3 minutes after their last activity, or immediately when they log out.

## Privacy

Only accepted friends see your status. Pending requests and strangers never do. Friends see which table you're at only if they could see that table themselves, so a private table you were invited to stays hidden from friends who weren't invited. Responses expose only `{id, username}`.

See the S20 section of [the contracts](../../architecture/contracts.md#s20-friends-online) for the full interface.

## Design

Follows Figma frame 18:15681: the Online tab, PLAYING/ONLINE badges, presence dots, table activity lines, Join Game, and the top-bar count. The All Friends tab stays the default so friend management is the first thing you see. Level and Recently Played still depend on other stories.

## Try it

```bash
docker compose up -d
docker compose exec backend python manage.py migrate
```

1. Make two accounts. In a private browser window, sign in as the second account, then add each other as friends at `/friends`.
2. In the first window, the friend shows as **Online**, and the top bar shows "1 friend online".
3. In the second window, open a table and join it. Within 15 seconds the first window shows **Playing** with the table name and **Join Game**.
4. Log out in the second window. Within 15 seconds the friend shows **Offline**.

## Tests

- Backend: `backend/friends/tests/test_presence.py` covers login and logout, the 3-minute window, middleware activity, guests and non-API requests, write throttling, public and private tables, seated-but-offline friends, pending requests and strangers, endpoint permissions and methods, and account deletion.
- Frontend: S20 tests in `frontend/src/features/friends/FriendsPage.test.tsx` and `FriendsOnline.test.tsx`. `frontend/src/test/fetch.ts` answers the top-bar poll for tests that queue mock responses in order.

```bash
docker compose exec backend pytest friends
docker compose exec frontend npm test -- src/features/friends
```

## Open decisions

There is no "appear offline" setting yet. The 3-minute online window and the polling intervals still need team agreement.
