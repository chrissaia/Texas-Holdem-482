/**
 * Regression tests: friends/FriendsPage.test.tsx.
 * Exercises observable behavior and isolates API or browser dependencies.
 */
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, test, vi } from 'vitest'
import { AppRoutes } from '../../App'
import { PRESENCE_POLL_MS } from './FriendsPage'
import type { Friend, FriendEntry, FriendsResponse, Presence } from './types'

const me = { id: 1, username: 'alice' }
const context = { host: me, csrf_token: 'context-csrf' }
/** Entry for this module's test scenario. */
const entry = (id: number, username: string): FriendEntry => ({
  id,
  player: { id: id + 100, username },
  created_at: '2026-11-02T12:00:00Z',
})
const OFFLINE: Presence = { status: 'offline', table: null }
/** An accepted friend; offline unless a presence is given (S20). */
const friend = (id: number, username: string, presence: Presence = OFFLINE): Friend => ({
  ...entry(id, username),
  presence,
})
/** Lists for this module's test scenario. */
const lists = (overrides: Partial<FriendsResponse> = {}): FriendsResponse => ({
  friends: [friend(1, 'Mira')],
  online_count: 0,
  incoming: [entry(2, 'Eli')],
  outgoing: [entry(3, 'Rowan')],
  csrf_token: 'csrf-1',
  ...overrides,
})
/** Respond for this module's test scenario. */
const respond = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status })

type Handler = (url: URL, init?: RequestInit) => Response | Promise<Response>

/** Setup for this module's test scenario. */
function setup(write: Handler = /* Return the derived value for the enclosing operation. */ () => respond(lists()), first = lists()) {
  const fetch = vi.fn().mockImplementation(/* Handle the mockImplementation callback using the current operation's state. */ (path: string, init?: RequestInit) => {
    const url = new URL(path, 'http://localhost')
    if (url.pathname.includes('creation-context'))
      return Promise.resolve(respond(context))
    if (!init?.method || init.method === 'GET')
      return Promise.resolve(respond(first))
    return Promise.resolve(write(url, init))
  })
  vi.stubGlobal('fetch', fetch)
  render(
    <MemoryRouter initialEntries={['/friends']}>
      <AppRoutes />
    </MemoryRouter>,
  )
  return fetch
}
/** Writes for this module's test scenario. */
const writes = (fetch: ReturnType<typeof vi.fn>) =>
  fetch.mock.calls.filter(/* Keep only entries satisfying the surrounding collection rule. */ ([, init]) => init?.method && init.method !== 'GET')
/** Gets for this module's test scenario. */
const gets = (fetch: ReturnType<typeof vi.fn>) =>
  fetch.mock.calls.filter(
    /* Keep only entries satisfying the surrounding collection rule. */
    ([path, init]) => String(path) === '/api/friends/' && !init?.method,
  )
/** Search for this module's test scenario. */
const search = () => screen.getByLabelText('Find a friend')
/** Send to for this module's test scenario. */
const sendTo = (name: string) => {
  fireEvent.change(search(), { target: { value: name } })
  fireEvent.click(screen.getByRole('button', { name: 'Send Request' }))
}
afterEach(/* Restore test isolation after the preceding scenario. */ () => vi.unstubAllGlobals())

