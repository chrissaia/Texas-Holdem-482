import { useState } from 'react'
import { Link } from 'react-router-dom'
import { FormField } from '../../components/FormField'
import info from '../../assets/figma/info.svg'
import { AuthLayout } from './AuthLayout'
import { login } from './api'
import { FormMessage, SessionGate } from './SessionGate'
import { useAuthForm } from './useAuthForm'
import { validateLogin } from './validation'

export function SignInPage({ onSignedIn }: { onSignedIn: () => void }) {
  const { form: formRef, pending, errors, submit, ...gate } =
    useAuthForm(onSignedIn)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  return (
    <AuthLayout>
      <h1 className="auth-title">Welcome back.</h1>
      <p className="auth-subtitle">
        Your friends and your next hand are waiting.
      </p>
      <SessionGate {...gate}>
        <form
          ref={formRef}
          className="auth-form"
          noValidate
          onSubmit={(event) => {
            event.preventDefault()
            submit(validateLogin(username, password), (csrf) =>
              login({ username: username.trim(), password }, csrf),
            )
          }}
        >
          {/* The backend matches usernames only; email sign-in is an open team decision. */}
          <FormField
            id="login-username"
            label="Username"
            autoComplete="username"
            placeholder="riverjay"
            value={username}
            errors={errors.username}
            onChange={(event) => setUsername(event.target.value)}
          />
          <FormField
            id="login-password"
            label="Password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••••••"
            value={password}
            errors={errors.password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <div className="auth-options">
            <label
              className="auth-option unavailable"
              title="Sessions already stay signed in until you sign out."
            >
              <input type="checkbox" checked disabled readOnly />
              Keep me signed in
            </label>
            <span
              className="auth-link unavailable"
              aria-disabled="true"
              title="Coming in a later story"
            >
              Forgot password?
            </span>
          </div>
          <FormMessage messages={errors.non_field_errors} />
          <button
            className="button primary full-width"
            type="submit"
            disabled={pending}
          >
            {pending ? 'Signing in…' : 'Sign in →'}
          </button>
        </form>
      </SessionGate>
      <div className="notice auth-notice">
        <img src={info} alt="" width="20" height="20" />
        <div>
          <p className="auth-notice-title">A safe place to play</p>
          <p>
            We’ll never ask you to transfer money or share your password in
            chat.
          </p>
        </div>
      </div>
      <p className="auth-prompt">New here? Create an account</p>
      <Link className="button full-width" to="/register">
        Register - get 1,000 chips
      </Link>
      <Link className="button quiet full-width" to="/guest">
        Continue as Guest
      </Link>
    </AuthLayout>
  )
}
