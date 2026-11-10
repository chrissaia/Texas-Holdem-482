/** Verify private discovery, host invites and spectator read-only UI boundaries. */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, expect, test, vi } from 'vitest'
import { SpectatorPage } from './SpectatorPage'
import { PrivateTablesPage } from './PrivateTablesPage'
import { InvitationPanel } from './InvitationPanel'
import { ProfileContext } from '../profile/context'
import type { PokerTable } from './types'

const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status })
const state = { id: 1, name: 'Crew', status: 'waiting', is_public: false, max_players: 2, small_blind: 5, big_blind: 10, gameplay_available: false, players: [{ id: 2, username: 'Friend', stack: 100 }] }
const table = { ...state, host: { id: 1, username: 'Host' } } as unknown as PokerTable
const profile = { registered: true, loading: false, error: '', profile: null, token: '', refresh: vi.fn(), update: vi.fn() }
afterEach(() => vi.unstubAllGlobals())

/** Mount spectator route with a stable table ID. */
function watch() {
  return render(<MemoryRouter initialEntries={['/tables/1/watch']}><Routes><Route path="/tables/:id/watch" element={<SpectatorPage />} /></Routes></MemoryRouter>)
}

test('spectator displays only safe table state and performs GET requests', async () => {
  const fetch = vi.fn().mockImplementation(() => Promise.resolve(response(state)))
  vi.stubGlobal('fetch', fetch)
  watch()
  expect(await screen.findByText('Crew')).toBeVisible()
  expect(screen.getByText(/Friend · 100 table chips/)).toBeVisible()
  expect(screen.queryByRole('button', { name: /Join table/ })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Refresh spectator view' }))
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))
  expect(fetch.mock.calls.every(([path, init]) => path === '/api/tables/1/watch/' && !init?.method)).toBe(true)
  expect(screen.getByText(/Live poker hands, cards and betting are not available/)).toBeVisible()
})

test('revoked spectator access clears previously visible private state', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(response(state)).mockResolvedValueOnce(response({}, 404)))
  watch()
  await screen.findByText('Crew')
  fireEvent.click(screen.getByRole('button', { name: 'Refresh spectator view' }))
  await screen.findByRole('alert')
  expect(screen.queryByText('Crew')).not.toBeInTheDocument()
})

test('private list shows only returned invitations and offers retry', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(response({ results: [table] })))
  render(<MemoryRouter><ProfileContext.Provider value={profile}><PrivateTablesPage /></ProfileContext.Provider></MemoryRouter>)
  await screen.findByRole('alert')
  fireEvent.click(screen.getByRole('button', { name: 'Refresh private tables' }))
  expect(await screen.findByRole('link', { name: 'Crew' })).toHaveAttribute('href', '/tables/1')
})

test('anonymous private list prompts sign-in without requesting account data', async () => {
  const fetch = vi.fn(); vi.stubGlobal('fetch', fetch)
  render(<MemoryRouter><PrivateTablesPage /></MemoryRouter>)
  expect(screen.getByRole('link', { name: 'Sign in' })).toBeVisible()
  expect(fetch).not.toHaveBeenCalled()
})

test('host invites an accepted friend using CSRF and can revoke them', async () => {
  const fetch = vi.fn().mockImplementation((path: string, init?: RequestInit) => {
    if (path.includes('creation-context')) return Promise.resolve(response({ host: table.host }))
    if (path === '/api/friends/') return Promise.resolve(response({ friends: [{ player: { id: 2, username: 'Friend' } }] }))
    return Promise.resolve(response({ results: init?.method === 'POST' ? [{ id: 2, username: 'Friend' }] : [], csrf_token: 'csrf' }))
  })
  vi.stubGlobal('fetch', fetch)
  render(<MemoryRouter><InvitationPanel table={table} /></MemoryRouter>)
  await screen.findByRole('option', { name: 'Friend' })
  fireEvent.change(screen.getByLabelText('Accepted friend'), { target: { value: '2' } })
  fireEvent.click(screen.getByRole('button', { name: 'Invite friend' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Revoke Friend' }))
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Revoke Friend' })).not.toBeInTheDocument())
  const writes = fetch.mock.calls.filter(([, init]) => init?.method)
  expect(writes.map(([, init]) => init.method)).toEqual(['POST', 'DELETE'])
  expect(writes[0][1].headers['X-CSRFToken']).toBe('csrf')
  expect(JSON.parse(writes[0][1].body)).toEqual({ user_id: 2 })
})

test('invitee does not fetch host-only invitation controls', async () => {
  const fetch = vi.fn().mockResolvedValue(response({ host: { id: 2, username: 'Friend' } }))
  vi.stubGlobal('fetch', fetch)
  render(<MemoryRouter><InvitationPanel table={table} /></MemoryRouter>)
  await act(async () => {})
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(screen.queryByRole('heading', { name: 'Invite friends' })).not.toBeInTheDocument()
})