test('shows friends, incoming and sent requests from the API', /* Verify shows friends, incoming and sent requests from the API. */ async () => {
  setup()
  const grid = await screen.findByRole('list', { name: 'Your friends' })
  expect(within(grid).getByRole('heading', { name: 'Mira' })).toBeVisible()
  expect(screen.getByText('YOUR CREW · 1 FRIEND · 0 ONLINE')).toBeVisible()
  expect(screen.getByRole('button', { name: 'All Friends · 1' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('button', { name: 'Requests · 2' })).toBeVisible()
  const incoming = screen.getByRole('region', { name: 'Friend requests' })
  expect(within(incoming).getByText('Eli')).toBeVisible()
  expect(within(incoming).getByText('1 pending')).toBeVisible()
  const outgoing = screen.getByRole('region', { name: 'Sent requests' })
  expect(within(outgoing).getByText('Rowan')).toBeVisible()
  const nav = screen.getByRole('navigation', { name: 'Main navigation' })
  expect(within(nav).getByRole('link', { name: 'Friends' })).toHaveAttribute('aria-current', 'page')
})

test('Message opens the conversation; later-story features stay unavailable', /* Verify features from later stories are visible but unavailable. */ async () => {
  setup()
  await screen.findByRole('list', { name: 'Your friends' })
  expect(screen.getByText('Recently Played')).toHaveAttribute('aria-disabled', 'true')
  expect(screen.getByRole('link', { name: 'Message Mira' })).toHaveAttribute('href', '/messages?with=101')
  expect(screen.getByRole('button', { name: 'Invite to Table' })).toBeDisabled()
})

test('sends a trimmed username with the CSRF token and shows the result', /* Verify sends a trimmed username with the CSRF token and shows the result. */ async () => {
  const fetch = setup(/* Handle the setup callback using the current operation's state. */ () =>
    respond(lists({ outgoing: [entry(3, 'Rowan'), entry(4, 'bob')], csrf_token: 'csrf-2' }), 201),
  )
  await screen.findByRole('list', { name: 'Your friends' })
  sendTo('  bob  ')
  expect(await screen.findByText('Friend request sent to bob.')).toBeVisible()
  const [path, init] = writes(fetch)[0]
  expect(path).toBe('/api/friends/requests/')
  expect(init.body).toBe('{"username":"bob"}')
  expect(init.headers['X-CSRFToken']).toBe('csrf-1')
  expect(search()).toHaveValue('')
  // The next write uses the token from the latest response.
  sendTo('carol')
  await waitFor(/* Wait for the expected asynchronous UI or request state. */ () => expect(writes(fetch)).toHaveLength(2))
  expect(writes(fetch)[1][1].headers['X-CSRFToken']).toBe('csrf-2')
})

test('a crossed request reports the new friendship', /* Verify a crossed request reports the new friendship. */ async () => {
  setup(/* Handle the setup callback using the current operation's state. */ () => respond(lists({ friends: [friend(1, 'Mira'), friend(5, 'Bob')] })))
  await screen.findByRole('list', { name: 'Your friends' })
  sendTo('bob')
  expect(await screen.findByText('You and bob are now friends.')).toBeVisible()
})

test('a blank username is flagged without calling the API', /* Verify a blank username is flagged without calling the API. */ async () => {
  const fetch = setup()
  await screen.findByRole('list', { name: 'Your friends' })
  sendTo('   ')
  expect(screen.getByText('Enter a username.')).toBeVisible()
  expect(search()).toHaveAttribute('aria-invalid', 'true')
  expect(search()).toHaveFocus()
  expect(writes(fetch)).toHaveLength(0)
})

test('server errors appear under the field or as an alert', /* Verify server errors appear under the field or as an alert. */ async () => {
  let reply = respond({ username: ['No registered player has that username.'] }, 400)
  setup(/* Handle the setup callback using the current operation's state. */ () => reply)
  await screen.findByRole('list', { name: 'Your friends' })
  sendTo('ghost')
  expect(await screen.findByText('No registered player has that username.')).toBeVisible()
  expect(search()).toHaveAttribute('aria-invalid', 'true')
  expect(search()).toHaveValue('ghost')

  reply = respond({ non_field_errors: ['You already sent Rowan a friend request.'] }, 400)
  sendTo('Rowan')
  expect(await screen.findByRole('alert')).toHaveTextContent('You already sent Rowan a friend request.')
  expect(search()).not.toHaveAttribute('aria-invalid')

  reply = respond({}, 400)
  sendTo('Rowan')
  await waitFor(/* Wait for the expected asynchronous UI or request state. */ () =>
    expect(screen.getByRole('alert')).toHaveTextContent('That did not work. Please try again.'),
  )
})

test.each([
  ['Accept', 'Friend requests', '/api/friends/requests/2/accept/', 'You and Eli are now friends.'],
  ['Decline', 'Friend requests', '/api/friends/requests/2/decline/', "Declined Eli's request."],
  ['Cancel', 'Sent requests', '/api/friends/requests/3/cancel/', 'Cancelled your request to Rowan.'],
])('%s calls the request endpoint', /* Handle the enclosing callback using the current operation's state. */ async (button, panel, url, message) => {
  const fetch = setup()
  const region = await screen.findByRole('region', { name: panel })
  fireEvent.click(within(region).getByRole('button', { name: button }))
  expect(await screen.findByText(message)).toBeVisible()
  const [path, init] = writes(fetch)[0]
  expect(path).toBe(url)
  expect(init).toMatchObject({ method: 'POST', body: '{}' })
})

test('removing a friend asks for confirmation first', /* Verify removing a friend asks for confirmation first. */ async () => {
  const fetch = setup(/* Handle the setup callback using the current operation's state. */ () => respond(lists({ friends: [] })))
  await screen.findByRole('list', { name: 'Your friends' })
  fireEvent.click(screen.getByRole('button', { name: 'Remove Friend' }))
  fireEvent.click(screen.getByRole('button', { name: 'Keep' }))
  expect(writes(fetch)).toHaveLength(0)
  fireEvent.click(screen.getByRole('button', { name: 'Remove Friend' }))
  fireEvent.click(screen.getByRole('button', { name: 'Yes, remove' }))
  expect(await screen.findByText('Removed Mira from your friends.')).toBeVisible()
  expect(writes(fetch)[0]).toEqual(['/api/friends/1/', expect.objectContaining({ method: 'DELETE' })])
  expect(screen.getByText('No friends yet.')).toBeVisible()
  expect(screen.getByText('YOUR CREW · 0 FRIENDS · 0 ONLINE')).toBeVisible()
})

test('a request answered elsewhere shows a message and reloads the lists', /* Verify a request answered elsewhere shows a message and reloads the lists. */ async () => {
  const fetch = setup(/* Handle the setup callback using the current operation's state. */ () => respond({ detail: 'Not found.' }, 404))
  const region = await screen.findByRole('region', { name: 'Friend requests' })
  fireEvent.click(within(region).getByRole('button', { name: 'Accept' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('That request or friend is no longer available.')
  await waitFor(/* Wait for the expected asynchronous UI or request state. */ () => expect(gets(fetch)).toHaveLength(2))
})

test('an expired session and a lost connection are reported', /* Verify an expired session and a lost connection are reported. */ async () => {
  /** Fail for this module's test scenario. */
  let fail: () => Response = () => respond({ detail: 'CSRF Failed' }, 403)
  setup(/* Handle the setup callback using the current operation's state. */ () => fail())
  await screen.findByRole('list', { name: 'Your friends' })
  sendTo('bob')
  expect(await screen.findByRole('alert')).toHaveTextContent('Your session changed.')
  fail = /* Return the derived value for the enclosing operation. */ () => {
    throw new TypeError('offline')
  }
  sendTo('bob')
  await waitFor(/* Wait for the expected asynchronous UI or request state. */ () =>
    expect(screen.getByRole('alert')).toHaveTextContent('Unable to reach RIVR.'),
  )
})

test('only one action is sent while another is in flight', /* Verify only one action is sent while another is in flight. */ async () => {
  /** Finish for this module's test scenario. */
  let finish: (value: Response) => void = () => {}
  const fetch = setup(/* Handle the setup callback using the current operation's state. */ () => new Promise<Response>(/* Return the derived value for the enclosing operation. */ (resolve) => (finish = resolve)))
  const region = await screen.findByRole('region', { name: 'Friend requests' })
  fireEvent.click(within(region).getByRole('button', { name: 'Accept' }))
  fireEvent.click(within(region).getByRole('button', { name: 'Decline' }))
  fireEvent.submit(search())
  expect(screen.getByRole('button', { name: 'Sending…' })).toBeDisabled()
  expect(writes(fetch)).toHaveLength(1)
  finish(respond(lists()))
  expect(await screen.findByText('You and Eli are now friends.')).toBeVisible()
})

test('the Requests tab hides the friend cards and Add Friend focuses the search', /* Verify the Requests tab hides the friend cards and Add Friend focuses the search. */ async () => {
  setup()
  await screen.findByRole('list', { name: 'Your friends' })
  fireEvent.click(screen.getByRole('button', { name: 'Requests · 2' }))
  expect(screen.queryByRole('list', { name: 'Your friends' })).not.toBeInTheDocument()
  expect(screen.getByRole('region', { name: 'Friend requests' })).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'All Friends · 1' }))
  expect(screen.getByRole('list', { name: 'Your friends' })).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Add Friend' }))
  expect(search()).toHaveFocus()
})

test('empty lists explain what to do next', /* Verify empty lists explain what to do next. */ async () => {
  setup(undefined, lists({ friends: [], incoming: [], outgoing: [] }))
  expect(await screen.findByText('No friends yet.')).toBeVisible()
  expect(screen.getByText('No requests right now.')).toBeVisible()
  expect(screen.getByText('You have no requests waiting.')).toBeVisible()
})

test('guests and signed-out visitors are asked to sign in', /* Verify guests and signed-out visitors are asked to sign in. */ async () => {
  const fetch = vi.fn().mockImplementation(/* Handle the mockImplementation callback using the current operation's state. */ (path: string) =>
    Promise.resolve(
      String(path).includes('creation-context')
        ? respond({ host: null, csrf_token: 'x' })
        : respond({ detail: 'Authentication credentials were not provided.' }, 403),
    ),
  )
  vi.stubGlobal('fetch', fetch)
  render(
    <MemoryRouter initialEntries={['/friends']}>
      <AppRoutes />
    </MemoryRouter>,
  )
  expect(await screen.findByText(/Sign in with a registered account to add friends/)).toBeVisible()
  expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login')
})

test('a failed load can be retried', /* Verify a failed load can be retried. */ async () => {
  let fail = true
  const fetch = vi.fn().mockImplementation(/* Handle the mockImplementation callback using the current operation's state. */ (path: string) =>
    Promise.resolve(
      String(path).includes('creation-context')
        ? respond(context)
        : fail
          ? respond({}, 500)
          : respond(lists()),
    ),
  )
  vi.stubGlobal('fetch', fetch)
  render(
    <MemoryRouter initialEntries={['/friends']}>
      <AppRoutes />
    </MemoryRouter>,
  )
  expect(screen.getByText('Loading your friends…')).toBeVisible()
  expect(await screen.findByText('We could not load your friends. Please try again.')).toBeVisible()
  fail = false
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
  expect(await screen.findByRole('list', { name: 'Your friends' })).toBeVisible()
})

test('friend search offers up to five matching names and selected name is submitted', async () => {
  const fetch = setup()
  const original = fetch.getMockImplementation()!
  fetch.mockImplementation((path: string, init?: RequestInit) => {
    if (path.startsWith('/api/friends/search/'))
      return Promise.resolve(respond({ results: Array.from({ length: 7 }, (_, i) => ({ id: 200 + i, username: `Match${i}` })) }))
    return original(path, init)
  })
  await screen.findByLabelText('Find a friend')
  fireEvent.change(search(), { target: { value: 'mat' } })
  await waitFor(() => expect(document.querySelectorAll('#friend-matches option')).toHaveLength(5))
  expect(search()).toHaveAttribute('list', 'friend-matches')
  fireEvent.change(search(), { target: { value: 'Match2' } })
  fireEvent.click(screen.getByRole('button', { name: 'Send Request' }))
  await waitFor(() => expect(fetch.mock.calls.some(([path, init]) => path === '/api/friends/requests/' && init?.body === JSON.stringify({ username: 'Match2' }))).toBe(true))
})

const blueHour = { id: 9, name: 'Blue Hour', player_count: 4, max_players: 6, status: 'waiting' as const }

test('S20: friends show Playing, Online or Offline with the table they are at', async () => {
  setup(undefined, lists({
    friends: [
      friend(1, 'Mira', { status: 'at_table', table: blueHour }),
      friend(5, 'Sage', { status: 'online', table: null }),
      friend(6, 'Kai'),
      friend(7, 'Nova', { status: 'at_table', table: { ...blueHour, id: 10, name: 'After Hours', player_count: 6 } }),
    ],
    online_count: 3,
  }))
  const grid = await screen.findByRole('list', { name: 'Your friends' })
  const card = (name: string) => within(grid).getByRole('heading', { name }).closest('li') as HTMLElement
  expect(within(card('Mira')).getByText('Playing')).toBeVisible()
  expect(within(card('Mira')).getByText('Blue Hour · 4 / 6 players')).toBeVisible()
  expect(within(card('Mira')).getByRole('link', { name: 'Join Game with Mira' })).toHaveAttribute('href', '/tables/9')
  expect(within(card('Sage')).getByText('Online')).toBeVisible()
  expect(within(card('Sage')).getByText('Browsing RIVR')).toBeVisible()
  expect(within(card('Sage')).queryByRole('link', { name: /Join Game/ })).not.toBeInTheDocument()
  expect(within(card('Kai')).getByText('Offline')).toBeVisible()
  expect(within(card('Nova')).getByText('After Hours · Table full')).toBeVisible()
  expect(within(card('Nova')).queryByRole('link', { name: /Join Game/ })).not.toBeInTheDocument()
  expect(within(card('Nova')).getByText('Table full', { selector: '.button' })).toHaveAttribute('aria-disabled', 'true')
  expect(screen.getByText('YOUR CREW · 4 FRIENDS · 3 ONLINE')).toBeVisible()
  expect(await screen.findByRole('link', { name: '3 friends online' })).toHaveAttribute('href', '/friends')
})

test('S20: the Online tab lists friends at a table first, then online, and hides offline friends', async () => {
  setup(undefined, lists({
    friends: [
      friend(5, 'sage', { status: 'online', table: null }),
      friend(6, 'Kai'),
      friend(1, 'Mira', { status: 'at_table', table: blueHour }),
      friend(8, 'Bea', { status: 'online', table: null }),
    ],
    online_count: 3,
  }))
  fireEvent.click(await screen.findByRole('button', { name: 'Online · 3' }))
  expect(screen.getByRole('button', { name: 'Online · 3' })).toHaveAttribute('aria-pressed', 'true')
  const online = screen.getByRole('list', { name: 'Friends online' })
  expect(within(online).getAllByRole('heading').map((h) => h.textContent)).toEqual(['Mira', 'Bea', 'sage'])
  expect(screen.queryByRole('list', { name: 'Your friends' })).not.toBeInTheDocument()
})

test('S20: the Online tab explains when nobody is online', async () => {
  setup()
  fireEvent.click(await screen.findByRole('button', { name: 'Online · 0' }))
  expect(screen.getByText('None of your friends are online right now.')).toBeVisible()
})

test('S20: the page refreshes online status while open', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  try {
    let online = false
    const fetch = vi.fn().mockImplementation((path: string) => {
      if (String(path).includes('creation-context')) return Promise.resolve(respond(context))
      const presence: Presence = online ? { status: 'online', table: null } : OFFLINE
      return Promise.resolve(respond(lists({ friends: [friend(1, 'Mira', presence)], online_count: online ? 1 : 0 })))
    })
    vi.stubGlobal('fetch', fetch)
    render(<MemoryRouter initialEntries={['/friends']}><AppRoutes /></MemoryRouter>)
    const grid = await screen.findByRole('list', { name: 'Your friends' })
    expect(within(grid).getByText('Offline')).toBeVisible()
    online = true
    await act(async () => { await vi.advanceTimersByTimeAsync(PRESENCE_POLL_MS) })
    expect(await within(grid).findByText('Online')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Online · 1' })).toBeVisible()
  } finally {
    vi.useRealTimers()
  }
})
