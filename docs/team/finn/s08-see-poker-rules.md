# S8: see poker rules

[Finn’s stories](README.md) · [All user stories](../../stories.md)

> As a new player, I want to see the rules and hand rankings, so that I can learn how to play.
> Done when there is a rules page that explains poker.

## What was built

- A public page at `/tutorial`, linked from the sidebar's **Tutorial** item and the mobile **Rules** link. `/rules` redirects there. Anyone can open it: signed in, guest, or anonymous.
- **Learning path:** nine lessons (Poker Basics, Hand Rankings, Blinds, Betting, Flop, Turn, River, Showdown, Poker Strategy Basics) with previous/next buttons, a progress bar and Restart. The last lesson links to the lobby.
- **Complete hand reference:** all ten hands from Royal Flush to High Card, each with an example five-card hand and a description. Cards have screen-reader names such as "Ace of spades".
- **Field guide:** a one-line summary of each lesson. Selecting a summary opens that lesson.

The content lives in `frontend/src/features/rules/content.ts` so it can be reused later, for example by tutorial practice.

## Design

Follows Figma frame 26:3716 (RIVR — Tutorial). The guided-practice poker table with bots is left out because there are no bots or gameplay yet (S24). Lesson progress is not saved; it resets when the page reloads.

## Try it

```bash
docker compose up -d
```

Open http://localhost:5173/tutorial.

## Tests

`frontend/src/features/rules/RulesPage.test.tsx` checks the ranking order and card count, that each example hand has five distinct cards, lesson navigation and progress, the final lobby link, and Restart.

```bash
docker compose exec frontend npm test -- src/features/rules
```
