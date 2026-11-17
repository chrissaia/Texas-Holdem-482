/**
 * Module: disclaimer/DisclaimerPage.tsx.
 * S3: anyone can read the disclaimer at /disclaimer. Registered players and guests can accept it here.
 */
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getSession } from '../auth/api'
import type { Session } from '../auth/types'
import { DisclaimerForm, DisclaimerText } from './Disclaimer'

export function DisclaimerPage() {
  const [session, setSession] = useState<Session | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    getSession()
      .then(value => { if (active) setSession(value) })
      .catch(() => { if (active) setError('We could not check your session. Refresh to try again.') })
    return () => { active = false }
  }, [])
  return (
    <section className="disclaimer-page">
      <header className="page-intro">
        <span className="eyebrow">PLAY MONEY DISCLAIMER</span>
        <h1>Play for fun. Never for cash.</h1>
      </header>
      <div className="panel">
        <DisclaimerText />
        {error ? <p role="alert" className="notice error-notice">{error}</p>
          : !session ? <p role="status">Checking your session…</p>
          : session.disclaimer_accepted ? <p role="status" className="notice">You have accepted this disclaimer. <Link to="/lobby">Find a table →</Link></p>
          : session.state === 'anonymous' ? <p className="notice"><Link to="/login">Sign in</Link> or <Link to="/guest">continue as a guest</Link> to accept.</p>
          : <DisclaimerForm csrfToken={session.csrf_token} onAccepted={setSession} />}
      </div>
    </section>
  )
}
