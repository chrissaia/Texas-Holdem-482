/**
 * Module: messages/format.ts.
 * Shared helpers for showing messages.
 */
import { ApiError } from '../../api/client'

/** "20:42" for today, otherwise "Nov 18, 20:42". */
export function messageTime(iso: string, now = new Date()) {
  const date = new Date(iso)
  const time = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
  return date.toDateString() === now.toDateString()
    ? time
    : `${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${time}`
}

/** Add newly polled or sent messages, skipping any already shown. */
export function mergeMessages<T extends { id: number }>(current: T[], incoming: T[]) {
  const seen = new Set(current.map((m) => m.id))
  const added = incoming.filter((m) => !seen.has(m.id))
  return added.length ? [...current, ...added].sort((a, b) => a.id - b.id) : current
}

/** A readable reason a send failed. */
export function sendError(cause: unknown) {
  if (cause instanceof ApiError) {
    const field = cause.body.body ?? cause.body.non_field_errors
    if (Array.isArray(field) && typeof field[0] === 'string') return field[0]
    if (cause.status === 404) return 'You can only message players who are your friends.'
    if (cause.status === 403) return 'Your session changed. Refresh the page and sign in again.'
  }
  return cause instanceof Error ? cause.message : 'Your message was not sent. Try again.'
}
