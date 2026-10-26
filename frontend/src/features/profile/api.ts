import { request } from '../../api/client'
import type { Profile, ProfileResponse } from './types'

export const getProfile = () => request<ProfileResponse>('/api/profile/')
export const uploadAvatar = (file: File, token: string) => {
  const body = new FormData()
  body.append('avatar', file)
  return request<Profile>('/api/profile/avatar/', {
    method: 'POST',
    headers: { 'X-CSRFToken': token },
    body,
  })
}
export const claimDaily = (token: string) =>
  request<Profile>('/api/profile/daily-chips/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRFToken': token },
    body: '{}',
  })
