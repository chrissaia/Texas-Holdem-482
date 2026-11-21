/**
 * Module: messages/api.ts.
 * S21 HTTP operations: direct messages with friends and table chat.
 */
import { request } from '../../api/client'
import type { Conversation, ConversationList, DirectMessage, Sent, TableChat, TableChatMessage } from './types'

/** Message length limit, matching the server. */
export const MAX_MESSAGE_LENGTH = 500

const after = (id?: number) => (id ? `?after=${id}` : '')
const post = <T>(path: string, body: string, token: string) =>
  request<Sent<T>>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRFToken': token },
    body: JSON.stringify({ body }),
  })

export const getConversations = () => request<ConversationList>('/api/messages/')
/** Opening a conversation marks the friend's messages as read. Pass afterId to fetch only newer ones. */
export const getConversation = (friendId: number, afterId?: number) =>
  request<Conversation>(`/api/messages/${friendId}/${after(afterId)}`)
export const sendDirectMessage = (friendId: number, body: string, token: string) =>
  post<DirectMessage>(`/api/messages/${friendId}/`, body, token)

export const getTableChat = (tableId: number, afterId?: number) =>
  request<TableChat>(`/api/messages/tables/${tableId}/${after(afterId)}`)
export const sendTableMessage = (tableId: number, body: string, token: string) =>
  post<TableChatMessage>(`/api/messages/tables/${tableId}/`, body, token)
