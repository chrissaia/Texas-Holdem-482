/**
 * Module: themes/ThemeProvider.tsx.
 * Implement ThemeProvider for the themes feature and its importing components.
 */
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { readTheme, THEME_STORAGE_KEY } from './theme'
import type { Theme } from './theme'

import { ThemeContext } from './useTheme'

/** Render the theme provider interface and its current state. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, updateTheme] = useState<Theme>(readTheme)
  const [storageError, setStorageError] = useState(false)

  useEffect(/* Synchronize component state with external data and release resources on cleanup. */ () => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  /** Update the theme context, document attributes and local storage. */
  function setTheme(next: Theme) {
    updateTheme(next)
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next)
      setStorageError(false)
    } catch {
      setStorageError(true)
    }
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, storageError }}>
      {children}
    </ThemeContext.Provider>
  )
}
