import { useRef, useState } from 'react'
import { ApiError } from '../../api/client'
import avatarSurface from '../../assets/figma/avatar-settings-64.svg'
import { uploadAvatar } from './api'
import { ProfileGate } from './ProfileGate'
import { useProfile } from './context'
import './profile.css'

export function AccountCard() {
  const { profile, token, update, refresh } = useProfile()
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [pending, setPending] = useState(false)
  const busy = useRef(false)
  const input = useRef<HTMLInputElement>(null)
  function select(next: File | undefined) {
    setError('')
    setMessage('')
    setFile(null)
    if (!next) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(next.type))
      return setError('Choose a JPEG, PNG, or WebP image.')
    if (next.size > 2 * 1024 * 1024)
      return setError('Choose an image no larger than 2 MB.')
    setFile(next)
  }
  async function upload(event: React.FormEvent) {
    event.preventDefault()
    if (!file || !profile || busy.current) return
    busy.current = true
    setPending(true)
    setError('')
    setMessage('')
    try {
      update(await uploadAvatar(file, token))
      setFile(null)
      if (input.current) input.current.value = ''
      setMessage('Your avatar has been saved.')
    } catch (cause) {
      if (cause instanceof ApiError && Array.isArray(cause.body.avatar))
        setError(cause.body.avatar.join(' '))
      else if (cause instanceof ApiError && cause.status === 403) {
        setError(
          'Your session could not be verified. Sign in again or refresh your profile.',
        )
        refresh()
      } else
        setError(
          cause instanceof Error
            ? cause.message
            : 'Unable to upload your avatar.',
        )
    } finally {
      busy.current = false
      setPending(false)
    }
  }
  return (
    <section className="panel account-panel" aria-labelledby="account-title">
      <h2 id="account-title">Account</h2>
      <ProfileGate>
        {profile && (
          <>
            <div className="profile-identity">
              <div className="profile-avatar">
                <img
                  src={profile.avatar_url || avatarSurface}
                  alt="Your avatar"
                  className={profile.avatar_url ? 'uploaded-avatar' : ''}
                />
                {!profile.avatar_url && (
                  <span>{profile.username.slice(0, 2).toUpperCase()}</span>
                )}
              </div>
              <div>
                <strong>{profile.username}</strong>
                <p className="muted">Registered player</p>
              </div>
              <button
                className="button"
                type="button"
                disabled={pending}
                onClick={() => input.current?.click()}
              >
                Change avatar
              </button>
            </div>
            <form onSubmit={upload} className="avatar-form">
              <label htmlFor="avatar-file">Avatar image</label>
              <input
                ref={input}
                id="avatar-file"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={pending}
                onChange={(e) => select(e.target.files?.[0])}
                aria-describedby="avatar-hint"
              />
              <p id="avatar-hint" className="field-hint">
                JPEG, PNG or WebP · Up to 2 MB · Still images up to 4096 × 4096.
                Saved as a square avatar.
              </p>
              {file && <p className="field-hint">Selected: {file.name}</p>}
              <button
                className="button primary"
                type="submit"
                disabled={pending || !file}
              >
                {pending ? 'Saving avatar…' : 'Save avatar'}
              </button>
            </form>
            {error && (
              <p role="alert" className="field-error">
                {error}
              </p>
            )}
            {message && <p role="status">{message}</p>}
          </>
        )}
      </ProfileGate>
    </section>
  )
}
