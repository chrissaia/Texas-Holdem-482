import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, test, vi } from 'vitest'
import { AppRoutes } from '../../App'

const anonymous = {
  state: 'anonymous',
  user: null,
  guest: null,
  csrf_token: 'csrf-1',
}
const registered = {
  state: 'registered',
  user: { id: 3, username: 'Finn', email: 'finn@example.com', is_admin: false },
  guest: null,
  csrf_token: 'csrf-2',
}
const guest = {
  state: 'guest',
  user: null,
  guest: { name: 'River Jay' },
  csrf_token: 'csrf-3',
}
const respond = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status })

type Handler = (init?: RequestInit) => Response | Promise<Response>

/** Routes fetch by URL so the page and the app shell can load in any order. */
function mockApi(handlers: Record<string, Handler>) {
  let host: { id: number; username: string } | null = null
  const fetch = vi.fn(async (path: string, init?: RequestInit) => {
    if (path === '/api/tables/creation-context/')
      return respond({ host, csrf_token: 'tables-csrf' })
    const handler = handlers[path]
    if (!handler) throw new Error(`Unexpected request to ${path}`)
    const response = await handler(init)
    const body = await response.clone().json()
    if (body.user) host = { id: body.user.id, username: body.user.username }
    return response
  })
  vi.stubGlobal('fetch', fetch)
  return fetch
}
const posts = (fetch: ReturnType<typeof mockApi>, path: string) =>
  fetch.mock.calls.filter(([url]) => url === path)
const csrfHeader = (init?: RequestInit) =>
  ((init?.headers ?? {}) as Record<string, string>)['X-CSRFToken']
const start = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>,
  )
const type = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } })

afterEach(() => vi.unstubAllGlobals())

test('signs in with the session CSRF token and returns home as that player', async () => {
  const fetch = mockApi({
    '/api/auth/session/': () => respond(anonymous),
    '/api/auth/login/': () => respond(registered),
  })
  start('/login')
  expect(
    screen.getByRole('heading', { name: 'Welcome back.' }),
  ).toBeVisible()
  await screen.findByLabelText('Username')
  type('Username', '  Finn ')
  type('Password', 'correct horse battery')
  fireEvent.click(screen.getByRole('button', { name: 'Sign in →' }))

  expect(
    await screen.findByRole('heading', {
      name: 'Make room for your next poker night.',
    }),
  ).toBeVisible()
  const [[, options]] = posts(fetch, '/api/auth/login/')
  expect(options?.method).toBe('POST')
  expect(options?.credentials).toBe('same-origin')
  expect(csrfHeader(options)).toBe(
    'csrf-1',
  )
  expect(JSON.parse(options?.body as string)).toEqual({
    username: 'Finn',
    password: 'correct horse battery',
  })
  // The shell reloads its session, so the sidebar now names the player.
  expect(await screen.findByText('Registered player')).toBeVisible()
})

test('shows the generic invalid-credentials message and stays on sign in', async () => {
  mockApi({
    '/api/auth/session/': () => respond(anonymous),
    '/api/auth/login/': () =>
      respond({ non_field_errors: ['Invalid username or password.'] }, 400),
  })
  start('/login')
  await screen.findByLabelText('Username')
  type('Username', 'Finn')
  type('Password', 'wrong-password')
  fireEvent.click(screen.getByRole('button', { name: 'Sign in →' }))
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Invalid username or password.',
  )
  expect(screen.getByRole('button', { name: 'Sign in →' })).toBeEnabled()
})

test('blank sign-in fields are flagged without calling the API', async () => {
  const fetch = mockApi({ '/api/auth/session/': () => respond(anonymous) })
  start('/login')
  await screen.findByLabelText('Username')
  fireEvent.click(screen.getByRole('button', { name: 'Sign in →' }))
  expect(await screen.findByText('Enter your username.')).toBeVisible()
  expect(screen.getByText('Enter your password.')).toBeVisible()
  expect(screen.getByLabelText('Username')).toHaveAttribute(
    'aria-invalid',
    'true',
  )
  await waitFor(() => expect(screen.getByLabelText('Username')).toHaveFocus())
  expect(posts(fetch, '/api/auth/login/')).toHaveLength(0)
})

