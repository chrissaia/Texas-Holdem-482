/**
 * Module: auth/RegisterPage.tsx.
 * Render the auth screen, including user actions, loading states and request feedback.
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { FormField } from '../../components/FormField'
import squareCheck from '../../assets/figma/square-check.svg'
import { AuthLayout } from './AuthLayout'
import { register } from './api'
import { FormMessage, SessionGate } from './SessionGate'
import { useAuthForm } from './useAuthForm'
import { type RegisterForm, validateRegister } from './validation'

/** Render the register page interface and its current state. */
export function RegisterPage({ onSignedIn }: { onSignedIn: () => void }) {
  const { form: formRef, pending, errors, submit, ...gate } =
    useAuthForm(onSignedIn)
  const [form, setForm] = useState<RegisterForm>({
    email: '',
    username: '',
    password: '',
    confirm: '',
    age: false,
  })
  /** Update the chosen form field and clear feedback from the previous submission. */
  const update = <K extends keyof RegisterForm>(key: K, value: RegisterForm[K]) =>
    setForm(/* Handle the setForm callback using the current operation's state. */ (current) => ({ ...current, [key]: value }))

  return (
    <AuthLayout>
      <h1 className="auth-title">Make yourself at home.</h1>
      <p className="auth-subtitle">
        Create your account. Keep every bit of your progress.
      </p>
      <span className="auth-badge">START WITH 1,000 VIRTUAL CHIPS</span>
      <SessionGate {...gate}>
        <form
          ref={formRef}
          className="auth-form"
          noValidate
          onSubmit={/* Return the derived value for the enclosing operation. */ (event) => {
            event.preventDefault()
            // Confirm-password and age are browser-only checks; the API takes three fields.
            submit(validateRegister(form), /* Handle the submit callback using the current operation's state. */ (csrf) =>
              register(
                {
                  email: form.email.trim(),
                  username: form.username.trim(),
                  password: form.password,
                },
                csrf,
              ),
            )
          }}
        >
          <FormField
            id="register-email"
            label="Email address"
            type="email"
            autoComplete="email"
            placeholder="jay@example.com"
            value={form.email}
            errors={errors.email}
            onChange={/* Return the derived value for the enclosing operation. */ (event) => update('email', event.target.value)}
          />
          <FormField
            id="register-username"
            label="Username"
            autoComplete="username"
            placeholder="RiverJay"
            hint="3–30 characters: letters, numbers, periods, hyphens, and underscores. This is your public player name."
            value={form.username}
            errors={errors.username}
            onChange={/* Return the derived value for the enclosing operation. */ (event) => update('username', event.target.value)}
          />
          <FormField
            id="register-password"
            label="Password"
            type="password"
            autoComplete="new-password"
            placeholder="••••••••••••"
            hint="At least 8 characters. Avoid common or all-number passwords."
            value={form.password}
            errors={errors.password}
            onChange={/* Return the derived value for the enclosing operation. */ (event) => update('password', event.target.value)}
          />
          <FormField
            id="register-confirm"
            label="Confirm password"
            type="password"
            autoComplete="new-password"
            placeholder="••••••••••••"
            value={form.confirm}
            errors={errors.confirm}
            onChange={/* Return the derived value for the enclosing operation. */ (event) => update('confirm', event.target.value)}
          />
          <div className="form-field">
            <label className="auth-check" htmlFor="register-age">
              <input
                id="register-age"
                type="checkbox"
                checked={form.age}
                aria-invalid={!!errors.age}
                aria-describedby={errors.age ? 'register-age-error' : undefined}
                onChange={/* Return the derived value for the enclosing operation. */ (event) => update('age', event.target.checked)}
              />
              <span className="auth-check-box" aria-hidden="true">
                <img src={squareCheck} alt="" width="20" height="20" />
              </span>
              I confirm that I meet the minimum age requirement to use this
              service.
            </label>
            {errors.age && (
              <p className="field-error" id="register-age-error">
                {errors.age.join(' ')}
              </p>
            )}
          </div>
          <p className="auth-legal">
            By creating an account, you agree to our Terms of Service, Privacy
            Policy, and Community Guidelines.
          </p>
          <FormMessage messages={errors.non_field_errors} />
          <button
            className="button primary full-width"
            type="submit"
            disabled={pending}
          >
            {pending ? 'Creating account…' : 'Create account →'}
          </button>
        </form>
      </SessionGate>
      <Link className="auth-prompt auth-link" to="/login">
        Already have an account? Sign in
      </Link>
      <Link className="button quiet full-width" to="/guest">
        Continue as Guest
      </Link>
    </AuthLayout>
  )
}
