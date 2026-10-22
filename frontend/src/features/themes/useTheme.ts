import { createContext, useContext } from 'react'
import type { Theme } from './theme'

export const ThemeContext = createContext<{
  theme: Theme
  setTheme: (theme: Theme) => void
  storageError: boolean
} | null>(null)

export function useTheme() {
  const value = useContext(ThemeContext)
  if (!value) throw new Error('useTheme must be used inside ThemeProvider')
  return value
}
