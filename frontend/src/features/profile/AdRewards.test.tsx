import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { AdRewards } from './AdRewards'
import { ProfileContext } from './context'

const ad = { id: 1, title: 'Campus Poker Club', kind: 'image', reward: 75, view_seconds: 3,
  claimed: false, media_url: '/media/rewarded-ads/example.png' }
const base = '/api/profile/ads/'
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
const profile = { id: 1, username: 'River', chip_balance: 1075 }
const modal = HTMLDialogElement.prototype
const originalShow = Object.getOwnPropertyDescriptor(modal, 'showModal')
const originalClose = Object.getOwnPropertyDescriptor(modal, 'close')

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  if (originalShow) Object.defineProperty(modal, 'showModal', originalShow)
  else Reflect.deleteProperty(modal, 'showModal')
  if (originalClose) Object.defineProperty(modal, 'close', originalClose)
  else Reflect.deleteProperty(modal, 'close')
})

// jsdom lacks native modal methods. Reflect their open state for role queries.
function mockDialog() {
  Object.defineProperties(modal, {
    showModal: { configurable: true, value(this: HTMLDialogElement) { this.open = true } },
    close: { configurable: true, value(this: HTMLDialogElement) { this.open = false } },
  })
}

function setup(handler: (url: string, init?: RequestInit) => Response, placement?: 'lobby' | 'rewards', registered = true) {
  mockDialog()
  const fetch = vi.fn(async (url: string, init?: RequestInit) => handler(url, init))
  vi.stubGlobal('fetch', fetch)
  const update = vi.fn()
  render(<ProfileContext.Provider value={{ registered, loading: false, error: '',
    token: 'csrf', profile: null, refresh: vi.fn(), update }}><AdRewards placement={placement} /></ProfileContext.Provider>)
  return { fetch, update }
}

test('uploaded image must load and viewing time must elapse before the wallet updates', async () => {
  let claimed = false
  const { fetch, update } = setup(url => {
    if (url === base) return json({ ads: [{ ...ad, claimed }], csrf_token: 'csrf', daily_limit: 3, remaining: claimed ? 2 : 3 })
    if (url.endsWith('/start/')) return json({ ...ad, token: 'playback' })
    claimed = true
    return json({ profile, awarded: 75 })
  })
  fireEvent.click(await screen.findByRole('button', { name: 'View Campus Poker Club' }))
  const image = await screen.findByRole('img', { name: ad.title })
  expect(screen.getByRole('dialog', { name: `Sponsored ad: ${ad.title}` })).toBeVisible()
  expect(image).toHaveAttribute('src', ad.media_url)
  const claim = screen.getByRole('button', { name: 'Claim ad reward' })
  expect(claim).toBeDisabled()
  vi.useFakeTimers()
  fireEvent.load(image)
  act(() => { vi.advanceTimersByTime(2999) })
  expect(claim).toBeDisabled()
  act(() => { vi.advanceTimersByTime(1) })
  expect(claim).toBeEnabled()
  vi.useRealTimers()
  fireEvent.click(claim)
  expect(await screen.findByRole('status')).toHaveTextContent('75 virtual chips earned')
  expect(await screen.findByRole('button', { name: /claimed today/ })).toBeDisabled()
  expect(update).toHaveBeenCalledWith(profile)
  const [url, options] = fetch.mock.calls.find(([path]) => path.includes('/claim/'))!
  expect(url).toBe(base + 'claim/playback/')
  expect(options).toMatchObject({ body: '{}', headers: { 'X-CSRFToken': 'csrf' } })
})

