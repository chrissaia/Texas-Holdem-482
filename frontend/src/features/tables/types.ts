export type Host = { id: number; username: string }
export type CreationContext = { host: Host | null; csrf_token: string }
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
