import { useState } from 'react'
import { Link } from 'react-router-dom'
import { FormField } from '../../components/FormField'
import squareCheck from '../../assets/figma/square-check.svg'
import { AuthLayout } from './AuthLayout'
import { register } from './api'
import { FormMessage, SessionGate } from './SessionGate'
import { useAuthForm } from './useAuthForm'
import { type RegisterForm, validateRegister } from './validation'

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
  const update = <K extends keyof RegisterForm>(key: K, value: RegisterForm[K]) =>
    setForm((current) => ({ ...current, [key]: value }))

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
          onSubmit={(event) => {
            event.preventDefault()
            // Confirm-password and age are browser-only checks; the API takes three fields.
            submit(validateRegister(form), (csrf) =>
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
            onChange={(event) => update('email', event.target.value)}
          />
          <FormField
            id="register-username"
            label="Username"
            autoComplete="username"
            placeholder="RiverJay"
            hint="3–30 characters: letters, numbers, periods, hyphens, and underscores. This is your public player name."
            value={form.username}
            errors={errors.username}
            onChange={(event) => update('username', event.target.value)}
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
            onChange={(event) => update('password', event.target.value)}
          />
          <FormField
            id="register-confirm"
            label="Confirm password"
            type="password"
            autoComplete="new-password"
            placeholder="••••••••••••"
            value={form.confirm}
            errors={errors.confirm}
            onChange={(event) => update('confirm', event.target.value)}
          />
          <div className="form-field">
            <label className="auth-check" htmlFor="register-age">
              <input
                id="register-age"
                type="checkbox"
                checked={form.age}
                aria-invalid={!!errors.age}
                aria-describedby={errors.age ? 'register-age-error' : undefined}
                onChange={(event) => update('age', event.target.checked)}
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