test('video requires completion in addition to viewing time, and claim errors surface', async () => {
  const videoAd = { ...ad, kind: 'video', media_url: '/media/rewarded-ads/example.mp4' }
  setup(url => url === base ? json({ ads: [videoAd], csrf_token: 'csrf', daily_limit: 3, remaining: 3 })
    : url.endsWith('/start/') ? json({ ...videoAd, token: 'video' }) : json({ detail: 'This ad changed.' }, 409))
  fireEvent.click(await screen.findByRole('button', { name: 'View Campus Poker Club' }))
  const video = await screen.findByLabelText(ad.title)
  expect(video.tagName).toBe('VIDEO')
  vi.useFakeTimers()
  fireEvent.play(video)
  act(() => { vi.advanceTimersByTime(3000) })
  expect(screen.getByRole('button', { name: 'Claim ad reward' })).toBeDisabled()
  fireEvent.ended(video)
  vi.useRealTimers()
  fireEvent.click(screen.getByRole('button', { name: 'Claim ad reward' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('This ad changed.')
})

test('exhausted limits block starts and empty catalogs explain availability', async () => {
  let empty = false
  setup(() => json({ ads: empty ? [] : [ad], csrf_token: 'csrf', daily_limit: 3, remaining: 0 }))
  expect(await screen.findByRole('button', { name: 'View Campus Poker Club' })).toBeDisabled()
  empty = true
  fireEvent.click(screen.getByRole('button', { name: 'Refresh ads' }))
  expect(await screen.findByText('No ads available right now.')).toBeVisible()
})

test('broken media blocks the claim and players can return to the catalog', async () => {
  setup(url => url === base ? json({ ads: [ad], csrf_token: 'csrf', daily_limit: 3, remaining: 3 })
    : json({ ...ad, token: 'broken' }))
  fireEvent.click(await screen.findByRole('button', { name: 'View Campus Poker Club' }))
  fireEvent.error(await screen.findByRole('img', { name: ad.title }))
  expect(screen.getByRole('alert')).toHaveTextContent('The ad could not play')
  expect(screen.getByRole('button', { name: 'Claim ad reward' })).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: 'Close ad' }))
  expect(await screen.findByRole('button', { name: 'View Campus Poker Club' })).toBeEnabled()
})


test('lobby displays a single eligible offer without starting or loading a video', async () => {
  const video = { ...ad, id: 2, title: 'Featured video', kind: 'video', media_url: '/media/ad.mp4' }
  const { fetch } = setup(url => url === base
    ? json({ ads: [{ ...ad, claimed: true }, video, { ...video, id: 3 }], daily_limit: 3, remaining: 1, csrf_token: 'lobby-csrf' })
    : json({ ...video, token: 'view' }), 'lobby')
  const offer = await screen.findByRole('button', { name: /View ad.*Earn 75 chips/ })
  expect(screen.getAllByRole('button', { name: /View ad/ })).toHaveLength(1)
  expect(screen.getByRole('region', { name: 'Sponsored chip offer' })).toHaveTextContent(video.title)
  expect(document.querySelector('video')).toBeNull()
  expect(fetch).toHaveBeenCalledTimes(1)
  fireEvent.click(offer)
  await screen.findByRole('dialog')
  expect(fetch.mock.calls[1][0]).toBe(base + '2/start/')
  expect(fetch.mock.calls[1][1]?.headers).toMatchObject({ 'X-CSRFToken': 'lobby-csrf' })
  fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(fetch.mock.calls.some(([url]) => url.includes('/claim/'))).toBe(false)
})

test('lobby keeps the slot hidden when the catalog is empty or exhausted', async () => {
  let resolve!: () => void
  const requested = new Promise<void>(done => { resolve = done })
  setup(() => { resolve(); return json({ ads: [ad], daily_limit: 3, remaining: 0, csrf_token: 'csrf' }) }, 'lobby')
  await act(() => requested)
  expect(screen.queryByRole('region', { name: 'Sponsored chip offer' })).not.toBeInTheDocument()
})

test('a guest does not load ads or see an offer', () => {
  const { fetch } = setup(() => json({}), 'lobby', false)
  expect(fetch).not.toHaveBeenCalled()
  expect(screen.queryByRole('region', { name: 'Sponsored chip offer' })).not.toBeInTheDocument()
})