test('features without backend support are visibly unavailable', async () => {
  mockApi({ '/api/auth/session/': () => respond(anonymous) })
  start('/login')
  await screen.findByLabelText('Username')
  expect(screen.getByText('Forgot password?')).toHaveAttribute(
    'aria-disabled',
    'true',
  )
  expect(screen.getByLabelText('Keep me signed in')).toBeDisabled()
  fireEvent.click(
    screen.getByRole('link', { name: 'Register - get 1,000 chips' }),
  )
  expect(
    await screen.findByRole('heading', { name: 'Make yourself at home.' }),
  ).toBeVisible()
})

const fillRegistration = () => {
  type('Email address', ' Finn@Example.com ')
  type('Username', 'Finn')
  type('Password', 'a-long-passphrase')
  type('Confirm password', 'a-long-passphrase')
  fireEvent.click(
    screen.getByLabelText(
      'I confirm that I meet the minimum age requirement to use this service.',
    ),
  )
}

test('registers with only the three API fields and signs the player in', async () => {
  const fetch = mockApi({
    '/api/auth/session/': () => respond(anonymous),
    '/api/auth/register/': () => respond(registered, 201),
  })
  start('/register')
  await screen.findByLabelText('Email address')
  fillRegistration()
  fireEvent.click(screen.getByRole('button', { name: 'Create account →' }))
  expect(await screen.findByText('Registered player')).toBeVisible()
  const [[, options]] = posts(fetch, '/api/auth/register/')
  expect(csrfHeader(options)).toBe(
    'csrf-1',
  )
  expect(JSON.parse(options?.body as string)).toEqual({
    email: 'Finn@Example.com',
    username: 'Finn',
    password: 'a-long-passphrase',
  })
})

test('mismatched passwords and a missing age confirmation block registration', async () => {
  const fetch = mockApi({ '/api/auth/session/': () => respond(anonymous) })
  start('/register')
  await screen.findByLabelText('Email address')
  type('Email address', 'finn@example.com')
  type('Username', 'Finn')
  type('Password', 'a-long-passphrase')
  type('Confirm password', 'something-else')
  fireEvent.click(screen.getByRole('button', { name: 'Create account →' }))
  expect(await screen.findByText('Passwords do not match.')).toBeVisible()
  expect(
    screen.getByText('Confirm that you meet the minimum age requirement.'),
  ).toBeVisible()
  expect(posts(fetch, '/api/auth/register/')).toHaveLength(0)
})

test('server field errors appear under the matching registration field', async () => {
  mockApi({
    '/api/auth/session/': () => respond(anonymous),
    '/api/auth/register/': () =>
      respond(
        {
          username: ['A user with that username already exists.'],
          password: ['This password is too common.'],
        },
        400,
      ),
  })
  start('/register')
  await screen.findByLabelText('Email address')
  fillRegistration()
  fireEvent.click(screen.getByRole('button', { name: 'Create account →' }))
  expect(
    await screen.findByText('A user with that username already exists.'),
  ).toBeVisible()
  expect(screen.getByText('This password is too common.')).toBeVisible()
  const username = screen.getByLabelText('Username')
  expect(username).toHaveAttribute('aria-invalid', 'true')
  expect(username.getAttribute('aria-describedby')).toContain(
    'register-username-error',
  )
  await waitFor(() => expect(username).toHaveFocus())
})

