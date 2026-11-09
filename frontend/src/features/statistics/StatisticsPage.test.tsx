import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, test, vi } from 'vitest'
import { ProfileContext } from '../profile/context'
import { StatisticsPage } from './StatisticsPage'

const stats = { username: 'kelech1', period: 'all_time', hands_played: 3, hands_won: 1, hands_lost: 1, hands_split: 1, win_rate: 33.3 }
const empty = { ...stats, hands_played: 0, hands_won: 0, hands_lost: 0, hands_split: 0, win_rate: 0 }
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
function page(registered = true, loading = false, key = 'one') {
  return <MemoryRouter><ProfileContext.Provider value={{ registered, loading, error: '', profile: null, token: '', refresh: vi.fn(), update: vi.fn() }}><StatisticsPage key={key} /></ProfileContext.Provider></MemoryRouter>
}
afterEach(() => vi.unstubAllGlobals())

test('shows saved personal outcomes and defines win rate', async () => {
  const fetch = vi.fn().mockResolvedValue(response(stats))
  vi.stubGlobal('fetch', fetch)
  render(page())
  const summary = await screen.findByRole('region', { name: 'Performance overview' })
  expect(summary).toHaveTextContent('Hands played3')
  expect(summary).toHaveTextContent('Hands won1')
  expect(summary).toHaveTextContent('33.3%')
  const table = screen.getByRole('table', { name: 'Hand outcomes' })
  expect(within(table).getByRole('row', { name: 'Split 1 33.3%' })).toBeInTheDocument()
  expect(screen.getByText(/Split pots count/)).toBeInTheDocument()
  expect(screen.getByText(/kelech1 · Private to you/)).toBeInTheDocument()
  expect(fetch).toHaveBeenCalledWith('/api/profile/stats/', expect.objectContaining({ credentials: 'same-origin' }))
})

test('empty state has zeros and no invented results or graphs', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(empty)))
  render(page())
  expect(await screen.findByText('No recorded hands yet')).toBeInTheDocument()
  expect(screen.queryByRole('table')).not.toBeInTheDocument()
  expect(screen.getByText('0.0%')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Browse tables' })).toHaveAttribute('href', '/lobby')
})

test('guest sees sign-in without reading private stats', () => {
  const fetch = vi.fn()
  vi.stubGlobal('fetch', fetch)
  render(page(false))
  expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login')
  expect(fetch).not.toHaveBeenCalled()
})

test('identity loading hides account data', () => {
  vi.stubGlobal('fetch', vi.fn())
  render(page(false, true))
  expect(screen.getByRole('status')).toHaveTextContent('Checking your account')
})

test('network failure offers retry and then displays records', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(response(stats)))
  render(page())
  expect(await screen.findByRole('alert')).toHaveTextContent('could not load')
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
  expect(await screen.findByRole('table')).toBeInTheDocument()
})

test('manual refresh reads updated persisted counts', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(response(empty)).mockResolvedValueOnce(response(stats)))
  render(page())
  await screen.findByText('No recorded hands yet')
  fireEvent.click(screen.getByRole('button', { name: 'Refresh stats' }))
  expect(await screen.findByRole('table')).toBeInTheDocument()
  expect(screen.queryByText('No recorded hands yet')).not.toBeInTheDocument()
})

test('expired session hides previous data on refresh', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(response(stats)).mockResolvedValueOnce(response({ detail: 'Forbidden' }, 403)))
  render(page())
  await screen.findByRole('table')
  fireEvent.click(screen.getByRole('button', { name: 'Refresh stats' }))
  await screen.findByRole('alert')
  expect(screen.queryByRole('table')).not.toBeInTheDocument()
  expect(screen.queryByText(/kelech1 ·/)).not.toBeInTheDocument()
})

test('late response from prior account cannot replace the new account data', async () => {
  let finish: (response: Response) => void = () => {}
  vi.stubGlobal('fetch', vi.fn().mockReturnValueOnce(new Promise<Response>(resolve => { finish = resolve }))
    .mockResolvedValueOnce(response({ ...empty, username: 'second-player' })))
  const view = render(page())
  expect(screen.getByRole('status')).toHaveTextContent('Loading your statistics')
  expect(screen.getByRole('button', { name: 'Refresh stats' })).toBeDisabled()
  view.rerender(page(true, false, 'two'))
  await screen.findByText(/second-player · Private/)
  await act(async () => finish(response(stats)))
  expect(screen.queryByText(/kelech1 · Private/)).not.toBeInTheDocument()
  expect(screen.getByText('No recorded hands yet')).toBeInTheDocument()
})
