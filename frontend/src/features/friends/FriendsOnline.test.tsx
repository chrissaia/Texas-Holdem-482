/**
 * Regression tests: friends/FriendsOnline.test.tsx.
 * S20: the top-bar count of friends online, which also keeps the player online by polling.
 */
import { act, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, test, vi } from 'vitest'
import { FriendsOnline, ONLINE_POLL_MS } from './FriendsOnline'

const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
const show = () => render(<MemoryRouter><FriendsOnline /></MemoryRouter>)
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })

test('shows the count with a link to the friends page', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respond({ online_count: 6 })))
  show()
  expect(await screen.findByRole('link', { name: '6 friends online' })).toHaveAttribute('href', '/friends')
})

test('uses the singular for one friend', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respond({ online_count: 1 })))
  show()
  expect(await screen.findByText('1 friend online')).toBeVisible()
})

test('polls for updates and hides itself when the request fails', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  const fetch = vi.fn()
    .mockResolvedValueOnce(respond({ online_count: 2 }))
    .mockResolvedValueOnce(respond({ online_count: 4 }))
    .mockResolvedValueOnce(respond({ detail: 'Forbidden' }, 403))
  vi.stubGlobal('fetch', fetch)
  show()
  expect(await screen.findByText('2 friends online')).toBeVisible()
  await act(async () => { await vi.advanceTimersByTimeAsync(ONLINE_POLL_MS) })
  expect(await screen.findByText('4 friends online')).toBeVisible()
  await act(async () => { await vi.advanceTimersByTimeAsync(ONLINE_POLL_MS) })
  expect(screen.queryByRole('link')).not.toBeInTheDocument()
  expect(fetch).toHaveBeenCalledWith('/api/friends/online/', expect.anything())
})
