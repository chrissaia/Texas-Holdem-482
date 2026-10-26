import type { ReactNode } from 'react'
import { useProfile } from './context'

export function ProfileGate({ children }: { children: ReactNode }) {
  const state = useProfile()
  if (state.loading && !state.profile)
    return <p role="status">Loading your account…</p>
  if (!state.registered)
    return (
      <div className="notice">
        Sign in with a registered account to use avatars and chip rewards.{' '}
        <a href="/login">Sign in</a>
      </div>
    )
  if (state.error)
    return (
      <div className="notice error-notice" role="alert">
        {state.error}
        <button type="button" className="text-button" onClick={state.refresh}>
          Try again
        </button>
      </div>
    )
  return state.profile ? children : null
}
