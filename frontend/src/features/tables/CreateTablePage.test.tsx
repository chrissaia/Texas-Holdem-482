import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, test, vi } from 'vitest'
import { AppRoutes } from '../../App'

const host = { id: 7, username: 'Chris' }
const context = { host, csrf_token: 'test-csrf-token' }
const table = {
  id: 12,
  name: 'Friday poker',
  host,
  max_players: 6,
  buy_in: 1000,
  minimum_balance: 1000,
  small_blind: 25,
  big_blind: 50,
  is_public: true,
  player_count: 0,
  status: 'waiting',
  created_at: '2026-10-20T00:00:00Z',
  last_activity_at: '2026-10-20T00:00:00Z',
}
const respond = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status })
const start = (path = '/tables/create') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>,
  )
const submit = async () => {
  fireEvent.change(await screen.findByLabelText('Table name'), {
    target: { value: 'Friday poker' },
  })
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Create Table →' }),
    ).toBeEnabled(),
  )
  fireEvent.click(screen.getByRole('button', { name: 'Create Table →' }))
}

afterEach(() => vi.unstubAllGlobals())

test('creates a real-shaped public table request with CSRF and reads saved details', async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(respond(context))
    .mockResolvedValueOnce(respond(table, 201))
    .mockResolvedValueOnce(respond(table))
  vi.stubGlobal('fetch', fetch)
  start()
  await submit()
  expect(await screen.findByText('Table created!')).toBeVisible()
  const [path, options] = fetch.mock.calls[1]
  expect(path).toBe('/api/tables/')
  expect(options.credentials).toBe('same-origin')
  expect(options.headers['X-CSRFToken']).toBe(context.csrf_token)
  expect(JSON.parse(options.body)).toEqual({
    name: 'Friday poker',
    max_players: 6,
    buy_in: 1000,
    minimum_balance: 1000,
    small_blind: 25,
    big_blind: 50,
  })
  expect(
    screen.queryByRole('button', { name: 'Create Table →' }),
  ).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('link', { name: 'View your table →' }))
  expect(await screen.findByText('Hosted by Chris')).toBeVisible()
  expect(screen.getByText('0 / 6')).toBeVisible()
})

test('validates empty name, blind relationship and minimum balance before sending', async () => {
  const fetch = vi.fn().mockResolvedValue(respond(context))
  vi.stubGlobal('fetch', fetch)
  start()
  const button = await screen.findByRole('button', { name: 'Create Table →' })
  await waitFor(() => expect(button).toBeEnabled())
  fireEvent.click(button)
  expect(
    await screen.findByText('Enter a table name between 1 and 80 characters.'),
  ).toBeVisible()
  fireEvent.change(screen.getByLabelText('Table name'), {
    target: { value: 'Friday poker' },
  })
  fireEvent.change(screen.getByLabelText('Big blind'), {
    target: { value: '51' },
  })
  fireEvent.change(screen.getByLabelText('Minimum balance'), {
    target: { value: '900' },
  })
  fireEvent.click(button)
  expect(
    await screen.findByText('Big blind must be twice the small blind.'),
  ).toBeVisible()
  expect(
    screen.getByText('Minimum balance must be at least the buy-in.'),
  ).toBeVisible()
  expect(fetch).toHaveBeenCalledTimes(1)
})

test('seat selection updates summary, and create another resets the form', async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(respond(context))
    .mockResolvedValueOnce(respond(table, 201))
  vi.stubGlobal('fetch', fetch)
  start()
  fireEvent.click(screen.getByRole('radio', { name: '9 seats' }))
  expect(screen.getByText('0 / 9')).toBeVisible()
  await submit()
  expect(JSON.parse(fetch.mock.calls[1][1].body).max_players).toBe(9)
  fireEvent.click(
    await screen.findByRole('button', { name: 'Create another table' }),
  )
  expect(screen.getByLabelText('Table name')).toHaveValue('')
  expect(screen.getByRole('radio', { name: '6 seats' })).toBeChecked()
})

