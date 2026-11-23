import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, test, vi } from 'vitest'
import { ManageAdsPage } from './ManageAdsPage'

const endpoint = '/api/profile/ads/manage/'
const ad = { id: 4, title: 'Poker Night', kind: 'image', view_seconds: 5, reward: 75,
  active: true, revision: 'old', media_url: '/media/poker.png' }
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status })

function setup(handler: (url: string, options?: RequestInit) => Response) {
  const fetch = vi.fn(async (path: string, options?: RequestInit) => handler(path, options))
  vi.stubGlobal('fetch', fetch)
  render(<MemoryRouter><ManageAdsPage /></MemoryRouter>)
  return fetch
}
afterEach(() => vi.unstubAllGlobals())

test('admin creates a published ad with an actual file in the multipart request', async () => {
  const fetch = setup((_, options) => options?.method === 'POST'
    ? json(ad, 201) : json({ ads: [], daily_limit: 3, csrf_token: 'csrf' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Create ad' }))
  fireEvent.change(screen.getByLabelText('Title'), { target: { value: ad.title } })
  const file = new File(['image'], 'poster.png', { type: 'image/png' })
  fireEvent.change(screen.getByLabelText('Upload media'), { target: { files: [file] } })
  fireEvent.click(screen.getByLabelText('Show this ad to players'))
  // jsdom does not synchronize the native file list into a constructed FormData.
  const NativeFormData = FormData
  class MultipartWithFile extends NativeFormData {
    constructor(form: HTMLFormElement) {
      super(form)
      this.set('media', file)
    }
  }
  vi.stubGlobal('FormData', MultipartWithFile)
  fireEvent.submit(screen.getByRole('button', { name: 'Save ad' }).closest('form')!)
  expect(await screen.findByRole('status')).toHaveTextContent('Poker Night saved as active')
  const [path, options] = fetch.mock.calls.find(([, init]) => init?.method === 'POST')!
  expect(path).toBe(endpoint)
  expect((options!.body as FormData).get('media')).toBe(file)
  expect((options!.body as FormData).get('active')).toBe('on')
  expect(options!.headers).toEqual({ 'X-CSRFToken': 'csrf' })
})

test('admin can change the limit and unpublish an ad without replacing its media', async () => {
  const fetch = setup((url, options) => {
    if (url.endsWith('/policy/')) return json({ daily_limit: 1 })
    if (options?.method === 'POST') return json({ ...ad, active: false, revision: 'new' })
    return json({ ads: [ad], daily_limit: 3, csrf_token: 'csrf' })
  })
  const edit = await screen.findByRole('button', { name: 'Edit Poker Night' })
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Rewards per player per day' }), { target: { value: '1' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save limit' }))
  expect(await screen.findByRole('status')).toHaveTextContent('up to 1 ad reward per')
  expect(fetch.mock.calls.find(([url]) => url.endsWith('/policy/'))![1]?.body).toBe('{"daily_limit":1}')
  fireEvent.click(edit)
  fireEvent.click(screen.getByLabelText('Show this ad to players'))
  fireEvent.click(screen.getByRole('button', { name: 'Save ad' }))
  expect(await screen.findByRole('status')).toHaveTextContent('saved as inactive')
  const data = fetch.mock.calls.find(([url]) => url.endsWith('/4/'))![1]!.body as FormData
  expect(data.get('revision')).toBe('old')
  expect(data.has('media')).toBe(false)
  expect(data.has('active')).toBe(false)
})

test('a rejected upload shows the error and retains draft fields', async () => {
  setup((_, options) => options?.method === 'POST' ? json({ media: ['Invalid format.'] }, 400)
    : json({ ads: [ad], daily_limit: 3, csrf_token: 'csrf' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Edit Poker Night' }))
  fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Draft title' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save ad' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('media: Invalid format.')
  expect(screen.getByLabelText('Title')).toHaveValue('Draft title')
})

test('direct URL denies access without exposing the editor', async () => {
  setup(() => json({}, 403))
  expect(await screen.findByRole('alert')).toHaveTextContent('requires an authorized staff account')
  expect(screen.queryByRole('button', { name: 'Create ad' })).not.toBeInTheDocument()
})
