/**
 * Regression tests: disclaimer/DisclaimerPage.test.tsx.
 * S3: the disclaimer can be read by anyone and accepted by registered players and guests.
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, test, vi } from 'vitest'
import { DisclaimerPage } from './DisclaimerPage'

const session = { state: 'guest', user: null, guest: { name: 'Lucky' }, disclaimer_accepted: false, csrf_token: 'tok' }
const response = (body: unknown, code = 200) => new Response(JSON.stringify(body), { status: code })
const page = () => render(<MemoryRouter><DisclaimerPage /></MemoryRouter>)
afterEach(() => vi.unstubAllGlobals())

test('a guest can read and accept the disclaimer', async () => {
  const fetch = vi.fn().mockResolvedValueOnce(response(session))
    .mockResolvedValueOnce(response({ ...session, disclaimer_accepted: true }))
  vi.stubGlobal('fetch', fetch)
  page()
  expect(screen.getByText(/cannot be bought for, exchanged for, or redeemed for cash/)).toBeInTheDocument()
  fireEvent.click(await screen.findByRole('checkbox'))
  fireEvent.click(screen.getByRole('button', { name: 'I accept' }))
  expect(await screen.findByText(/You have accepted this disclaimer/)).toBeInTheDocument()
  expect(fetch.mock.calls[1][1]).toMatchObject({ method: 'POST', headers: { 'X-CSRFToken': 'tok' } })
})

test('anonymous visitors are asked to sign in or continue as a guest', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ ...session, state: 'anonymous', guest: null })))
  page()
  expect(await screen.findByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login')
  expect(screen.getByRole('link', { name: 'continue as a guest' })).toHaveAttribute('href', '/guest')
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
})

test('an account that already accepted sees confirmation, not the form', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ ...session, state: 'registered', disclaimer_accepted: true })))
  page()
  expect(await screen.findByText(/You have accepted this disclaimer/)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'I accept' })).not.toBeInTheDocument()
})

test('a session failure is reported', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
  page()
  expect(await screen.findByRole('alert')).toHaveTextContent('could not check your session')
})
