/**
 * Module: friends/FriendsPage.tsx.
 * Render the friends screen, including user actions, loading states and request feedback.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ApiError } from '../../api/client'
import info from '../../assets/figma/info.svg'
import avatar44 from '../../assets/figma/friend-avatar-44.svg'
import avatar38 from '../../assets/figma/friend-avatar-38.svg'
import {
  answerRequest,
  getFriends,
  removeFriend,
  sendFriendRequest,
  searchPlayers,
} from './api'
import type { FriendEntry, FriendsResponse, RequestAction } from './types'
import './friends.css'

const LATER = 'Coming in a later story'

/** Format the friendship request timestamp as a short display date. */
const sentOn = (entry: FriendEntry) =>
  new Date(entry.created_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })

/** Extract the first readable field-validation message from an API error. */
function firstMessage(value: unknown) {
  return Array.isArray(value) && typeof value[0] === 'string'
    ? value[0]
    : undefined
}

/** Render the player initials using the shared friend-avatar artwork. */
function Avatar({ username, size }: { username: string; size: 38 | 44 }) {
  return (
    <div className={`avatar friend-avatar-${size}`}>
      <img src={size === 44 ? avatar44 : avatar38} alt="" />
      <span>{username.slice(0, 2).toUpperCase()}</span>
    </div>
  )
}

