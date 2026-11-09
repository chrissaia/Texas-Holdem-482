/**
 * Module: auth/api.ts.
 * Typed HTTP operations for auth, using the shared same-origin API client.
 */
import { request } from '../../api/client'
import type { GuestInput, LoginInput, RegisterInput, Session } from './types'

/** Send an authentication POST with JSON input and the current CSRF token. */
const post = <T>(path: string, input: T, csrfToken: string) =>
  request<Session>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrfToken },
    body: JSON.stringify(input),
  })

/** Fetch the current identity and initialize the authentication CSRF token. */
export const getSession = () => request<Session>('/api/auth/session/')
/** Create a registered account and return its new authenticated session. */
export const register = (input: RegisterInput, csrfToken: string) =>
  post('/api/auth/register/', input, csrfToken)
/** Authenticate credentials and return the rotated session and CSRF token. */
export const login = (input: LoginInput, csrfToken: string) =>
  post('/api/auth/login/', input, csrfToken)
/** Establish a session-only guest identity from the supplied display name. */
export const startGuest = (input: GuestInput, csrfToken: string) =>
  post('/api/auth/guest/', input, csrfToken)
/** End the server session and return the anonymous session state. */
export const logout = (csrfToken: string) =>
  post('/api/auth/logout/', {}, csrfToken)
