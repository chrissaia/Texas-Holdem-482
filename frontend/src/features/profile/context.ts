/**
 * Module: profile/context.ts.
 * Implement context for the profile feature and its importing components.
 */
import { createContext, useContext } from 'react'
import type { Profile } from './types'

export type ProfileState = {
  registered: boolean
  loading: boolean
  error: string
  profile: Profile | null
  token: string
  refresh: () => void
  update: (profile: Profile) => void
}
export const ProfileContext = createContext<ProfileState>({
  registered: false,
  loading: false,
  error: '',
  profile: null,
  token: '',
  refresh: /* Return the derived value for the enclosing operation. */ () => {},
  update: /* Return the derived value for the enclosing operation. */ () => {},
})
/** Read the active account profile from its provider. */
export const useProfile = () => useContext(ProfileContext)
