/**
 * Module: auth/useAuthForm.ts.
 * Implement useAuthForm for the auth feature and its importing components.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError } from '../../api/client'
import { getSession, logout } from './api'
import type { AuthErrors, Session } from './types'

/**
 * Shared state for the sign-in, register, and guest forms: loads the session
 * (which also sets the CSRF cookie), submits once at a time, and maps backend
 * errors onto fields. `onSignedIn` lets the app shell refresh its own session.
 */
export function useAuthForm(onSignedIn: () => void) {
  const navigate = useNavigate()
  const [session, setSession] = useState<Session | null>(null)
  const [loadError, setLoadError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [errors, setErrors] = useState<AuthErrors>({})
  const [pending, setPending] = useState(false)
  const submitting = useRef(false)
  const form = useRef<HTMLFormElement>(null)

  const reload = useCallback(/* Provide a stable callback for the dependent component operations. */ () => {
    setLoadError('')
    setAttempt(/* Handle the setAttempt callback using the current operation's state. */ (n) => n + 1)
  }, [])
  useEffect(/* Synchronize component state with external data and release resources on cleanup. */ () => {
    let active = true
    getSession()
      .then(/* Apply the successful asynchronous result to the current operation. */ (value) => active && setSession(value))
      .catch(
        /* Handle the failed operation without leaving stale UI feedback. */
        () =>
          active &&
          setLoadError('We could not check your session. Please try again.'),
      )
    return /* Return the derived value for the enclosing operation. */ () => {
      active = false
    }
  }, [attempt])

  /** Move keyboard focus to the first invalid authentication field. */
  function focusFirstError() {
    // Wait for React to attach aria-invalid, then move keyboard focus there.
    requestAnimationFrame(/* Handle the requestAnimationFrame callback using the current operation's state. */ () =>
      form.current
        ?.querySelector<HTMLElement>('[aria-invalid="true"]')
        ?.focus(),
    )
  }

  /** Validate the form and submit its values while preventing duplicate requests. */
  async function submit(
    localErrors: AuthErrors,
    send: (csrfToken: string) => Promise<Session>,
  ) {
    if (submitting.current || !session) return
    setErrors(localErrors)
    if (Object.keys(localErrors).length) return focusFirstError()
    submitting.current = true
    setPending(true)
    try {
      setSession(await send(session.csrf_token))
      onSignedIn()
      navigate('/')
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 400) {
        setErrors(cause.body as AuthErrors)
        focusFirstError()
      } else if (cause instanceof ApiError && cause.status === 403) {
        setErrors({
          non_field_errors: [
            'Your session could not be verified. Please try again.',
          ],
        })
        reload()
      } else {
        setErrors({
          non_field_errors: [
            cause instanceof Error
              ? cause.message
              : 'The request could not be completed.',
          ],
        })
      }
    } finally {
      submitting.current = false
      setPending(false)
    }
  }

  /** Clear the current server session and refresh the displayed identity. */
  async function signOut() {
    if (!session) return
    try {
      setSession(await logout(session.csrf_token))
      onSignedIn()
    } catch {
      setLoadError('We could not sign you out. Please try again.')
    }
  }

  return {
    session,
    loadError,
    reload,
    errors,
    pending,
    form,
    submit,
    signOut,
  }
}
