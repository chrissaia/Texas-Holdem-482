/**
 * Regression tests: messages/MessagesPage.test.tsx.
 * S21: friends can message each other; conversations update by polling.
 */
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, expect, test, vi } from 'vitest'
import { THREAD_POLL_MS } from './constants'
import { MessagesPage } from './MessagesPage'
import type { ConversationSummary, DirectMessage } from './types'

const me = { id: 1, username: 'river' }
const mira = { id: 2, username: 'Mira' }
const theo = { id: 3, username: 'Theo' }
const msg = (id: number, sender = mira, body = `message ${id}`, read = false): DirectMessage => ({
  id, sender, body, read, created_at: new Date().toISOString(),
})
const summary = (friend = mira, last: DirectMessage | null = msg(5), unread = 0): ConversationSummary => ({
  friend, presence: { status: 'offline', table: null }, last_message: last, unread_count: unread,
})
const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

type Handler = (url: URL, init?: RequestInit) => Response | Promise<Response> | undefined

function setup(handler: Handler = () => undefined, path = '/messages', list = [summary(mira, msg(5), 2), summary(theo, null)]) {
  const fetch = vi.fn().mockImplementation((input: string, init?: RequestInit) => {
    const url = new URL(input, 'http://localhost')
    const custom = handler(url, init)
    if (custom) return Promise.resolve(custom)
    if (url.pathname === '/api/messages/') return Promise.resolve(respond({ conversations: list, unread_count: 2, csrf_token: 'list-csrf' }))
    const friend = url.pathname.includes('/3/') ? theo : mira
    return Promise.resolve(respond({
      friend, presence: { status: 'at_table', table: { id: 9, name: 'Blue Hour', player_count: 4, max_players: 6, status: 'waiting' } },
      messages: url.searchParams.has('after') ? [] : friend === mira ? [msg(4), msg(5, me, 'See you there', true)] : [],
      csrf_token: 'thread-csrf',
    }))
  })
  vi.stubGlobal('fetch', fetch)
  render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/messages" element={<MessagesPage />} /></Routes></MemoryRouter>)
  return fetch
}
const posts = (fetch: ReturnType<typeof vi.fn>) => fetch.mock.calls.filter(([, init]) => init?.method === 'POST')
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })

test('lists conversations and opens the most recent one with its history', async () => {
  setup()
  const list = await screen.findByRole('navigation', { name: 'Messages' })
  const rows = within(list).getAllByRole('button')
  expect(rows.map((row) => row.textContent)).toEqual([expect.stringContaining('Mira'), expect.stringContaining('Say hello')])
  expect(within(list).getByLabelText('2 unread')).toBeVisible()
  const thread = await screen.findByRole('list', { name: 'Conversation with Mira' })
  expect(within(thread).getByText('message 4')).toBeVisible()
  expect(within(thread).getByText('See you there')).toBeVisible()
  expect(screen.getByText('Online · Playing Blue Hour')).toBeVisible()
  expect(screen.getByRole('link', { name: 'Join Table' })).toHaveAttribute('href', '/tables/9')
  expect(screen.getByText('Seen by Mira')).toBeVisible()
})

test('?with= opens a friend with no messages yet, and Enter sends with CSRF', async () => {
  const fetch = setup((_, init) =>
    init?.method === 'POST' ? respond({ message: msg(20, me, 'Hey Theo'), csrf_token: 'next-csrf' }, 201) : undefined,
  '/messages?with=3')
  expect(await screen.findByText('No messages yet. Say hello to Theo!')).toBeVisible()
  const box = screen.getByRole('textbox', { name: 'Message Theo' })
  fireEvent.change(box, { target: { value: 'line one' } })
  fireEvent.keyDown(box, { key: 'Enter', shiftKey: true })
  expect(posts(fetch)).toHaveLength(0)
  fireEvent.change(box, { target: { value: '  Hey Theo  ' } })
  fireEvent.keyDown(box, { key: 'Enter' })
  expect(await screen.findByText('Hey Theo')).toBeVisible()
  expect(posts(fetch)[0][0]).toBe('/api/messages/3/')
  expect(posts(fetch)[0][1]).toMatchObject({ body: JSON.stringify({ body: 'Hey Theo' }), headers: { 'X-CSRFToken': 'thread-csrf' } })
  expect(box).toHaveValue('')
})

test('choosing a conversation and filtering the list', async () => {
  setup()
  const list = await screen.findByRole('navigation', { name: 'Messages' })
  fireEvent.click(within(list).getByRole('button', { name: /Theo/ }))
  expect(await screen.findByRole('heading', { name: 'Theo' })).toBeVisible()
  fireEvent.change(screen.getByRole('searchbox', { name: 'Find a conversation' }), { target: { value: 'mi' } })
  expect(within(list).getAllByRole('button')).toHaveLength(1)
})

test('new messages arrive by polling', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  let next = false
  const fetch = setup((url) => url.searchParams.get('after') === '5' && next
    ? respond({ friend: mira, presence: { status: 'online', table: null }, messages: [msg(6, mira, 'Want to play?')], csrf_token: 't' })
    : undefined)
  await screen.findByText('See you there')
  next = true
  await act(async () => { await vi.advanceTimersByTimeAsync(THREAD_POLL_MS) })
  expect(await screen.findByText('Want to play?')).toBeVisible()
  expect(fetch.mock.calls.some(([path]) => String(path) === '/api/messages/2/?after=5')).toBe(true)
})

test('a refused send keeps the draft and explains why', async () => {
  setup((_, init) => init?.method === 'POST'
    ? respond({ non_field_errors: ["You're sending messages too quickly. Wait a few seconds and try again."] }, 429)
    : undefined)
  const box = await screen.findByRole('textbox', { name: 'Message Mira' })
  fireEvent.change(box, { target: { value: 'hi' } })
  fireEvent.click(screen.getByRole('button', { name: 'Send' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('too quickly')
  expect(box).toHaveValue('hi')
})

test('a non-friend conversation explains that only friends can be messaged', async () => {
  setup((url) => url.pathname === '/api/messages/77/' ? respond({ detail: 'Not found.' }, 404) : undefined, '/messages?with=77')
  expect(await screen.findByRole('alert')).toHaveTextContent('You can only message players who are your friends.')
})

test('signed-out visitors and players without friends are guided', async () => {
  setup((url) => url.pathname === '/api/messages/' ? respond({ detail: 'no' }, 403) : undefined)
  expect(await screen.findByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login')
})

test('a player with no friends is pointed to the Friends page', async () => {
  setup(undefined, '/messages', [])
  expect(await screen.findByRole('link', { name: 'Find friends →' })).toHaveAttribute('href', '/friends')
})

test('a failed list load can be retried', async () => {
  let fail = true
  setup((url) => url.pathname === '/api/messages/' && fail ? respond({}, 500) : undefined)
  expect(await screen.findByRole('alert')).toHaveTextContent('could not load your conversations')
  fail = false
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
  await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
})
