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
