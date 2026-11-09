import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, test, vi } from 'vitest'
import { ProfileContext } from '../profile/context'
import { SeatPanel } from './SeatPanel'
import type { PokerTable } from './types'

const table: PokerTable = { id: 1, name: 'Test table', host: { id: 1, username: 'host' }, is_public: true, max_players: 2, buy_in: 100, minimum_balance: 200, small_blind: 5, big_blind: 10, player_count: 0, status: 'waiting', created_at: '', last_activity_at: '' }
const status = { table_id: 1, player_count: 0, chip_balance: 1000, seat: null, other_table_id: null, csrf_token: 'server-token' }
const response = (body: unknown, code = 200) => new Response(JSON.stringify(body), { status: code })
const refresh = vi.fn()
const occupancy = vi.fn()
function page(registered = true, currentTable = table, loading = false) {
  return <MemoryRouter><ProfileContext.Provider value={{ registered, loading, error: '', profile: null, token: '', refresh, update: vi.fn() }}><SeatPanel table={currentTable} onOccupancy={occupancy} /></ProfileContext.Provider></MemoryRouter>
}
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks() })

test('joins and leaves using only server buy-in, CSRF and fresh balances', async () => {
  const fetch = vi.fn().mockResolvedValueOnce(response(status))
    .mockResolvedValueOnce(response({ ...status, player_count: 1, chip_balance: 900, seat: { id: 1, buy_in: 100, stack: 100 } }))
    .mockResolvedValueOnce(response(status))
  vi.stubGlobal('fetch', fetch)
  render(page())
  fireEvent.click(await screen.findByRole('button', { name: /Join table/ }))
  expect(await screen.findByText(/You have a seat/)).toBeInTheDocument()
  expect(fetch.mock.calls[1][1]).toMatchObject({ method: 'POST', body: '{}', headers: { 'X-CSRFToken': 'server-token' } })
  expect(occupancy).toHaveBeenCalledWith(1)
  fireEvent.click(screen.getByRole('button', { name: /Leave table/ }))
  await screen.findByRole('button', { name: /Join table/ })
  expect(fetch.mock.calls[2][1].method).toBe('DELETE')
  expect(refresh).toHaveBeenCalledTimes(2)
})

test('insufficient chips block joining and explain the threshold', async () => {
  const fetch = vi.fn().mockResolvedValue(response({ ...status, chip_balance: 199 }))
  vi.stubGlobal('fetch', fetch)
  render(page())
  expect(await screen.findByRole('button', { name: /Join table/ })).toBeDisabled()
  expect(screen.getByText(/You need at least 200 chips/)).toBeInTheDocument()
  expect(fetch).toHaveBeenCalledTimes(1)
})

test('exact minimum balance allows requesting a seat', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ ...status, chip_balance: 200 })))
  render(page())
  expect(await screen.findByRole('button', { name: /Join table/ })).toBeEnabled()
})

test('server rejection after a stale balance is visible and refresh recovers', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(response(status))
    .mockResolvedValueOnce(response({ detail: 'You need at least 200 chips to join this table.' }, 409))
    .mockResolvedValueOnce(response({ ...status, chip_balance: 100 })))
  render(page())
  fireEvent.click(await screen.findByRole('button', { name: /Join table/ }))
  expect(await screen.findByRole('alert')).toHaveTextContent('at least 200')
  fireEvent.click(screen.getByRole('button', { name: 'Refresh seat' }))
  await waitFor(() => expect(screen.getByRole('button', { name: /Join table/ })).toBeDisabled())
  expect(refresh).not.toHaveBeenCalled()
})

test('guests get a sign-in link and no private request', () => {
  const fetch = vi.fn()
  vi.stubGlobal('fetch', fetch)
  render(page(false))
  expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login')
  expect(fetch).not.toHaveBeenCalled()
})

test('account loading is shown without offering a join', () => {
  vi.stubGlobal('fetch', vi.fn())
  render(page(false, table, true))
  expect(screen.getByRole('status')).toHaveTextContent('Checking your account')
})

test('failed status request can be retried', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(response(status)))
  render(page())
  await screen.findByRole('alert')
  fireEvent.click(screen.getByRole('button', { name: 'Refresh seat' }))
  expect(await screen.findByRole('button', { name: /Join table/ })).toBeEnabled()
})

test('another funded table links to the current seat', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ ...status, other_table_id: 5 })))
  render(page())
  expect(await screen.findByRole('link', { name: 'Go to your table' })).toHaveAttribute('href', '/tables/5')
  expect(screen.queryByRole('button', { name: /Join table/ })).not.toBeInTheDocument()
})

test('full or playing tables prevent joining', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ ...status, player_count: 2 })))
  render(page(true, { ...table, status: 'playing' }))
  expect(await screen.findByRole('button', { name: /Join table/ })).toBeDisabled()
  expect(screen.getByText('This table is full.')).toBeInTheDocument()
  expect(screen.getByText(/not accepting players/)).toBeInTheDocument()
})

test('seated players cannot leave a playing table', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ ...status, seat: { id: 2, stack: 100, buy_in: 100 } })))
  render(page(true, { ...table, status: 'playing' }))
  expect(await screen.findByRole('button', { name: /Leave table/ })).toBeDisabled()
})
