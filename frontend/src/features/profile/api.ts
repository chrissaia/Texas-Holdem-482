/**
 * Module: profile/api.ts.
 * Typed HTTP operations for profile, using the shared same-origin API client.
 */
import { request } from '../../api/client'
import type { Profile, ProfileResponse } from './types'

/** Fetch the current account's private profile and reward availability. */
export const getProfile = () => request<ProfileResponse>('/api/profile/')
/** Submit the chosen avatar as multipart data with CSRF protection. */
export const uploadAvatar = (file: File, token: string) => {
  const body = new FormData()
  body.append('avatar', file)
  return request<Profile>('/api/profile/avatar/', {
    method: 'POST',
    headers: { 'X-CSRFToken': token },
    body,
  })
}
/** Request the fixed daily chip reward without client-controlled amounts. */
export const claimDaily = (token: string) =>
  request<Profile>('/api/profile/daily-chips/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRFToken': token },
    body: '{}',
  })
