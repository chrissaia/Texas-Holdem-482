import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { MemoryRouter, useNavigate } from 'react-router-dom'
import { afterEach, expect, test, vi } from 'vitest'
import { AppRoutes } from '../../App'
import type { PokerTable, TableList } from './types'

const host = { id: 7, username: 'Mira' }
const context = { host, csrf_token: 'test-csrf' }
const blue: PokerTable = {
  id: 12,
  name: 'Blue Hour',
  host,
  max_players: 6,
  buy_in: 1000,
  minimum_balance: 1000,
  small_blind: 25,
  big_blind: 50,
  is_public: true,
  player_count: 4,
  status: 'waiting',
  created_at: '2026-10-19T00:00:00Z',
  last_activity_at: '2026-10-19T00:00:00Z',
}
const respond = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status })
const results = (
  tables: PokerTable[] = [blue],
  overrides: Partial<TableList> = {},
): TableList => ({
  count: tables.length,
  next: null,
  previous: null,
  page: 1,
  page_size: 8,
  total_pages: 1,
  total_tables: tables.length,
  total_players: tables.reduce((sum, t) => sum + t.player_count, 0),
  results: tables,
  ...overrides,
})
function setup(
  handler: (
    url: URL,
    init?: RequestInit,
  ) => Response | Promise<Response> = () => respond(results()),
  path = '/lobby',
) {
  const fetch = vi
    .fn()
    .mockImplementation((path: string, init?: RequestInit) => {
      const url = new URL(path, 'http://localhost')
      return Promise.resolve(
        url.pathname.includes('creation-context')
          ? respond(context)
          : handler(url, init),
      )
    })
  vi.stubGlobal('fetch', fetch)
  render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
      <BackButton />
    </MemoryRouter>,
  )
  return fetch
}
function BackButton() {
  const navigate = useNavigate()
  return <button onClick={() => navigate(-1)}>Browser back</button>
}
const listCalls = (fetch: ReturnType<typeof vi.fn>) =>
  fetch.mock.calls.filter(([path]) => String(path).startsWith('/api/tables/?'))
afterEach(() => vi.unstubAllGlobals())

test('loads public database-shaped data and opens saved table details', async () => {
  setup((url) =>
    url.pathname.endsWith('/12/') ? respond(blue) : respond(results()),
  )
  expect(screen.getByText('Loading public tables…')).toBeVisible()
  expect(await screen.findByRole('link', { name: 'Blue Hour' })).toBeVisible()
  expect(screen.getByText('1 ACTIVE TABLES · 4 PLAYERS')).toBeVisible()
  const table = screen.getByRole('table')
  expect(within(table).getByText('4 / 6')).toBeVisible()
  expect(within(table).getByText('25 / 50')).toBeVisible()
  expect(within(table).getByText('Available')).toBeVisible()
  fireEvent.click(screen.getByRole('link', { name: 'View Blue Hour' }))
  expect(await screen.findByText('Hosted by Mira')).toBeVisible()
  fireEvent.click(screen.getByRole('link', { name: '← Back to lobby' }))
  expect(await screen.findByRole('link', { name: 'Blue Hour' })).toBeVisible()
})

test('search submits trimmed terms and filters/sort combine in URL requests', async () => {
  const fetch = setup()
  await screen.findByRole('link', { name: 'Blue Hour' })
  fireEvent.change(screen.getByRole('searchbox'), {
    target: { value: '  Mira  ' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Search' }))
  await waitFor(() =>
    expect(
      new URL(listCalls(fetch).at(-1)![0], 'http://local').searchParams.get(
        'search',
      ),
    ).toBe('Mira'),
  )
  for (const [label, value] of [
    ['Buy-in', '1000'],
    ['Blind level', '50'],
    ['Table size', '6'],
    ['Sort by', 'buy_in'],
  ]) {
    fireEvent.change(screen.getByLabelText(label), { target: { value } })
    await waitFor(() =>
      expect(
        screen.queryByText('Loading public tables…'),
      ).not.toBeInTheDocument(),
    )
  }
  const query = new URL(listCalls(fetch).at(-1)![0], 'http://local')
    .searchParams
  expect(Object.fromEntries(query)).toMatchObject({
    search: 'Mira',
    max_buy_in: '1000',
    big_blind: '50',
    max_players: '6',
    ordering: 'buy_in',
    available_seats: 'true',
  })
  fireEvent.click(screen.getByRole('button', { name: /Available seats/ }))
  await waitFor(() =>
    expect(
      new URL(listCalls(fetch).at(-1)![0], 'http://local').searchParams.get(
        'available_seats',
      ),
    ).toBe('false'),
  )
  expect(
    screen.getByRole('button', { name: /Available seats/ }),
  ).toHaveAttribute('aria-pressed', 'false')
})

test('filter changes reset page and browser back restores previous filters', async () => {
  const fetch = setup(
    () => respond(results()),
    '/lobby?search=Mira&page=2&ordering=name',
  )
  await screen.findByRole('link', { name: 'Blue Hour' })
  expect(screen.getByRole('searchbox')).toHaveValue('Mira')
  fireEvent.change(screen.getByLabelText('Buy-in'), {
    target: { value: '400' },
  })
  await screen.findByRole('link', { name: 'Blue Hour' })
  expect(
    new URL(listCalls(fetch).at(-1)![0], 'http://local').searchParams.has(
      'page',
    ),
  ).toBe(false)
  fireEvent.click(screen.getByRole('button', { name: 'Browser back' }))
  await screen.findByRole('link', { name: 'Blue Hour' })
  expect(screen.getByLabelText('Buy-in')).toHaveValue('')
  expect(
    new URL(listCalls(fetch).at(-1)![0], 'http://local').searchParams.get(
      'page',
    ),
  ).toBe('2')
})

test('pagination preserves filters and updates the matching range', async () => {
  const fetch = setup((url) => {
    const page = Number(url.searchParams.get('page') || 1)
    return respond(
      results([blue], {
        page,
        page_size: 1,
        count: 2,
        total_tables: 2,
        total_pages: 2,
        next: page === 1 ? 'next' : null,
        previous: page === 2 ? 'previous' : null,
      }),
    )
  }, '/lobby?search=Mira&page_size=1')
  await screen.findByText('Showing 1–1 of 2 matching tables')
  expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: 'Next' }))
  await screen.findByText('Showing 2–2 of 2 matching tables')
  expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
  expect(listCalls(fetch).at(-1)![0]).toContain('search=Mira')
  fireEvent.click(screen.getByRole('button', { name: 'Previous' }))
  await screen.findByText('Showing 1–1 of 2 matching tables')
})

