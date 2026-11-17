/**
 * Module: disclaimer/Disclaimer.tsx.
 * S3: the play-money and age disclaimer. Players must accept it before joining a table;
 * the server records acceptance and refuses seats until then.
 */
import { useEffect, useId, useRef, useState } from 'react'
import type { Session } from '../auth/types'
import { acceptDisclaimer } from './api'
import { DISCLAIMER_POINTS } from './content'
import './disclaimer.css'

/** The disclaimer statements, used by the dialog and the standalone page. */
export function DisclaimerText() {
  return (
    <ul className="disclaimer-points">
      {DISCLAIMER_POINTS.map(point => <li key={point}>{point}</li>)}
    </ul>
  )
}

/** Age checkbox and accept button. Calls onAccepted only after the server saves the acceptance. */
export function DisclaimerForm({ csrfToken, onAccepted, onCancel }: {
  csrfToken: string
  onAccepted: (session: Session) => void
  onCancel?: () => void
}) {
  const checkId = useId()
  const [confirmed, setConfirmed] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const submit = async () => {
    setPending(true)
    setError('')
    try {
      onAccepted(await acceptDisclaimer(csrfToken))
    } catch {
      setError('We could not save your acceptance. Try again.')
    } finally {
      setPending(false)
    }
  }
  return (
    <form className="disclaimer-form" onSubmit={event => { event.preventDefault(); void submit() }}>
      <label className="disclaimer-check" htmlFor={checkId}>
        <input id={checkId} type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />
        I understand that RIVR uses play money only, and I confirm that I meet the minimum age requirement.
      </label>
      {error && <p role="alert" className="notice error-notice">{error}</p>}
      <div className="disclaimer-actions">
        <button type="submit" className="button primary" disabled={!confirmed || pending}>
          {pending ? 'Saving…' : 'I accept'}
        </button>
        {onCancel && <button type="button" className="button" onClick={onCancel} disabled={pending}>Not now</button>}
      </div>
    </form>
  )
}

/** Modal shown when a player tries to play before accepting. Escape or "Not now" closes it. */
export function DisclaimerDialog({ csrfToken, onAccepted, onClose }: {
  csrfToken: string
  onAccepted: (session: Session) => void
  onClose: () => void
}) {
  const titleId = useId()
  const ref = useRef<HTMLDivElement>(null)
  // Keep the latest onClose without re-running the focus effect on every parent render.
  const close = useRef(onClose)
  useEffect(() => { close.current = onClose })
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    ref.current?.focus()
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') close.current() }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      previous?.focus()
    }
  }, [])
  return (
    <div className="disclaimer-backdrop">
      <div ref={ref} className="panel disclaimer-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <span className="eyebrow">PLAY MONEY ONLY</span>
        <h2 id={titleId}>Before you take a seat</h2>
        <DisclaimerText />
        <DisclaimerForm csrfToken={csrfToken} onAccepted={onAccepted} onCancel={onClose} />
      </div>
    </div>
  )
}
