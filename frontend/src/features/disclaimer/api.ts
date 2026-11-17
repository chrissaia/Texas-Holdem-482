/**
 * Module: disclaimer/api.ts.
 * S3: record disclaimer acceptance for the signed-in account or guest session.
 */
import { request } from '../../api/client'
import type { Session } from '../auth/types'

/** Record acceptance for the current account or guest session; returns the updated session. */
export const acceptDisclaimer = (csrfToken: string) =>
  request<Session>('/api/auth/disclaimer/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrfToken },
    body: JSON.stringify({}),
  })
