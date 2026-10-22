import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { AppRoutes } from '../../App'
import { ThemeProvider } from './ThemeProvider'
import { SettingsPage } from './SettingsPage'
import { initializeTheme, readTheme, THEME_STORAGE_KEY } from './theme'

beforeEach(() => {
  localStorage.clear()
  delete document.documentElement.dataset.theme
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ host: null, csrf_token: 'csrf' })),
  ))
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  localStorage.clear()
  delete document.documentElement.dataset.theme
})

function settings() {
  return render(<ThemeProvider><SettingsPage /></ThemeProvider>)
}

test('defaults to dark and initializes the document before React renders', () => {
  initializeTheme()
  expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
  settings()
  expect(screen.getByRole('combobox', { name: 'Theme' })).toHaveValue('dark')
})

test.each(['dark', 'light'])('restores saved %s on a new mount', (theme) => {
  localStorage.setItem(THEME_STORAGE_KEY, theme)
  initializeTheme()
  expect(document.documentElement).toHaveAttribute('data-theme', theme)
  settings()
  expect(screen.getByLabelText('Theme')).toHaveValue(theme)
})

test.each(['invalid', 'LIGHT', ''])('falls back for invalid saved value %s', (value) => {
  localStorage.setItem(THEME_STORAGE_KEY, value)
  expect(readTheme()).toBe('dark')
})

test('switches both ways and restores the saved selection after remounting', () => {
  const page = settings()
  fireEvent.change(screen.getByLabelText('Theme'), { target: { value: 'light' } })
  expect(document.documentElement).toHaveAttribute('data-theme', 'light')
  expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light')
  page.unmount()
  settings()
  expect(screen.getByLabelText('Theme')).toHaveValue('light')
  fireEvent.change(screen.getByLabelText('Theme'), { target: { value: 'dark' } })
  expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
  expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
})

test('unreadable storage does not prevent startup', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
  initializeTheme()
  settings()
  expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
})

test('changes the current theme and explains failed persistence, then recovers', () => {
  const save = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('full') })
  settings()
  fireEvent.change(screen.getByLabelText('Theme'), { target: { value: 'light' } })
  expect(document.documentElement).toHaveAttribute('data-theme', 'light')
  expect(screen.getByRole('status')).toHaveTextContent('could not save')
  save.mockRestore()
  fireEvent.change(screen.getByLabelText('Theme'), { target: { value: 'dark' } })
  expect(screen.getByRole('status')).toBeEmptyDOMElement()
})

test.each([null, { id: 7, username: 'Kelechi' }])(
  'keeps browser preference across navigation for host %j', async (host) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ host, csrf_token: 'csrf' })),
    ))
    render(<MemoryRouter initialEntries={['/settings']}><AppRoutes /></MemoryRouter>)
    await waitFor(() => expect(fetch).toHaveBeenCalled())
    fireEvent.change(screen.getByLabelText('Theme'), { target: { value: 'light' } })
    fireEvent.click(screen.getByRole('link', { name: 'RIVR home' }))
    expect(await screen.findByRole('heading', { name: 'Make room for your next poker night.' })).toBeVisible()
    expect(document.documentElement).toHaveAttribute('data-theme', 'light')
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Main navigation' })).getByRole('link', { name: 'Settings' }))
    expect(screen.getByLabelText('Theme')).toHaveValue('light')
  },
)
