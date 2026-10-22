import { request } from '../../api/client'
import type { GuestInput, LoginInput, RegisterInput, Session } from './types'

const post = <T>(path: string, input: T, csrfToken: string) =>
  request<Session>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrfToken },
    body: JSON.stringify(input),
  })

export const getSession = () => request<Session>('/api/auth/session/')
export const register = (input: RegisterInput, csrfToken: string) =>
  post('/api/auth/register/', input, csrfToken)
export const login = (input: LoginInput, csrfToken: string) =>
  post('/api/auth/login/', input, csrfToken)
export const startGuest = (input: GuestInput, csrfToken: string) =>
  post('/api/auth/guest/', input, csrfToken)
export const logout = (csrfToken: string) =>
  post('/api/auth/logout/', {}, csrfToken)
