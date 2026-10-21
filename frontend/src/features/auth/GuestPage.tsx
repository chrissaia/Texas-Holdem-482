import { useState } from 'react'
import { Link } from 'react-router-dom'
import { FormField } from '../../components/FormField'
import info from '../../assets/figma/info.svg'
import avatarGuest from '../../assets/figma/avatar-guest.svg'
import chipBase from '../../assets/figma/chip-base-48.png'
import chipInset from '../../assets/figma/chip-inset-38.svg'
import { AuthLayout } from './AuthLayout'
import { startGuest } from './api'
import { FormMessage, SessionGate } from './SessionGate'
import { useAuthForm } from './useAuthForm'
import { validateGuestName } from './validation'

// Avatars and chip balances belong to Royal's stories, so these are display-only for now.
const AVATARS = ['RV', 'SP', 'CL', 'DI', 'HE']

export function GuestPage({ onSignedIn }: { onSignedIn: () => void }) {
  const { form: formRef, pending, errors, submit, ...gate } =
    useAuthForm(onSignedIn)
  const [name, setName] = useState('')

  return (
    <AuthLayout>
      <h1 className="auth-title">Just here to play?</h1>
      <p className="auth-subtitle">
        Take a temporary seat. No account required.
      </p>
      <SessionGate {...gate}>
        <form
          ref={formRef}
          className="auth-form"
          noValidate
          onSubmit={(event) => {
            event.preventDefault()
            submit(validateGuestName(name), (csrf) =>
              startGuest({ name: name.trim() }, csrf),
            )
          }}
        >
          <FormField
            id="guest-name"
            label="Temporary username"
            autoComplete="nickname"
            placeholder="Guest_482"
            hint="Your guest name is reserved for this browser session."
            value={name}
            errors={errors.name}
            onChange={(event) => setName(event.target.value)}
          />
          <div
            className="auth-avatars unavailable"
            role="group"
            aria-label="Choose a temporary avatar (coming soon)"
            title="Coming in a later story"
          >
            <p className="field-label">Choose a temporary avatar</p>
            <div className="auth-avatar-row">
              {AVATARS.map((initials) => (
                <div className="avatar auth-avatar" key={initials}>
                  <img src={avatarGuest} alt="" width="54" height="54" />
                  <span>{initials}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="auth-balance">
            <div className="auth-chip" aria-hidden="true">
              <img src={chipBase} alt="" width="48" height="48" />
              <img className="inset" src={chipInset} alt="" width="38" height="38" />
              <span>1K</span>
            </div>
            <div>
              <p className="auth-balance-amount">1,000</p>
              <p className="muted">starting virtual chips</p>
            </div>
          </div>
          <div className="notice auth-notice">
            <img src={info} alt="" width="20" height="20" />
            <div>
              <p className="auth-notice-title">Progress is temporary</p>
              <p>
                Your balance and play history may reset when this session ends.
                Friends, messages, and seasonal progression require an account.
              </p>
            </div>
          </div>
          <FormMessage messages={errors.non_field_errors} />
          <button
            className="button primary full-width"
            type="submit"
            disabled={pending}
          >
            {pending ? 'Joining…' : 'Continue as Guest →'}
          </button>
        </form>
      </SessionGate>
      <p className="auth-prompt">
        Create an account to save your progress, friends, achievements, stats,
        and chips.
      </p>
      <Link className="button full-width" to="/register">
        Create a free account
      </Link>
      <Link className="auth-link auth-small" to="/login">
        Already a member? Sign in
      </Link>
    </AuthLayout>
  )
}
