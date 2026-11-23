/**
 * Module: tables/types.ts.
 * Shared request and response contracts for tables; no runtime behavior.
 */
export type Host = { id: number; username: string }
export type CreationContext = {
  host: Host | null
  csrf_token: string
  profile_summary?: { avatar_url: string | null; chip_balance: number } | null
}
export type TableInput = {
  name: string
  max_players: number
  buy_in: number
  minimum_balance: number
  small_blind: number
  big_blind: number
}
export type PokerTable = TableInput & {
  id: number
  host: Host
  is_public: boolean
  player_count: number
  status: 'waiting' | 'playing' | 'closed'
  created_at: string
  last_activity_at: string
}
export type FieldErrors = Partial<Record<keyof TableInput, string[]>>

export type TableList = {
  count: number
  next: string | null
  previous: string | null
  page: number
  page_size: number
  total_pages: number
  total_tables: number
  total_players: number
  results: PokerTable[]
}

export type GamePlayer = {
  user_id: number
  username: string
  stack: number
  round_bet: number
  folded: boolean
  all_in: boolean
  is_dealer: boolean
  is_turn: boolean
  hole_cards: string[] | null
  hand: string | null
  waiting: boolean
}

export type GameLegalActions = {
  fold: boolean
  check: boolean
  call: boolean
  raise: boolean
  all_in: boolean
  amount_to_call: number
  min_raise_to: number
  max_raise_to: number
}

export type ActivePokerGame = {
  id: number
  number: number
  street: 'preflop' | 'flop' | 'turn' | 'river' | 'complete'
  board: string[]
  pot: number
  current_bet: number
  min_raise: number
  dealer_user_id: number
  turn_user_id: number | null
  turn_started_at: string | null
  turn_deadline: string | null
  players: GamePlayer[]
  waiting_players: { user_id: number; username: string; stack: number; waiting: true }[]
  viewer: {
    user_id: number
    hole_cards: string[] | null
    hand: string | null
    legal_actions: GameLegalActions
  }
  actions: { username: string; kind: string; amount: number; street: string }[]
}

export type GameState = {
  viewer_id: number
  table: {
    id: number
    name: string
    is_public: boolean
    status: PokerTable['status']
    max_players: number
    player_count: number
    small_blind: number
    big_blind: number
  }
  game: ActivePokerGame | null
  last_hand: {
    number: number
    pot: number
    winners: { user_id: number; username: string; amount: number; hand: string | null }[]
    board: string[]
  } | null
  seated_players: { user_id: number; username: string; stack: number; is_sitting_out: boolean }[]
  csrf_token: string
}
