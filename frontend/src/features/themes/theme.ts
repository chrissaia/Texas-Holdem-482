export type Theme = 'dark' | 'light'
export const THEME_STORAGE_KEY = 'rivr.theme'

export function readTheme(): Theme {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) === 'light' ? 'light' : 'dark'
  } catch {
    return 'dark'
  }
}

export function initializeTheme() {
  document.documentElement.dataset.theme = readTheme()
}
