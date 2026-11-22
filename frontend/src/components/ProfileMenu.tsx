import { useEffect, useId, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getSession, logout } from '../features/auth/api'
import chevron from '../assets/figma/chevron-down.svg'

/** Account shortcuts with native keyboard navigation and session-safe sign out. */
export function ProfileMenu({ children, signedIn, canManageAds = false, onSignedOut }: {
  children: React.ReactNode
  signedIn: boolean
  canManageAds?: boolean
  onSignedOut: () => void
}) {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const busy = useRef(false)
  const container = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const id = useId()
  const navigate = useNavigate()

  useEffect(() => {
    if (!open) return
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !container.current?.contains(event.target)) setOpen(false)
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        trigger.current?.focus()
      }
    }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('keydown', escape)
    }
  }, [open])

  async function signOut() {
    if (busy.current) return
    busy.current = true
    setPending(true)
    setError('')
    try {
      const session = await getSession()
      await logout(session.csrf_token)
      onSignedOut()
      navigate('/login')
    } catch {
      setError('We could not sign you out. Please try again.')
    } finally {
      busy.current = false
      setPending(false)
    }
  }

  return <div className="profile-menu" ref={container} onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false)
  }}>
    <button ref={trigger} className="profile-menu-trigger" type="button"
      aria-label="Account options" aria-expanded={open} aria-controls={id}
      onClick={() => setOpen(value => !value)}>
      {children}<img className="profile-menu-chevron" src={chevron} alt="" />
    </button>
    {open && <nav id={id} className="profile-menu-panel" aria-label="Account shortcuts">
      <Link to="/settings">Settings &amp; avatar</Link>
      {signedIn ? <>
        <Link to="/statistics">My statistics</Link>
        <Link to="/rewards">Chips &amp; rewards</Link>
        {canManageAds && <Link to="/manage-ads" onClick={() => setOpen(false)}>Manage ads</Link>}
        <button type="button" disabled={pending} onClick={() => void signOut()}>
          {pending ? 'Signing out…' : 'Sign out'}
        </button>
      </> : <>
        <Link to="/login">Sign in / switch account</Link>
        <Link to="/register">Create account</Link>
      </>}
      {error && <p role="alert">{error}</p>}
    </nav>}
  </div>
}
