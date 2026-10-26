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
  refresh: () => {},
  update: () => {},
})
export const useProfile = () => useContext(ProfileContext)
