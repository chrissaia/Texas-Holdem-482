# S21: message other players

[Finn’s stories](README.md) · [All user stories](../../stories.md)

> As a player, I want to message friends and people at my table, so that I can talk to people while playing.
> Done when players can message friends and use table chat.

## What was built

**Direct messages** at `/messages`, opened from the sidebar's **Messages** item or a friend card's **Message** button:
- **Conversation list:** every friend, with their last message, time, unread count and online dot. Recent conversations come first, and you can search the list by name.
- **Conversation:** history, the friend's status (for example "Online · Playing Blue Hour" with a **Join Table** link), and "Seen by …" once they've read your last message.
- **Composer:** Enter sends, Shift+Enter adds a new line, with a 500-character counter.
- **Updates:** new messages appear within about 4 seconds, and opening a conversation marks it read.
- **Achievement:** your first message earns the "Say Hello" achievement.

**Table chat** on each table's page:
- Anyone who can see the table can read along. Seated players can type messages or use quick replies (Nice hand!, Good game, Wow, GG, Nice bluff, Let’s go).
- Taking or leaving a seat turns posting on or off at the next refresh.

## Rules

- Only accepted friends can message each other. After unfriending, the conversation is hidden until you're friends again.
- Private table chat is visible only to the host and invited players.
- Messages are 1–500 characters. Each player can send at most 5 messages per 10 seconds, to stop spam.
- Guests can't use messages.

See the S21 section of [the contracts](../../architecture/contracts.md#s21-messages-and-table-chat) for the full interface.

## Design

Follows Figma frames 18:15971 (Private messaging) and 12:2106 (Table chat panel). The "Invite to Table" card, the Friends Chat tab and Mute/Report are left for later stories. Table chat sits under the seat panel because there is no game table yet.

## Try it

```bash
docker compose up -d
docker compose exec backend python manage.py migrate
```

1. With two friend accounts (one in a private window), click **Message** on a friend's card and send a message. It appears in the other window within a few seconds, and "Seen by …" appears after they open it.
2. Both players join the same table. Use the quick replies and the message box in **Table chat**. A third account that isn't seated can read but not post.

## Tests

- Backend: `backend/messaging/tests/test_messaging.py` (31 tests) covers friend-only access, unfriending, privacy between conversations, read receipts, ordering and unread counts, polling and paging, validation and the 500-character limit, rate limits, the "Say Hello" achievement, CSRF, guests, methods, account deletion, seated-only posting, per-table chat, and private tables.
- Frontend: `frontend/src/features/messages/` (MessagesPage, TableChat and format tests).

```bash
docker compose exec backend pytest messaging
docker compose exec frontend npm test -- src/features/messages
```

## Open decisions

Blocking, reporting, muting and deleting messages aren't built. The rate limit and the length limit still need team agreement.
