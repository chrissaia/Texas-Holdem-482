/**
 * Module: messages/types.ts.
 * S21 request and response contracts; mirrors the messaging section of docs/architecture/contracts.md.
 */
import type { Player, Presence } from '../friends/types'

export type DirectMessage = {
  id: number
  sender: Player
  body: string
  created_at: string
  /** Whether the recipient has opened the conversation since this was sent. */
  read: boolean
}

export type ConversationSummary = {
  friend: Player
  presence: Presence
  last_message: DirectMessage | null
  unread_count: number
}

export type ConversationList = {
  conversations: ConversationSummary[]
  unread_count: number
  csrf_token: string
}

export type Conversation = {
  friend: Player
  presence: Presence
  messages: DirectMessage[]
  csrf_token: string
}

export type TableChatMessage = { id: number; sender: Player; body: string; created_at: string }

export type TableChat = {
  table_id: number
  can_post: boolean
  player_count: number
  messages: TableChatMessage[]
  csrf_token: string
}

export type Sent<T> = { message: T; csrf_token: string }