test('starts a guest session with the trimmed name', async () => {
  const fetch = mockApi({
    '/api/auth/session/': () => respond(anonymous),
    '/api/auth/guest/': () => respond(guest, 201),
  })
  start('/guest')
  await screen.findByLabelText('Temporary username')
  type('Temporary username', '  River Jay  ')
  fireEvent.click(screen.getByRole('button', { name: 'Continue as Guest →' }))
  expect(
    await screen.findByRole('heading', {
      name: 'Make room for your next poker night.',
    }),
  ).toBeVisible()
  const [[, options]] = posts(fetch, '/api/auth/guest/')
  expect(JSON.parse(options?.body as string)).toEqual({ name: 'River Jay' })
  // Guests are not hosts, so the sidebar still invites them to sign in.
  expect(screen.getByRole('link', { name: 'Sign in to host a table' })).toBeVisible()
})

test('rejects too-short guest names locally and shows server name errors', async () => {
  const fetch = mockApi({
    '/api/auth/session/': () => respond(anonymous),
    '/api/auth/guest/': () =>
      respond({ name: ['That name belongs to a registered player.'] }, 400),
  })
  start('/guest')
  await screen.findByLabelText('Temporary username')
  type('Temporary username', 'R')
  fireEvent.click(screen.getByRole('button', { name: 'Continue as Guest →' }))
  expect(await screen.findByText('Use 2–20 characters.')).toBeVisible()
  expect(posts(fetch, '/api/auth/guest/')).toHaveLength(0)

  type('Temporary username', 'Finn')
  fireEvent.click(screen.getByRole('button', { name: 'Continue as Guest →' }))
  expect(
    await screen.findByText('That name belongs to a registered player.'),
  ).toBeVisible()
})

test('a CSRF failure asks the player to retry and fetches a fresh token', async () => {
  const fetch = mockApi({
    '/api/auth/session/': () => respond(anonymous),
    '/api/auth/guest/': () =>
      respond({ detail: 'CSRF Failed: CSRF token missing.' }, 403),
  })
  start('/guest')
  await screen.findByLabelText('Temporary username')
  type('Temporary username', 'River')
  fireEvent.click(screen.getByRole('button', { name: 'Continue as Guest →' }))
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Your session could not be verified. Please try again.',
  )
  await waitFor(() =>
    expect(posts(fetch, '/api/auth/session/').length).toBeGreaterThan(1),
  )
})

test('a network failure while submitting shows a connection message', async () => {
  mockApi({
    '/api/auth/session/': () => respond(anonymous),
    '/api/auth/login/': () => {
      throw new TypeError('Failed to fetch')
    },
  })
  start('/login')
  await screen.findByLabelText('Username')
  type('Username', 'Finn')
  type('Password', 'whatever-password')
  fireEvent.click(screen.getByRole('button', { name: 'Sign in →' }))
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Unable to reach RIVR. Check your connection and try again.',
  )
})

test('a failed session check can be retried', async () => {
  let calls = 0
  mockApi({
    '/api/auth/session/': () =>
      ++calls === 1 ? respond({}, 500) : respond(anonymous),
  })
  start('/register')
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'We could not check your session. Please try again.',
  )
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
  expect(await screen.findByLabelText('Email address')).toBeVisible()
})

test('signed-in players see who they are and can sign out', async () => {
  const fetch = mockApi({
    '/api/auth/session/': () => respond(registered),
    '/api/auth/logout/': () => respond(anonymous),
  })
  start('/login')
  expect(await screen.findByText(/signed in as/)).toHaveTextContent(
    'You’re signed in as Finn.',
  )
  expect(screen.queryByLabelText('Password')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))
  expect(await screen.findByLabelText('Password')).toBeVisible()
  const [[, options]] = posts(fetch, '/api/auth/logout/')
  expect(csrfHeader(options)).toBe(
    'csrf-2',
  )
})

test('guests are labelled as guests, and a failed sign-out is reported', async () => {
  mockApi({
    '/api/auth/session/': () => respond(guest),
    '/api/auth/logout/': () => respond({}, 500),
  })
  start('/guest')
  expect(await screen.findByText(/signed in as/)).toHaveTextContent(
    'You’re signed in as River Jay (guest).',
  )
  fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'We could not sign you out. Please try again.',
  )
})
