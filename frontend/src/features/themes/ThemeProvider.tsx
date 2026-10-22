import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { readTheme, THEME_STORAGE_KEY } from './theme'
import type { Theme } from './theme'

import { ThemeContext } from './useTheme'

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, updateTheme] = useState<Theme>(readTheme)
  const [storageError, setStorageError] = useState(false)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

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
