/**
 * Module: friends/api.ts.
 * Typed HTTP operations for friends, using the shared same-origin API client.
 */
import { request } from '../../api/client'
import type { FriendsResponse, RequestAction } from './types'

// Every write answers with the full, current lists and a fresh CSRF token.
/** Send a CSRF-protected friendship mutation and return the updated lists. */
const write = (path: string, token: string, init: RequestInit) =>
  request<FriendsResponse>(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', 'X-CSRFToken': token },
  })

/** Fetch the current player's accepted, incoming and outgoing friend lists. */
export const getFriends = () => request<FriendsResponse>('/api/friends/')
/** Send a CSRF-protected request to the chosen registered username. */
export const sendFriendRequest = (username: string, token: string) =>
  write('/api/friends/requests/', token, {
    method: 'POST',
    body: JSON.stringify({ username }),
  })
/** Accept, decline or cancel the selected friendship request. */
export const answerRequest = (
  id: number,
  action: RequestAction,
  token: string,
) =>
  write(`/api/friends/requests/${id}/${action}/`, token, {
    method: 'POST',
    body: '{}',
  })
/** Delete a friendship belonging to the current player. */
export const removeFriend = (id: number, token: string) =>
  write(`/api/friends/${id}/`, token, { method: 'DELETE' })

export const searchPlayers = (query: string) =>
  request<{ results: { id: number; username: string }[] }>(
    `/api/friends/search/?${new URLSearchParams({ q: query })}`,
  )