test('empty lobby invites creation without fake rows', async () => {
  setup(() => respond(results([])))
  expect(
    await screen.findByText('The next poker night starts with you.'),
  ).toBeVisible()
  expect(screen.queryByRole('table')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('link', { name: 'Create the first table' }))
  expect(await screen.findByText('Your table. Your rules.')).toBeVisible()
})

test('no-match message and reset clear search, filters, sorting, and page', async () => {
  const fetch = setup(
    () => respond(results([], { total_tables: 3 })),
    '/lobby?search=missing&max_players=2&ordering=name&page=2',
  )
  expect(await screen.findByText('No tables match your filters.')).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Reset filters' }))
  await waitFor(() =>
    expect(listCalls(fetch).at(-1)![0]).toBe(
      '/api/tables/?available_seats=true',
    ),
  )
  expect(screen.getByRole('searchbox')).toHaveValue('')
  expect(screen.getByLabelText('Sort by')).toHaveValue('newest')
})

test.each([
  [400, 'Some lobby filters are invalid'],
  [404, 'This results page is no longer available'],
  [503, 'We could not load public tables'],
])('server error %s is actionable and retryable', async (status, message) => {
  let fail = true
  setup(() => (fail ? respond({}, status) : respond(results())))
  expect(await screen.findByRole('alert')).toHaveTextContent(message)
  fail = false
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
  expect(await screen.findByRole('link', { name: 'Blue Hour' })).toBeVisible()
})

test('network failure can recover and manual refresh gets current occupancy', async () => {
  let requests = 0
  setup(() => {
    requests++
    if (requests === 1) return Promise.reject(new Error('offline'))
    return respond(results([{ ...blue, player_count: requests === 2 ? 4 : 5 }]))
  })
  await screen.findByRole('alert')
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
  expect(await screen.findByText('4 / 6')).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Refresh tables' }))
  expect(await screen.findByText('5 / 6')).toBeVisible()
})

test('out-of-order responses cannot replace the latest search', async () => {
  let finish!: (response: Response) => void
  setup((url) =>
    url.searchParams.get('search') === 'latest'
      ? respond(results([{ ...blue, name: 'Latest table' }]))
      : new Promise((resolve) => {
          finish = resolve
        }),
  )
  fireEvent.change(screen.getByRole('searchbox'), {
    target: { value: 'latest' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Search' }))
  expect(
    await screen.findByRole('link', { name: 'Latest table' }),
  ).toBeVisible()
  finish(respond(results([{ ...blue, name: 'Stale table' }])))
  await waitFor(() =>
    expect(screen.queryByText('Stale table')).not.toBeInTheDocument(),
  )
})

test('full and playing statuses are distinct and unimplemented actions remain disabled', async () => {
  setup(
    () =>
      respond(
        results([
          { ...blue, player_count: 6 },
          { ...blue, id: 13, name: 'Playing table', status: 'playing' },
        ]),
      ),
    '/lobby?available_seats=false',
  )
  expect(await screen.findByText('Full')).toBeVisible()
  expect(screen.getByText('Playing')).toBeVisible()
  for (const name of ['Quick Join', 'Friends playing', 'Bot tables'])
    expect(screen.getByRole('button', { name })).toBeDisabled()
})

test('creation appears in lobby through the new success link', async () => {
  let saved = false
  setup((url, init) => {
    if (init?.method === 'POST') {
      saved = true
      return respond(blue, 201)
    }
    if (url.pathname === '/api/tables/')
      return respond(results(saved ? [blue] : []))
    return respond(blue)
  }, '/tables/create')
  fireEvent.change(await screen.findByLabelText('Table name'), {
    target: { value: 'Blue Hour' },
  })
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Create Table →' }),
    ).toBeEnabled(),
  )
  fireEvent.click(screen.getByRole('button', { name: 'Create Table →' }))
  await screen.findByText('Table created!')
  fireEvent.click(screen.getByRole('link', { name: 'See it in the lobby →' }))
  expect(await screen.findByRole('link', { name: 'Blue Hour' })).toBeVisible()
})
