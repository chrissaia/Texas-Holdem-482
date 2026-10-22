import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { Session } from './types'

export function SessionGate({
  session,
  loadError,
  reload,
  signOut,
  children,
}: {
  session: Session | null
  loadError: string
  reload: () => void
  signOut: () => void
  children: ReactNode
}) {
  if (loadError)
    return (
      <div className="notice error-notice" role="alert">
        {loadError}
        <button className="text-button" type="button" onClick={reload}>
          Try again
        </button>
      </div>
    )
  if (!session)
    return (
      <p className="muted" role="status">
        Checking your session…
      </p>
    )
  if (session.state !== 'anonymous') {
    const name =
      session.state === 'guest' ? session.guest?.name : session.user?.username
    return (
      <div className="notice auth-signed-in" role="status">
        <p>
          You’re signed in as <strong>{name}</strong>
          {session.state === 'guest' && ' (guest)'}.
        </p>
        <div className="auth-signed-in-actions">
          <Link className="button primary" to="/">
            Go to RIVR →
          </Link>
          <button className="button" type="button" onClick={signOut}>
            Sign out
          </button>
        </div>
      </div>
    )
  }
  return children
}

export function FormMessage({ messages }: { messages?: string[] }) {
  if (!messages) return null
  return (
    <div className="notice error-notice auth-message" role="alert">
      {messages.join(' ')}
    </div>
  )
}
