/**
 * Module: rules/content.ts.
 * S8 poker rules content: the learning-path lessons and the ten Texas Hold'em hand rankings.
 * Kept as plain data so the page, tests, and future tutorial practice can share one source.
 */

export type Suit = 'spades' | 'hearts' | 'diamonds' | 'clubs'
export type Card = { rank: string; suit: Suit }

export type Lesson = {
  id: string
  title: string
  summary: string
  details: string[]
}

export type HandRank = {
  name: string
  description: string
  example: Card[]
}

/** Shorthand for writing example hands, e.g. card('A', 'spades'). */
const card = (rank: string, suit: Suit): Card => ({ rank, suit })

export const LESSONS: Lesson[] = [
  {
    id: 'basics',
    title: 'Poker Basics',
    summary: 'Make the best five-card hand using any combination of your two hole cards and five community cards.',
    details: [
      'Each player is dealt two private cards, called hole cards. Five shared community cards are dealt face up in the middle of the table over the course of the hand.',
      'Your hand is the best five cards you can make from those seven cards. You can use both, one, or neither of your hole cards.',
      'You win the pot by having the best hand at showdown, or by betting so that every other player folds.',
    ],
  },
  {
    id: 'rankings',
    title: 'Hand Rankings',
    summary: 'From Royal Flush to High Card, stronger hands beat weaker hands. Equal ranks use kickers.',
    details: [
      'There are ten hand categories. Any hand in a higher category beats every hand in a lower one, so a Flush beats any Straight.',
      'When two players have the same category, the higher cards win. For example, a pair of Kings beats a pair of Queens.',
      'If the main cards are tied, the remaining cards (kickers) decide the winner. If all five cards tie, the pot is split.',
    ],
  },
  {
    id: 'blinds',
    title: 'Blinds',
    summary: 'The small and big blinds are forced bets that start the pot. The dealer button moves each hand.',
    details: [
      'The player to the left of the dealer button posts the small blind. The next player posts the big blind, which is twice the small blind on RIVR tables.',
      'Blinds make sure there is always something to play for. After each hand, the button and the blinds move one seat to the left.',
    ],
  },
  {
    id: 'betting',
    title: 'Betting',
    summary: 'Fold, check, call, raise or go all-in. Check only when there is no bet to match.',
    details: [
      'Fold: give up your hand and any chips you have already put in.',
      'Check: pass the action without betting. You can only check when nobody has bet in this round.',
      'Call: match the current bet. Raise: increase the bet so others must match it again.',
      'All-in: bet every chip you have at the table. You can only win as much from each opponent as you put in.',
      'A betting round ends when every remaining player has put in the same amount or is all-in.',
    ],
  },
  {
    id: 'flop',
    title: 'Flop',
    summary: 'Three community cards are dealt face up, followed by another betting round.',
    details: [
      'Before the flop, there is a first betting round (pre-flop) that starts with the player to the left of the big blind.',
      'After it ends, three community cards are dealt at once. From the flop onward, betting starts with the first active player to the left of the button.',
    ],
  },
  {
    id: 'turn',
    title: 'Turn',
    summary: 'A fourth community card is dealt. Betting continues with the remaining players.',
    details: [
      'The turn is a single card added to the board. Players now have six cards to choose their best five from.',
      'Another betting round follows, starting with the first active player to the left of the button.',
    ],
  },
  {
    id: 'river',
    title: 'River',
    summary: 'The fifth and final community card is dealt, followed by the last betting round.',
    details: [
      'After the river, every player has seven cards available: two hole cards and five community cards.',
      'This is the last chance to bet. If more than one player remains after this round, the hand goes to showdown.',
    ],
  },
  {
    id: 'showdown',
    title: 'Showdown',
    summary: 'Remaining players reveal their cards. The best five-card hand wins; ties split the pot.',
    details: [
      'Players still in the hand reveal their hole cards. Each player’s best five-card hand is compared using the hand rankings.',
      'The best hand wins the pot. If two or more players have exactly the same five-card hand, they split the pot equally.',
      'Suits never break ties. A spade flush and a heart flush with the same ranks are equal.',
    ],
  },
  {
    id: 'strategy',
    title: 'Poker Strategy Basics',
    summary: 'In practice, explore position, starting hands and pot odds. Learn at your own pace.',
    details: [
      'Position: acting later in a betting round gives you more information, so you can play more hands from late position.',
      'Starting hands: high pairs and high suited cards are strong. Many weak hands are best folded before the flop.',
      'Pot odds: compare the cost of a call to the size of the pot to decide whether a call is worth it.',
      'RIVR uses virtual chips only, so it is a safe place to practice.',
    ],
  },
]

/** Strongest to weakest, matching the Figma hand reference. */
export const HAND_RANKINGS: HandRank[] = [
  { name: 'Royal Flush', description: 'Ace-high straight flush', example: [card('A', 'spades'), card('K', 'spades'), card('Q', 'spades'), card('J', 'spades'), card('10', 'spades')] },
  { name: 'Straight Flush', description: 'Five consecutive cards, one suit', example: [card('9', 'hearts'), card('8', 'hearts'), card('7', 'hearts'), card('6', 'hearts'), card('5', 'hearts')] },
  { name: 'Four of a Kind', description: 'Four cards of the same rank', example: [card('A', 'spades'), card('A', 'hearts'), card('A', 'diamonds'), card('A', 'clubs'), card('K', 'spades')] },
  { name: 'Full House', description: 'Three of a kind plus a pair', example: [card('K', 'spades'), card('K', 'hearts'), card('K', 'diamonds'), card('2', 'clubs'), card('2', 'hearts')] },
  { name: 'Flush', description: 'Five cards of one suit', example: [card('A', 'clubs'), card('J', 'clubs'), card('8', 'clubs'), card('5', 'clubs'), card('2', 'clubs')] },
  { name: 'Straight', description: 'Five consecutive ranks', example: [card('9', 'spades'), card('8', 'hearts'), card('7', 'diamonds'), card('6', 'clubs'), card('5', 'spades')] },
  { name: 'Three of a Kind', description: 'Three cards of the same rank', example: [card('Q', 'spades'), card('Q', 'hearts'), card('Q', 'diamonds'), card('8', 'clubs'), card('2', 'spades')] },
  { name: 'Two Pair', description: 'Two different pairs', example: [card('A', 'spades'), card('A', 'hearts'), card('10', 'diamonds'), card('10', 'clubs'), card('2', 'spades')] },
  { name: 'One Pair', description: 'Two cards of the same rank', example: [card('J', 'spades'), card('J', 'hearts'), card('9', 'diamonds'), card('6', 'clubs'), card('2', 'spades')] },
  { name: 'High Card', description: 'No other combination', example: [card('A', 'spades'), card('J', 'hearts'), card('9', 'diamonds'), card('6', 'clubs'), card('2', 'spades')] },
]

export const SUIT_SYMBOLS: Record<Suit, string> = { spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣' }

const RANK_NAMES: Record<string, string> = { A: 'Ace', K: 'King', Q: 'Queen', J: 'Jack' }

/** Screen-reader name for a card, e.g. "Ace of spades". */
export function cardLabel({ rank, suit }: Card) {
  return `${RANK_NAMES[rank] ?? rank} of ${suit}`
}