/** Render the friends page interface and its current state. */
export function FriendsPage() {
  const [data, setData] = useState<FriendsResponse | null>(null)
  const [loadError, setLoadError] = useState('')
  const [signedOut, setSignedOut] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [tab, setTab] = useState<'all' | 'requests'>('all')
  const [username, setUsername] = useState('')
  const [suggestions, setSuggestions] = useState<{ id: number; username: string }[]>([])
  const [fieldError, setFieldError] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [pending, setPending] = useState(false)
  const [confirming, setConfirming] = useState<number | null>(null)
  const busy = useRef(false)
  const input = useRef<HTMLInputElement>(null)

  const reload = useCallback(/* Provide a stable callback for the dependent component operations. */ () => setAttempt(/* Handle the setAttempt callback using the current operation's state. */ (n) => n + 1), [])
  useEffect(/* Synchronize component state with external data and release resources on cleanup. */ () => {
    let active = true
    getFriends()
      .then(/* Apply the successful asynchronous result to the current operation. */ (value) => {
        if (!active) return
        setData(value)
        setLoadError('')
      })
      .catch(/* Handle the failed operation without leaving stale UI feedback. */ (cause) => {
        if (!active) return
        if (cause instanceof ApiError && cause.status === 403)
          setSignedOut(true)
        else setLoadError('We could not load your friends. Please try again.')
      })
    return /* Return the derived value for the enclosing operation. */ () => {
      active = false
    }
  }, [attempt])

  useEffect(() => {
    let active = true
    const query = username.trim()
    if (!query || !data || signedOut) return
    const timer = window.setTimeout(() => {
      searchPlayers(query)
        .then(({ results }) => { if (active) setSuggestions(results.slice(0, 5)) })
        .catch(() => { if (active) setSuggestions([]) })
    }, 250)
    return () => { active = false; window.clearTimeout(timer) }
  }, [username, data, signedOut])

  /** Execute a protected friendship write and update the current lists and feedback. */
  async function run(
    send: (token: string) => Promise<FriendsResponse>,
    success: (next: FriendsResponse) => string,
  ) {
    if (busy.current || !data) return false
    busy.current = true
    setPending(true)
    setError('')
    setFieldError('')
    setMessage('')
    try {
      const next = await send(data.csrf_token)
      setData(next)
      setMessage(success(next))
      return true
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 400) {
        const field = firstMessage(cause.body.username)
        if (field) setFieldError(field)
        else
          setError(
            firstMessage(cause.body.non_field_errors) ??
              'That did not work. Please try again.',
          )
      } else if (cause instanceof ApiError && cause.status === 404) {
        // Another player answered or removed it first; show the current lists.
        setError('That request or friend is no longer available.')
        reload()
      } else if (cause instanceof ApiError && cause.status === 403) {
        setError('Your session changed. Refresh the page and sign in again.')
      } else {
        setError(
          cause instanceof Error
            ? cause.message
            : 'That did not work. Please try again.',
        )
      }
      return false
    } finally {
      busy.current = false
      setPending(false)
      setConfirming(null)
    }
  }

  /** Validate the form and submit its values while preventing duplicate requests. */
  async function submit(event: FormEvent) {
    event.preventDefault()
    const name = username.trim()
    if (!name) {
      setFieldError('Enter a username.')
      input.current?.focus()
      return
    }
    const sent = await run(
      /* Handle the run callback using the current operation's state. */
      (token) => sendFriendRequest(name, token),
      /* Handle the run callback using the current operation's state. */
      (next) =>
        next.friends.some(
          /* Handle the some callback using the current operation's state. */
          (f) => f.player.username.toLowerCase() === name.toLowerCase(),
        )
          ? `You and ${name} are now friends.`
          : `Friend request sent to ${name}.`,
    )
    if (sent) { setUsername(''); setSuggestions([]) }
    else input.current?.focus()
  }

  /** Respond to a pending friendship request and report the resulting relationship. */
  const answer = (entry: FriendEntry, action: RequestAction) =>
    run(
      /* Handle the run callback using the current operation's state. */
      (token) => answerRequest(entry.id, action, token),
      /* Handle the run callback using the current operation's state. */
      () =>
        ({
          accept: `You and ${entry.player.username} are now friends.`,
          decline: `Declined ${entry.player.username}'s request.`,
          cancel: `Cancelled your request to ${entry.player.username}.`,
        })[action],
    )

  /** Request removal of the selected friendship through the authenticated API. */
  const remove = (entry: FriendEntry) =>
    run(
      /* Handle the run callback using the current operation's state. */
      (token) => removeFriend(entry.id, token),
      /* Handle the run callback using the current operation's state. */
      () => `Removed ${entry.player.username} from your friends.`,
    )

  if (signedOut)
    return (
      <section className="panel friends-signed-out">
        <h1>Friends</h1>
        <p className="muted">
          Sign in with a registered account to add friends. Guests can play
          without one but cannot keep a friends list.
        </p>
        <Link className="button primary" to="/login">
          Sign in
        </Link>
      </section>
    )
  if (loadError)
    return (
      <div className="notice error-notice" role="alert">
        {loadError}
        <button className="text-button" type="button" onClick={reload}>
          Try again
        </button>
      </div>
    )
  if (!data)
    return (
      <p className="muted" role="status">
        Loading your friends…
      </p>
    )

  const { friends, incoming, outgoing } = data
  const requestCount = incoming.length + outgoing.length
  return (
    <div className="friends-page">
      <div className="friends-intro">
        <p className="friends-eyebrow">
          YOUR CREW · {friends.length}{' '}
          {friends.length === 1 ? 'FRIEND' : 'FRIENDS'}
        </p>
        <div className="friends-heading">
          <h1>Better hands. Better company.</h1>
          <button
            className="button primary"
            type="button"
            onClick={/* Return the derived value for the enclosing operation. */ () => input.current?.focus()}
          >
            Add Friend
          </button>
        </div>
        <p className="muted">
          Find your friends, pull up a seat, and keep the conversation going.
        </p>
      </div>

      <div className="friends-tabs" aria-label="Friend lists">
        <span className="friends-tab unavailable" aria-disabled="true" title={LATER}>
          Online
        </span>
        <button
          type="button"
          className={`friends-tab ${tab === 'all' ? 'active' : ''}`}
          aria-pressed={tab === 'all'}
          onClick={/* Return the derived value for the enclosing operation. */ () => setTab('all')}
        >
          All Friends · {friends.length}
        </button>
        <button
          type="button"
          className={`friends-tab ${tab === 'requests' ? 'active' : ''}`}
          aria-pressed={tab === 'requests'}
          onClick={/* Return the derived value for the enclosing operation. */ () => setTab('requests')}
        >
          Requests · {requestCount}
        </button>
        <span className="friends-tab unavailable" aria-disabled="true" title={LATER}>
          Recently Played
        </span>
      </div>

      <form className="friends-search" onSubmit={submit} noValidate>
        <div className="form-field">
          <label htmlFor="friend-username">Find a friend</label>
          <input
            id="friend-username"
            ref={input}
            value={username}
            onChange={(event) => { setUsername(event.target.value); setSuggestions([]) }}
            list="friend-matches"
            placeholder="⌕  Search by username…"
            autoComplete="off"
            maxLength={150}
            aria-invalid={fieldError ? 'true' : undefined}
            aria-describedby={fieldError ? 'friend-username-error' : undefined}
          />
          <datalist id="friend-matches">
            {suggestions.map((player) => <option key={player.id} value={player.username} />)}
          </datalist>
          {fieldError && (
            <span id="friend-username-error" className="field-error">
              {fieldError}
            </span>
          )}
        </div>
        <button className="button primary" type="submit" disabled={pending}>
          {pending ? 'Sending…' : 'Send Request'}
        </button>
      </form>

      {error && (
        <div className="notice error-notice friends-message" role="alert">
          {error}
        </div>
      )}
      <p className="friends-status" role="status">
        {message}
      </p>

      {tab === 'all' &&
        (friends.length ? (
          <ul className="friend-grid" aria-label="Your friends">
            {friends.map(/* Convert this item into the value or UI element expected by the collection. */ (entry) => (
              <li key={entry.id} className="friend-card">
                <div className="friend-row">
                  <Avatar username={entry.player.username} size={44} />
                  <div className="friend-name">
                    <h2>{entry.player.username}</h2>
                    <p className="muted">Registered player</p>
                  </div>
                </div>
                <div className="friend-actions">
                  <button className="button quiet" type="button" disabled title={LATER}>
                    Message
                  </button>
                  <button className="button" type="button" disabled title={LATER}>
                    Invite to Table
                  </button>
                </div>
                {confirming === entry.id ? (
                  <div className="friend-confirm" role="group" aria-label={`Remove ${entry.player.username}?`}>
                    <span>Remove {entry.player.username}?</span>
                    <button
                      className="link-action danger"
                      type="button"
                      disabled={pending}
                      onClick={/* Return the derived value for the enclosing operation. */ () => remove(entry)}
                    >
                      Yes, remove
                    </button>
                    <button
                      className="link-action"
                      type="button"
                      onClick={/* Return the derived value for the enclosing operation. */ () => setConfirming(null)}
                    >
                      Keep
                    </button>
                  </div>
                ) : (
                  <button
                    className="link-action"
                    type="button"
                    onClick={/* Return the derived value for the enclosing operation. */ () => setConfirming(entry.id)}
                  >
                    Remove Friend
                  </button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <div className="panel friends-empty">
            <p>No friends yet.</p>
            <p className="muted">
              Search for a player by username above to send your first request.
            </p>
          </div>
        ))}

      <div className="friend-panels">
        <section className="panel friend-panel" aria-labelledby="incoming-heading">
          <div className="friend-panel-heading">
            <h2 id="incoming-heading">Friend requests</h2>
            <span>{incoming.length} pending</span>
          </div>
          <p className="muted">New players who want to join your crew.</p>
          {incoming.length ? (
            <ul className="request-list">
              {incoming.map(/* Convert this item into the value or UI element expected by the collection. */ (entry) => (
                <li key={entry.id} className="request-row">
                  <Avatar username={entry.player.username} size={38} />
                  <div className="friend-name">
                    <strong>{entry.player.username}</strong>
                    <p className="muted">Sent you a request · {sentOn(entry)}</p>
                  </div>
                  <button
                    className="button primary"
                    type="button"
                    disabled={pending}
                    onClick={/* Return the derived value for the enclosing operation. */ () => answer(entry, 'accept')}
                  >
                    Accept
                  </button>
                  <button
                    className="button"
                    type="button"
                    disabled={pending}
                    onClick={/* Return the derived value for the enclosing operation. */ () => answer(entry, 'decline')}
                  >
                    Decline
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="friends-none">No requests right now.</p>
          )}
        </section>
        <section className="panel friend-panel" aria-labelledby="outgoing-heading">
          <div className="friend-panel-heading">
            <h2 id="outgoing-heading">Sent requests</h2>
            <span>{outgoing.length} waiting</span>
          </div>
          <p className="muted">Players you have asked to join your crew.</p>
          {outgoing.length ? (
            <ul className="request-list">
              {outgoing.map(/* Convert this item into the value or UI element expected by the collection. */ (entry) => (
                <li key={entry.id} className="request-row">
                  <Avatar username={entry.player.username} size={38} />
                  <div className="friend-name">
                    <strong>{entry.player.username}</strong>
                    <p className="muted">Request sent · {sentOn(entry)}</p>
                  </div>
                  <button
                    className="button"
                    type="button"
                    disabled={pending}
                    onClick={/* Return the derived value for the enclosing operation. */ () => answer(entry, 'cancel')}
                  >
                    Cancel
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="friends-none">You have no requests waiting.</p>
          )}
        </section>
      </div>

      <div className="notice friends-notice">
        <img src={info} alt="" />
        <div>
          <strong>You control your circle</strong>
          <p>
            Friend requests share only your username. Your email and account
            details stay private, and you can remove a friend at any time.
          </p>
        </div>
      </div>
    </div>
  )
}
