/**
 * Module: friends/types.ts.
 * Shared request and response contracts for friends; no runtime behavior.
 */
export type Player = { id: number; username: string }

export type FriendEntry = { id: number; player: Player; created_at: string }

/** S20: a table the viewer is allowed to see, where a friend is seated. */
export type PresenceTable = {
  id: number
  name: string
  player_count: number
  max_players: number
  status: 'waiting' | 'playing' | 'closed'
}
export type Presence = {
  status: 'online' | 'at_table' | 'offline'
  table: PresenceTable | null
}
/** Accepted friends carry presence; pending requests never do. */
export type Friend = FriendEntry & { presence: Presence }

export type FriendsResponse = {
  friends: Friend[]
  online_count: number
  incoming: FriendEntry[]
  outgoing: FriendEntry[]
  csrf_token: string
}

export type RequestAction = 'accept' | 'decline' | 'cancel'
