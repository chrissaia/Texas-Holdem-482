import {
  act,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, test, vi } from 'vitest'
import { AppRoutes } from '../../App'
import { ProfileProvider } from './ProfileProvider'
import { ProfileContext, useProfile } from './context'
import { RewardsPage } from './RewardsPage'
import type { ProfileResponse } from './types'

const nextClaim = () => new Date(Date.now() + 60 * 60 * 1000).toISOString()
const initial: ProfileResponse = {
  id: 7,
  username: 'RiverJay',
  avatar_url: null,
  chip_balance: 1000,
  starting_chips_granted_at: '2026-10-25T00:00:00Z',
  daily_reward: { amount: 500, available: true, next_claim_at: null },
  csrf_token: 'profile-csrf',
}
const respond = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status })
function setup(
  path: string,
  handler: (
    path: string,
    init?: RequestInit,
  ) => Response | Promise<Response> = () => respond(initial),
  registered = true,
) {
  const fetch = vi
    .fn()
    .mockImplementation((path: string, init?: RequestInit) =>
      Promise.resolve(
        path.includes('creation-context')
          ? respond({
              host: registered ? { id: 7, username: 'RiverJay' } : null,
              csrf_token: 'token',
              profile_summary: registered ? initial : null,
            })
          : handler(path, init),
      ),
    )
  vi.stubGlobal('fetch', fetch)
  render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>,
  )
  return fetch
}
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.useRealTimers()
  localStorage.clear()
})

test('avatar upload uses multipart CSRF and updates account plus both shell avatars', async () => {
  const fetch = setup('/settings', (path) =>
    respond(
      path.endsWith('/avatar/')
        ? { ...initial, avatar_url: '/media/avatars/saved.webp' }
        : initial,
    ),
  )
  await screen.findByRole('heading', { name: 'Account' })
  const input = await screen.findByLabelText('Avatar image')
  const file = new File(['image fixture'], 'avatar.png', { type: 'image/png' })
  fireEvent.change(input, { target: { files: [file] } })
  expect(screen.getByText('Selected: avatar.png')).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Save avatar' }))
  expect(await screen.findByText('Your avatar has been saved.')).toBeVisible()
  const call = fetch.mock.calls.find(
    ([path]) => path === '/api/profile/avatar/',
  )!
  expect(call[1].headers['X-CSRFToken']).toBe('profile-csrf')
  expect(call[1].headers['Content-Type']).toBeUndefined()
  expect(call[1].body).toBeInstanceOf(FormData)
  expect(call[1].body.get('avatar').name).toBe('avatar.png')
  expect(screen.getByAltText('Your avatar')).toHaveAttribute(
    'src',
    '/media/avatars/saved.webp',
  )
  expect(document.querySelectorAll('.shell-uploaded-avatar')).toHaveLength(2)
  expect(screen.getByRole('button', { name: 'Save avatar' })).toBeDisabled()
  // Kelechi's theme control remains usable alongside the profile.
  fireEvent.change(screen.getByLabelText('Theme'), {
    target: { value: 'light' },
  })
  expect(document.documentElement.dataset.theme).toBe('light')
})

test.each([
  [
    new File(['x'], 'bad.svg', { type: 'image/svg+xml' }),
    'Choose a JPEG, PNG, or WebP image.',
  ],
  [
    new File([new Uint8Array(2 * 1024 * 1024 + 1)], 'big.png', {
      type: 'image/png',
    }),
    'Choose an image no larger than 2 MB.',
  ],
])('rejects invalid avatar before upload', async (file, message) => {
  const fetch = setup('/settings')
  fireEvent.change(await screen.findByLabelText('Avatar image'), {
    target: { files: [file] },
  })
  expect(screen.getByRole('alert')).toHaveTextContent(message)
  expect(screen.getByRole('button', { name: 'Save avatar' })).toBeDisabled()
  expect(
    fetch.mock.calls.filter(([path]) => path.includes('/avatar/')),
  ).toHaveLength(0)
})

