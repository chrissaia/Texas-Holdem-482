import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, test, vi } from 'vitest'
import { AdminDashboard } from './AdminDashboard'
import { AdminLink } from './AdminLink'

const access = { username: 'Admin', csrf_token: 'staff-token', can_view_users: true,
  can_change_users: true, can_view_tables: true, can_change_tables: true, can_view_audit: true }
const player = { id: 3, username: 'River', is_active: true, is_admin: false }
const table = { id: 4, name: 'Evening game', host: 'River', status: 'waiting', is_public: true,
  player_count: 0, max_players: 6, buy_in: 100 }
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
const page = (results: unknown[]) => ({ results, count: results.length, page: 1, page_size: 20 })
function setup(handler: (url: string, init?: RequestInit) => Response | Promise<Response> = () => response(page([player]))) {
  const fetch = vi.fn((url: string, init?: RequestInit) => Promise.resolve(
    url === '/api/moderation/' ? response(access) : handler(url, init)))
  vi.stubGlobal('fetch', fetch)
  render(<MemoryRouter><AdminDashboard /></MemoryRouter>)
  return fetch
}
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

test('non-staff sees access denial without private rows', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({}, 403)))
  render(<MemoryRouter><AdminDashboard /></MemoryRouter>)
  expect(await screen.findByRole('heading', { name: 'Administrator access required' })).toBeVisible()
  expect(screen.queryByText('River')).not.toBeInTheDocument()
})

test('search and status filters are encoded; empty results have guidance', async () => {
  const fetch = setup(() => response(page([])))
  await screen.findByText(/No matching records/)
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'A & B' } })
  fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'suspended' } })
  fireEvent.click(screen.getByRole('button', { name: 'Search' }))
  await waitFor(() => expect(fetch).toHaveBeenLastCalledWith(
    '/api/moderation/users/?q=A+%26+B&state=suspended&page=1', expect.anything()))
})

test('moderation requires confirmation and reason; sends expected state and CSRF', async () => {
  const fetch = setup((_, init) => response(init?.method === 'POST' ? {} : page([player])))
  fireEvent.click(await screen.findByRole('button', { name: 'Suspend River' }))
  expect(fetch.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(0)
  expect(screen.getByRole('button', { name: 'Confirm suspend' })).toBeDisabled()
  expect(screen.getByLabelText('Reason (required)')).toHaveFocus()
  fireEvent.change(screen.getByLabelText('Reason (required)'), { target: { value: '  Verified report  ' } })
  fireEvent.click(screen.getByRole('button', { name: 'Confirm suspend' }))
  expect(await screen.findByText(/Saved suspend for River/)).toBeVisible()
  const post = fetch.mock.calls.find(([, init]) => init?.method === 'POST')!
  expect(post[0]).toBe('/api/moderation/users/3/action/')
  expect(JSON.parse(post[1]!.body as string)).toEqual({ action: 'suspend', expected: 'active', reason: 'Verified report' })
  expect(new Headers(post[1]!.headers).get('X-CSRFToken')).toBe('staff-token')
})

test('cancel makes no change and administrator accounts are protected', async () => {
  const fetch = setup(() => response(page([player, { ...player, id: 9, username: 'Staff', is_admin: true }])))
  fireEvent.click(await screen.findByRole('button', { name: 'Suspend River' }))
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
  expect(screen.queryByRole('form', { name: 'Confirm moderation change' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Suspend Staff' })).toBeDisabled()
  expect(fetch.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(0)
})

test('table tab protects playing and occupied tables, permits reopen', async () => {
  setup(url => response(url.includes('/tables/') ? page([
    table, { ...table, id: 5, name: 'Busy', player_count: 1 },
    { ...table, id: 6, name: 'Playing', status: 'playing' },
    { ...table, id: 7, name: 'Closed', status: 'closed', is_public: false },
  ]) : page([player])))
  fireEvent.click(await screen.findByRole('button', { name: 'Tables' }))
  expect(await screen.findByRole('button', { name: 'Close Busy' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Close Playing' })).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: 'Reopen Closed' }))
  expect(screen.getByRole('button', { name: 'Confirm reopen' })).toBeDisabled()
})

test('stale changes explain the conflict and refresh the records', async () => {
  setup((_, init) => init?.method === 'POST' ? response({ detail: 'This record changed. Refresh and try again.' }, 409) : response(page([player])))
  fireEvent.click(await screen.findByRole('button', { name: 'Suspend River' }))
  fireEvent.change(screen.getByLabelText('Reason (required)'), { target: { value: 'Report confirmed' } })
  fireEvent.click(screen.getByRole('button', { name: 'Confirm suspend' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('This record changed')
  expect(screen.queryByLabelText('Reason (required)')).not.toBeInTheDocument()
})

test('session loss clears private records', async () => {
  let expired = false
  setup(() => expired ? response({}, 403) : response(page([player])))
  await screen.findByText('River')
  expired = true
  fireEvent.click(screen.getByRole('button', { name: 'Refresh' }))
  await screen.findByRole('heading', { name: 'Administrator access required' })
  expect(screen.queryByText('River')).not.toBeInTheDocument()
})

test('late results from another tab cannot replace the current tab', async () => {
  let finish!: (value: Response) => void
  setup(url => url.includes('/users/') ? new Promise(resolve => { finish = resolve }) : response(page([table])))
  fireEvent.click(await screen.findByRole('button', { name: 'Tables' }))
  await screen.findByText('Evening game')
  await act(async () => { finish(response(page([player]))) })
  expect(screen.queryByText('River', { exact: true })).not.toBeInTheDocument()
  expect(screen.getByText('Evening game')).toBeVisible()
})

test('network failures can be retried', async () => {
  let first = true
  setup(() => {
    if (first) { first = false; return response({}, 500) }
    return response(page([player]))
  })
  expect(await screen.findByRole('alert')).toHaveTextContent('We could not load records')
  fireEvent.click(screen.getByRole('button', { name: 'Refresh' }))
  expect(await screen.findByText('River')).toBeVisible()
})

test('audit displays actor, reason and transition as escaped text', async () => {
  setup(url => response(url.includes('/audit/') ? page([{ id: 1, actor: 'Admin', target: '<script>name</script>',
    action: 'suspend', before: 'active', after: 'suspended', reason: '<b>Verified</b>', created_at: '2026-11-21T12:00:00Z' }]) : page([])))
  fireEvent.click(await screen.findByRole('button', { name: 'Audit trail' }))
  expect(await screen.findByText('<script>name</script>')).toBeVisible()
  expect(screen.getByText('<b>Verified</b>')).toBeVisible()
  expect(screen.getByText('active → suspended')).toBeVisible()
})

test('staff without model permissions sees no private tables', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ ...access, can_view_users: false,
    can_view_tables: false, can_view_audit: false })))
  render(<MemoryRouter><AdminDashboard /></MemoryRouter>)
  expect(await screen.findByText(/no dashboard view permissions/)).toBeVisible()
  expect(screen.queryByRole('table')).not.toBeInTheDocument()
})

test('admin shortcut is tied to the currently signed-in account', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ user: { id: 1, is_admin: true } })))
  const view = render(<MemoryRouter><AdminLink isAdmin={true} className="nav-item" /></MemoryRouter>)
  expect(await screen.findByRole('link', { name: 'Administration' })).toHaveAttribute('href', '/moderation')
  view.rerender(<MemoryRouter><AdminLink isAdmin={false} className="nav-item" /></MemoryRouter>)
  expect(screen.queryByRole('link', { name: 'Administration' })).not.toBeInTheDocument()
})
