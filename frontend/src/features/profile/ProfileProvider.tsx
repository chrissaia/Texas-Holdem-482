/**
 * Module: profile/ProfileProvider.tsx.
 * Implement ProfileProvider for the profile feature and its importing components.
 */
import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { getProfile } from './api'
import { ProfileContext } from './context'
import type { Profile } from './types'

type Result = {
  owner: number | null
  profile: Profile | null
  token: string
  attempt: number
  error: string
}

/** Render the profile provider interface and its current state. */
export function ProfileProvider({
  registered,
  accountId,
  enabled,
  identityLoading,
  children,
}: {
  registered: boolean
  accountId: number | null
  enabled: boolean
  identityLoading: boolean
  children: ReactNode
}) {
  const [result, setResult] = useState<Result | null>(null)
  const [attempt, setAttempt] = useState(0)
  const current = result?.owner === accountId ? result : null
  const refresh = useCallback(/* Provide a stable callback for the dependent component operations. */ () => setAttempt(/* Handle the setAttempt callback using the current operation's state. */ (n) => n + 1), [])
  const update = useCallback(
    /* Provide a stable callback for the dependent component operations. */
    (profile: Profile) => {
      setResult(/* Handle the setResult callback using the current operation's state. */ (previous) => ({
        owner: accountId,
        profile,
        token: previous?.owner === accountId ? previous.token : '',
        attempt,
        error: '',
      }))
    },
    [accountId, attempt],
  )
  useEffect(/* Synchronize component state with external data and release resources on cleanup. */ () => {
    if (!registered || !enabled) return
    let active = true
    getProfile()
      .then(/* Apply the successful asynchronous result to the current operation. */ (value) => {
        if (!value.daily_reward) throw new Error('Invalid profile response')
        if (active)
          setResult({
            owner: accountId,
            profile: value,
            token: value.csrf_token,
            attempt,
            error: '',
          })
      })
      .catch(/* Handle the failed operation without leaving stale UI feedback. */ () => {
        if (active)
          setResult(/* Handle the setResult callback using the current operation's state. */ (previous) => ({
            owner: accountId,
            profile: previous?.owner === accountId ? previous.profile : null,
            token: '',
            attempt,
            error:
              'We could not load your profile. Try again or sign in again.',
          }))
      })
    return /* Return the derived value for the enclosing operation. */ () => {
      active = false
    }
  }, [registered, accountId, enabled, attempt])
  return (
    <ProfileContext.Provider
      value={{
        registered,
        profile: current?.profile ?? null,
        token: current?.token ?? '',
        error: current?.error ?? '',
        loading:
          identityLoading ||
          (registered && enabled && (!current || current.attempt !== attempt)),
        refresh,
        update,
      }}
    >
      {children}
    </ProfileContext.Provider>
  )
}
