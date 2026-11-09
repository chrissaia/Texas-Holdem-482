/**
 * Module: friends/types.ts.
 * Shared request and response contracts for friends; no runtime behavior.
 */
export type Player = { id: number; username: string }

export type FriendEntry = { id: number; player: Player; created_at: string }

export type FriendsResponse = {
  friends: FriendEntry[]
  incoming: FriendEntry[]
  outgoing: FriendEntry[]
  csrf_token: string
}

export type RequestAction = 'accept' | 'decline' | 'cancel'
