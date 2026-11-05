import { request } from '../../api/client'
import type { FriendsResponse, RequestAction } from './types'

// Every write answers with the full, current lists and a fresh CSRF token.
const write = (path: string, token: string, init: RequestInit) =>
  request<FriendsResponse>(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', 'X-CSRFToken': token },
  })

export const getFriends = () => request<FriendsResponse>('/api/friends/')
export const sendFriendRequest = (username: string, token: string) =>
  write('/api/friends/requests/', token, {
    method: 'POST',
    body: JSON.stringify({ username }),
  })
export const answerRequest = (
  id: number,
  action: RequestAction,
  token: string,
) =>
  write(`/api/friends/requests/${id}/${action}/`, token, {
    method: 'POST',
    body: '{}',
  })
export const removeFriend = (id: number, token: string) =>
  write(`/api/friends/${id}/`, token, { method: 'DELETE' })

export const searchPlayers = (query: string) =>
  request<{ results: { id: number; username: string }[] }>(
    `/api/friends/search/?${new URLSearchParams({ q: query })}`,
  )