test('anonymous users may configure but cannot submit', async () => {
  const fetch = vi
    .fn()
    .mockResolvedValue(respond({ host: null, csrf_token: 'token' }))
  vi.stubGlobal('fetch', fetch)
  start()
  expect(await screen.findByRole('link', { name: 'Sign in' })).toHaveAttribute(
    'href',
    '/admin/login/?next=/tables/create/',
  )
  expect(screen.getByRole('button', { name: 'Create Table →' })).toBeDisabled()
  fireEvent.submit(screen.getByLabelText('Table name').closest('form')!)
  expect(fetch).toHaveBeenCalledTimes(1)
})

test('context error is retryable and loading disables creation', async () => {
  const fetch = vi
    .fn()
    .mockRejectedValueOnce(new TypeError('offline'))
    .mockResolvedValueOnce(respond(context))
  vi.stubGlobal('fetch', fetch)
  start()
  expect(screen.getByText('Checking your session…')).toBeVisible()
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'We could not check your session',
  )
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Create Table →' }),
    ).toBeEnabled(),
  )
})

test.each([
  [
    400,
    { name: ['This table name was rejected.'] },
    'Please check the highlighted settings',
  ],
  [403, { detail: 'CSRF Failed' }, 'Your session could not be verified'],
  [503, { detail: 'Database unavailable' }, 'Database unavailable'],
])(
  'handles server error %s without losing form values',
  async (status, body, message) => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(respond(context))
        .mockResolvedValueOnce(respond(body, status))
        .mockResolvedValueOnce(respond(context)),
    )
    start()
    await submit()
    expect(await screen.findByRole('alert')).toHaveTextContent(message)
    expect(screen.getByLabelText('Table name')).toHaveValue('Friday poker')
    if (status === 400)
      expect(screen.getByText('This table name was rejected.')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Refresh session' }))
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Create Table →' }),
      ).toBeEnabled(),
    )
  },
)

test('network failure reports a useful error without automatic POST retry', async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(respond(context))
    .mockRejectedValueOnce(new TypeError('offline'))
  vi.stubGlobal('fetch', fetch)
  start()
  await submit()
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Unable to reach RIVR',
  )
  expect(fetch).toHaveBeenCalledTimes(2)
})

test('disables duplicate submissions while waiting', async () => {
  let finish!: (value: Response) => void
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(respond(context))
    .mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          finish = resolve
        }),
    )
  vi.stubGlobal('fetch', fetch)
  start()
  await submit()
  expect(screen.getByRole('button', { name: 'Creating table…' })).toBeDisabled()
  fireEvent.submit(screen.getByLabelText('Table name').closest('form')!)
  fireEvent.click(screen.getByRole('link', { name: 'Cancel' }))
  expect(screen.getByLabelText('Table name')).toBeVisible()
  expect(fetch).toHaveBeenCalledTimes(2)
  finish(respond(table, 201))
  expect(await screen.findByText('Table created!')).toBeVisible()
})

test('cancel returns home without creating, and home opens creation', async () => {
  const fetch = vi.fn().mockResolvedValue(respond(context))
  vi.stubGlobal('fetch', fetch)
  start()
  fireEvent.click(screen.getByRole('link', { name: 'Cancel' }))
  expect(screen.getByText('Make room for your next poker night.')).toBeVisible()
  fireEvent.click(screen.getByRole('link', { name: 'Create Table →' }))
  expect(screen.getByText('Your table. Your rules.')).toBeVisible()
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
})

test('missing table and unknown route have useful recovery links', async () => {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockImplementation((path: string) =>
        Promise.resolve(
          path.includes('creation-context')
            ? respond(context)
            : respond({}, 404),
        ),
      ),
  )
  const view = start('/tables/999')
  expect(screen.getByText('Loading table…')).toBeVisible()
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'This table could not be loaded',
  )
  view.unmount()
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respond(context)))
  start('/missing')
  expect(screen.getByText('Page not found')).toBeVisible()
})
