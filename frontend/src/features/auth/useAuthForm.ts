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

  const reload = useCallback(() => {
    setLoadError('')
    setAttempt((n) => n + 1)
  }, [])
  useEffect(() => {
    let active = true
    getSession()
      .then((value) => active && setSession(value))
      .catch(
        () =>
          active &&
          setLoadError('We could not check your session. Please try again.'),
      )
    return () => {
      active = false
    }
  }, [attempt])

  function focusFirstError() {
    // Wait for React to attach aria-invalid, then move keyboard focus there.
    requestAnimationFrame(() =>
      form.current
        ?.querySelector<HTMLElement>('[aria-invalid="true"]')
        ?.focus(),
    )
  }

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
