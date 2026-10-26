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
  const refresh = useCallback(() => setAttempt((n) => n + 1), [])
  const update = useCallback(
    (profile: Profile) => {
      setResult((previous) => ({
        owner: accountId,
        profile,
        token: previous?.owner === accountId ? previous.token : '',
        attempt,
        error: '',
      }))
    },
    [accountId, attempt],
  )
  useEffect(() => {
    if (!registered || !enabled) return
    let active = true
    getProfile()
      .then((value) => {
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
      .catch(() => {
        if (active)
          setResult((previous) => ({
            owner: accountId,
            profile: previous?.owner === accountId ? previous.profile : null,
            token: '',
            attempt,
            error:
              'We could not load your profile. Try again or sign in again.',
          }))
      })
    return () => {
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
