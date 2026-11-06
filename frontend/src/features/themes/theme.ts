/**
 * Module: themes/theme.ts.
 * Implement theme for the themes feature and its importing components.
 */
export type Theme = 'dark' | 'light'
export const THEME_STORAGE_KEY = 'rivr.theme'

/** Read the saved local theme, falling back when storage is unavailable. */
export function readTheme(): Theme {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) === 'light' ? 'light' : 'dark'
  } catch {
    return 'dark'
  }
}

/** Apply the initial theme to the document before rendering the app. */
export function initializeTheme() {
  document.documentElement.dataset.theme = readTheme()
}
