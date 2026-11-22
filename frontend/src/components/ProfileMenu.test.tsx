import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, expect, test, vi } from 'vitest'
import { ProfileMenu } from './ProfileMenu'

function Location() { return <p>{useLocation().pathname}</p> }
function setup(signedIn = true, canManageAds = false) {
  const onSignedOut = vi.fn()
  render(<MemoryRouter><ProfileMenu signedIn={signedIn} canManageAds={canManageAds} onSignedOut={onSignedOut}>
    <span>Avatar</span>
  </ProfileMenu><Location /><button>Outside</button></MemoryRouter>)
  return onSignedOut
}
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

test('avatar and chevron share an accessible toggle; Escape restores focus', () => {
  setup()
  const trigger = screen.getByRole('button', { name: 'Account options' })
  fireEvent.click(screen.getByText('Avatar'))
  expect(trigger).toHaveAttribute('aria-expanded', 'true')
  expect(screen.getByRole('link', { name: 'Settings & avatar' })).toHaveAttribute('href', '/settings')
  fireEvent.keyDown(document, { key: 'Escape' })
  expect(trigger).toHaveFocus()
  expect(trigger).toHaveAttribute('aria-expanded', 'false')
  fireEvent.click(trigger.querySelector('img')!)
  expect(trigger).toHaveAttribute('aria-expanded', 'true')
})
test('outside pointer and focus leaving dismiss account shortcuts', () => {
  setup()
  const trigger = screen.getByRole('button', { name: 'Account options' })
  fireEvent.click(trigger)
  fireEvent.pointerDown(screen.getByRole('button', { name: 'Outside' }))
  expect(trigger).toHaveAttribute('aria-expanded', 'false')
  fireEvent.click(trigger)
  fireEvent.blur(trigger, { relatedTarget: screen.getByRole('button', { name: 'Outside' }) })
  expect(trigger).toHaveAttribute('aria-expanded', 'false')
})
test('signed-out visitors get account entry links', () => {
  setup(false)
  fireEvent.click(screen.getByRole('button', { name: 'Account options' }))
  expect(screen.getByRole('link', { name: 'Create account' })).toHaveAttribute('href', '/register')
  expect(screen.queryByRole('button', { name: 'Sign out' })).not.toBeInTheDocument()
})
test('sign out obtains fresh CSRF, ends the session and navigates to login', async () => {
  const fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ csrf_token: 'fresh-token' })))
    .mockResolvedValueOnce(new Response('{}'))
  vi.stubGlobal('fetch', fetch)
  const onSignedOut = setup()
  fireEvent.click(screen.getByRole('button', { name: 'Account options' }))
  fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))
  await waitFor(() => expect(onSignedOut).toHaveBeenCalledOnce())
  expect(fetch.mock.calls[1][0]).toBe('/api/auth/logout/')
  expect(new Headers(fetch.mock.calls[1][1].headers).get('X-CSRFToken')).toBe('fresh-token')
  expect(await screen.findByText('/login')).toBeVisible()
})
test('failed sign out leaves the session intact and offers retry', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Offline')))
  const onSignedOut = setup()
  fireEvent.click(screen.getByRole('button', { name: 'Account options' }))
  fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('We could not sign you out')
  expect(onSignedOut).not.toHaveBeenCalled()
  expect(screen.getByRole('button', { name: 'Sign out' })).toBeEnabled()
})

test.each([true, false])('Manage ads shortcut follows the permission flag (%s)', canManageAds => {
  setup(true, canManageAds)
  fireEvent.click(screen.getByRole('button', { name: 'Account options' }))
  const link = screen.queryByRole('link', { name: 'Manage ads' })
  if (canManageAds) expect(link).toHaveAttribute('href', '/manage-ads')
  else expect(link).not.toBeInTheDocument()
})
