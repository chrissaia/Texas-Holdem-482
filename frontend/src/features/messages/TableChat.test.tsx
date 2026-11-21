/**
 * Regression tests: messages/TableChat.test.tsx.
 * S21: anyone who can see a table reads its chat; seated players post.
 */
import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, test, vi } from 'vitest'
import { THREAD_POLL_MS } from './constants'
import { TableChat } from './TableChat'

const line = (id: number, body: string) => ({ id, body, sender: { id: 2, username: 'Mira' }, created_at: new Date().toISOString() })
const chat = (extra = {}) => ({ table_id: 9, can_post: true, player_count: 2, messages: [line(1, 'Nice hand!')], csrf_token: 'chat-csrf', ...extra })
const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
const show = () => render(<MemoryRouter><TableChat tableId={9} /></MemoryRouter>)
const posts = (fetch: ReturnType<typeof vi.fn>) => fetch.mock.calls.filter(([, init]) => init?.method === 'POST')
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })

test('seated players can send typed messages and quick replies', async () => {
  const fetch = vi.fn().mockImplementation((_: string, init?: RequestInit) => Promise.resolve(
    init?.method === 'POST'
      ? respond({ message: line(posts(fetch).length + 10, JSON.parse(String(init.body)).body), csrf_token: 'chat-csrf' }, 201)
      : respond(chat()),
  ))
  vi.stubGlobal('fetch', fetch)
  show()
  expect(await screen.findByText('Nice hand!', { selector: 'p' })).toBeVisible()
  expect(screen.getByText('2 players seated')).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'GG' }))
  expect(await screen.findByText('GG', { selector: 'p' })).toBeVisible()
  fireEvent.change(screen.getByRole('textbox', { name: 'Message' }), { target: { value: ' Good luck all ' } })
  fireEvent.click(screen.getByRole('button', { name: 'Send' }))
  expect(await screen.findByText('Good luck all', { selector: 'p' })).toBeVisible()
  expect(screen.getByRole('textbox', { name: 'Message' })).toHaveValue('')
  expect(posts(fetch)[0][0]).toBe('/api/messages/tables/9/')
  expect(posts(fetch)[0][1]).toMatchObject({ headers: { 'X-CSRFToken': 'chat-csrf' } })
})

test('players who are not seated can read but not post', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respond(chat({ can_post: false }))))
  show()
  expect(await screen.findByText('Take a seat to join the chat. You can still read along.')).toBeVisible()
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  expect(screen.queryByRole('group', { name: 'Quick replies' })).not.toBeInTheDocument()
})

test('polling adds new lines and notices a new seat', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  const fetch = vi.fn()
    .mockResolvedValueOnce(respond(chat({ can_post: false })))
    .mockResolvedValue(respond(chat({ can_post: true, messages: [line(2, 'Welcome!')] })))
  vi.stubGlobal('fetch', fetch)
  show()
  await screen.findByText('Nice hand!', { selector: 'p' })
  await act(async () => { await vi.advanceTimersByTimeAsync(THREAD_POLL_MS) })
  expect(await screen.findByText('Welcome!', { selector: 'p' })).toBeVisible()
  expect(screen.getByRole('textbox', { name: 'Message' })).toBeVisible()
  expect(fetch.mock.calls[1][0]).toBe('/api/messages/tables/9/?after=1')
})

test('a refused post explains why and losing the seat hides the form', async () => {
  vi.stubGlobal('fetch', vi.fn()
    .mockResolvedValueOnce(respond(chat()))
    .mockResolvedValueOnce(respond({ non_field_errors: ['Take a seat at this table to join the chat.'] }, 403)))
  show()
  fireEvent.click(await screen.findByRole('button', { name: 'Wow' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Take a seat at this table')
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
})

test('signed-out and failed loads are explained', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respond({ detail: 'no' }, 403)))
  const { unmount } = show()
  expect(await screen.findByRole('link', { name: 'Sign in' })).toBeVisible()
  unmount()
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respond({}, 500)))
  show()
  expect(await screen.findByRole('alert')).toHaveTextContent('could not be loaded')
})
