/**
 * Test helper: stub fetch while answering the S20 top-bar "friends online" poll.
 * The app shell polls /api/friends/online/ for signed-in players; tests that queue
 * responses in a fixed order use this so that poll never consumes one of them.
 */
import { vi } from 'vitest'

type Fetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

export function stubFetch(inner: Fetch) {
  vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit) =>
    String(input) === '/api/friends/online/'
      ? Promise.resolve(new Response(JSON.stringify({ online_count: 0 })))
      : inner(input, init))
}