test.each([400, 403, 500])(
  'avatar server error %s preserves retry feedback',
  async (status) => {
    setup('/settings', (path) =>
      respond(
        path.endsWith('/avatar/')
          ? { avatar: ['The image could not be saved.'] }
          : initial,
        path.endsWith('/avatar/') ? status : 200,
      ),
    )
    fireEvent.change(await screen.findByLabelText('Avatar image'), {
      target: { files: [new File(['x'], 'a.png', { type: 'image/png' })] },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save avatar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The image could not be saved.',
    )
  },
)

test('daily claim sends empty JSON and CSRF, updates displayed balance and disables repeats', async () => {
  const fetch = setup('/rewards', (path) =>
    respond(
      path.endsWith('/daily-chips/')
        ? {
            ...initial,
            chip_balance: 1500,
            daily_reward: {
              amount: 500,
              available: false,
              next_claim_at: nextClaim(),
            },
          }
        : initial,
    ),
  )
  fireEvent.click(
    await screen.findByRole('button', { name: 'Claim Daily Reward' }),
  )
  expect(
    await screen.findByText('500 virtual chips added to your balance.'),
  ).toBeVisible()
  expect(screen.getByRole('button', { name: 'Claimed today' })).toBeDisabled()
  expect(
    within(
      screen.getByRole('region', { name: 'Your virtual balance' }),
    ).getByText('1,500'),
  ).toBeVisible()
  expect(screen.getByText(/Next reward:/)).toBeVisible()
  const call = fetch.mock.calls.find(([path]) =>
    path.endsWith('/daily-chips/'),
  )!
  expect(call[1]).toMatchObject({
    method: 'POST',
    body: '{}',
    headers: { 'X-CSRFToken': 'profile-csrf' },
  })
  expect(
    fetch.mock.calls.filter(([path]) => path.endsWith('/daily-chips/')),
  ).toHaveLength(1)
})

test('existing account balance and already claimed reward persist on reload', async () => {
  setup('/rewards', () =>
    respond({
      ...initial,
      chip_balance: 500,
      starting_chips_granted_at: null,
      daily_reward: {
        amount: 500,
        available: false,
        next_claim_at: nextClaim(),
      },
    }),
  )
  expect(
    await screen.findByRole('button', { name: 'Claimed today' }),
  ).toBeDisabled()
  expect(
    screen.getByText(/This account has no recorded starting-chip grant/),
  ).toBeVisible()
})

test.each([403, 409, 503])(
  'daily error %s does not invent a successful payout',
  async (status) => {
    setup('/rewards', (path) =>
      respond(
        path.endsWith('/daily-chips/')
          ? { detail: 'Reward was not paid.' }
          : initial,
        path.endsWith('/daily-chips/') ? status : 200,
      ),
    )
    fireEvent.click(
      await screen.findByRole('button', { name: 'Claim Daily Reward' }),
    )
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Reward was not paid.',
    )
    expect(
      screen.queryByText('500 virtual chips added to your balance.'),
    ).not.toBeInTheDocument()
    expect(
      within(
        screen.getByRole('region', { name: 'Your virtual balance' }),
      ).getByText('1,000'),
    ).toBeVisible()
  },
)

test('duplicate clicks are blocked while a claim is pending', async () => {
  let finish!: (response: Response) => void
  const fetch = setup('/rewards', (path) =>
    path.endsWith('/daily-chips/')
      ? new Promise((resolve) => {
          finish = resolve
        })
      : respond(initial),
  )
  fireEvent.click(
    await screen.findByRole('button', { name: 'Claim Daily Reward' }),
  )
  expect(screen.getByRole('button', { name: 'Claiming…' })).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: 'Claiming…' }))
  expect(
    fetch.mock.calls.filter(([path]) => path.endsWith('/daily-chips/')),
  ).toHaveLength(1)
  finish(
    respond({
      ...initial,
      chip_balance: 1500,
      daily_reward: {
        amount: 500,
        available: false,
        next_claim_at: nextClaim(),
      },
    }),
  )
  await screen.findByText('500 virtual chips added to your balance.')
})

test('anonymous and guest views require a registered account', async () => {
  const fetch = setup('/rewards', () => respond(initial), false)
  expect(
    await screen.findByText(/Sign in with a registered account to use avatars/),
  ).toBeVisible()
  expect(
    fetch.mock.calls.filter(([path]) => path === '/api/profile/'),
  ).toHaveLength(0)
})

test('profile loading errors are retryable', async () => {
  let fail = true
  setup('/settings', () =>
    fail ? Promise.reject(new Error('offline')) : respond(initial),
  )
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'We could not load your profile',
  )
  fail = false
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
  expect(await screen.findByLabelText('Avatar image')).toBeVisible()
})

test('midnight timer refreshes eligibility rather than granting client-side chips', async () => {
  vi.useFakeTimers()
  const refresh = vi.fn()
  render(
    <MemoryRouter>
      <ProfileContext.Provider
        value={{
          profile: {
            ...initial,
            daily_reward: {
              amount: 500,
              available: false,
              next_claim_at: new Date(Date.now() + 2000).toISOString(),
            },
          },
          registered: true,
          loading: false,
          error: '',
          token: 'token',
          refresh,
          update: vi.fn(),
        }}
      >
        <RewardsPage />
      </ProfileContext.Provider>
    </MemoryRouter>,
  )
  await act(() => vi.advanceTimersByTimeAsync(3001))
  expect(refresh).toHaveBeenCalledTimes(1)
  expect(screen.getByRole('button', { name: 'Claimed today' })).toBeDisabled()
})

test('switching accounts ignores an in-flight previous owner response', async () => {
  let finish!: (value: Response) => void
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finish = resolve
          }),
      )
      .mockResolvedValueOnce(
        respond({ ...initial, id: 8, username: 'Other', chip_balance: 9 }),
      ),
  )
  function ReadProfile() {
    const state = useProfile()
    return <p>{state.profile?.username || 'Loading owner'}</p>
  }
  const view = render(
    <ProfileProvider registered accountId={7} enabled identityLoading={false}>
      <ReadProfile />
    </ProfileProvider>,
  )
  view.rerender(
    <ProfileProvider registered accountId={8} enabled identityLoading={false}>
      <ReadProfile />
    </ProfileProvider>,
  )
  expect(await screen.findByText('Other')).toBeVisible()
  await act(async () => finish(respond(initial)))
  expect(screen.queryByText('RiverJay')).not.toBeInTheDocument()
})
