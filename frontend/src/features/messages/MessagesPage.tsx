/**
 * Module: messages/MessagesPage.tsx.
 * S21: private conversations with friends at /messages (?with=<friend id> opens one).
 * Layout follows Figma frame 18:15971. New messages arrive by polling.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ApiError } from '../../api/client'
import avatar38 from '../../assets/figma/friend-avatar-38.svg'
import type { Presence } from '../friends/types'
import { MAX_MESSAGE_LENGTH, getConversation, getConversations, sendDirectMessage } from './api'
import { LIST_POLL_MS, THREAD_POLL_MS } from './constants'
import { mergeMessages, messageTime, sendError } from './format'
import type { ConversationSummary, DirectMessage } from './types'
import './messages.css'

function Avatar({ username, online }: { username: string; online: boolean }) {
  return (
    <div className="avatar friend-avatar-38">
      <img src={avatar38} alt="" />
      <span>{username.slice(0, 2).toUpperCase()}</span>
      {online && <i className="friend-presence-dot" aria-hidden="true" />}
    </div>
  )
}

function presenceText(presence: Presence) {
  if (presence.status === 'at_table' && presence.table) return `Online · Playing ${presence.table.name}`
  return presence.status === 'online' ? 'Online' : 'Offline'
}

export function MessagesPage() {
  const [params, setParams] = useSearchParams()
  const requested = Number(params.get('with')) || null
  const [list, setList] = useState<ConversationSummary[] | null>(null)
  const [token, setToken] = useState('')
  const [signedOut, setSignedOut] = useState(false)
  const [listError, setListError] = useState('')
  const [filter, setFilter] = useState('')
  const [listAttempt, setListAttempt] = useState(0)

  const refreshList = useCallback(() => setListAttempt((n) => n + 1), [])
  useEffect(() => {
    let active = true
    const load = () =>
      getConversations()
        .then((value) => {
          if (!active) return
          setList(value.conversations)
          setToken(value.csrf_token)
          setListError('')
        })
        .catch((cause) => {
          if (!active) return
          if (cause instanceof ApiError && cause.status === 403) setSignedOut(true)
          else setListError('We could not load your conversations.')
        })
    void load()
    const timer = window.setInterval(load, LIST_POLL_MS)
    return () => { active = false; window.clearInterval(timer) }
  }, [listAttempt])

  // Open the requested friend, or the most recent conversation.
  const selected = requested ?? list?.[0]?.friend.id ?? null
  const select = (id: number) => setParams({ with: String(id) })

  if (signedOut)
    return (
      <section className="panel friends-signed-out">
        <h1>Messages</h1>
        <p className="muted">Sign in with a registered account to message your friends.</p>
        <Link className="button primary" to="/login">Sign in</Link>
      </section>
    )

  const shown = (list ?? []).filter((row) => row.friend.username.toLowerCase().includes(filter.trim().toLowerCase()))
  return (
    <div className="messages-page">
      <header className="page-intro">
        <span className="eyebrow">DIRECT MESSAGES</span>
        <h1>Keep your crew close.</h1>
        <p className="muted">Private conversations with your friends.</p>
      </header>
      {listError && (
        <div role="alert" className="notice error-notice">
          {listError} <button className="text-button" type="button" onClick={refreshList}>Try again</button>
        </div>
      )}
      <div className="panel messages-layout">
        <nav className="messages-list" aria-labelledby="conversations-heading">
          <h2 id="conversations-heading">Messages</h2>
          <input
            type="search"
            aria-label="Find a conversation"
            placeholder="⌕  Find a conversation…"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          />
          {list === null ? (
            <p role="status" className="muted">Loading conversations…</p>
          ) : list.length === 0 ? (
            <p className="muted">Add friends to start a conversation. <Link to="/friends">Find friends →</Link></p>
          ) : (
            <ul>
              {shown.map((row) => (
                <li key={row.friend.id}>
                  <button
                    type="button"
                    className={`conversation-row${row.friend.id === selected ? ' active' : ''}`}
                    aria-current={row.friend.id === selected ? 'true' : undefined}
                    onClick={() => select(row.friend.id)}
                  >
                    <Avatar username={row.friend.username} online={row.presence.status !== 'offline'} />
                    <span className="conversation-text">
                      <strong>{row.friend.username}</strong>
                      <span className="muted">{row.last_message ? row.last_message.body : 'Say hello'}</span>
                    </span>
                    <span className="conversation-meta">
                      {row.last_message && <time>{messageTime(row.last_message.created_at)}</time>}
                      {row.unread_count > 0 && (
                        <span className="unread-badge" aria-label={`${row.unread_count} unread`}>{row.unread_count}</span>
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="field-hint">Only friends can message you.</p>
        </nav>
        {selected === null ? (
          <div className="messages-thread messages-empty">
            <p className="muted">{list === null ? '' : 'Choose a friend to start a conversation.'}</p>
          </div>
        ) : (
          <Thread key={selected} friendId={selected} token={token} onChange={refreshList} />
        )}
      </div>
    </div>
  )
}

/** One open conversation: history, polling for new messages, read receipt and composer. */
function Thread({ friendId, token, onChange }: { friendId: number; token: string; onChange: () => void }) {
  const [messages, setMessages] = useState<DirectMessage[]>([])
  const [friend, setFriend] = useState<{ username: string; presence: Presence } | null>(null)
  const [csrf, setCsrf] = useState(token)
  const [missing, setMissing] = useState(false)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)
  const lastId = useRef(0)
  const end = useRef<HTMLLIElement>(null)

  useEffect(() => {
    let active = true
    const load = (initial: boolean) =>
      getConversation(friendId, initial ? undefined : lastId.current)
        .then((value) => {
          if (!active) return
          setFriend({ username: value.friend.username, presence: value.presence })
          setCsrf(value.csrf_token)
          // Read receipts on my earlier messages can change, so a full load replaces the list.
          setMessages((current) => (initial ? value.messages : mergeMessages(current, value.messages)))
          const newest = value.messages[value.messages.length - 1]
          if (newest) lastId.current = Math.max(lastId.current, newest.id)
          if (initial || value.messages.length) onChange()
        })
        .catch((cause) => {
          if (active && cause instanceof ApiError && cause.status === 404) setMissing(true)
        })
    void load(true)
    const timer = window.setInterval(() => void load(false), THREAD_POLL_MS)
    return () => { active = false; window.clearInterval(timer) }
  }, [friendId, onChange])

  useEffect(() => { end.current?.scrollIntoView?.({ block: 'end' }) }, [messages.length])

  const submit = async (event?: FormEvent) => {
    event?.preventDefault()
    const body = draft.trim()
    if (!body || sending) return
    setSending(true)
    setError('')
    try {
      const sent = await sendDirectMessage(friendId, body, csrf)
      setCsrf(sent.csrf_token)
      setMessages((current) => mergeMessages(current, [sent.message]))
      lastId.current = Math.max(lastId.current, sent.message.id)
      setDraft('')
      onChange()
    } catch (cause) {
      setError(sendError(cause))
    } finally {
      setSending(false)
    }
  }
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      void submit()
    }
  }

  if (missing)
    return (
      <div className="messages-thread messages-empty">
        <p role="alert" className="notice">You can only message players who are your friends. <Link to="/friends">Go to Friends</Link></p>
      </div>
    )
  if (!friend) return <div className="messages-thread"><p role="status" className="muted">Loading conversation…</p></div>

  const last = messages[messages.length - 1]
  const seen = last && last.sender.id !== friendId && last.read
  return (
    <section className="messages-thread" aria-labelledby="thread-heading">
      <header className="thread-header">
        <Avatar username={friend.username} online={friend.presence.status !== 'offline'} />
        <div>
          <h2 id="thread-heading">{friend.username}</h2>
          <p className={`thread-presence ${friend.presence.status}`}>{presenceText(friend.presence)}</p>
        </div>
        {friend.presence.table && (
          <Link className="button" to={`/tables/${friend.presence.table.id}`}>Join Table</Link>
        )}
      </header>
      <ol className="thread-messages" aria-label={`Conversation with ${friend.username}`}>
        {messages.length === 0 && <li className="muted thread-start">No messages yet. Say hello to {friend.username}!</li>}
        {messages.map((message) => (
          <li key={message.id} className="thread-message">
            <Avatar username={message.sender.username} online={false} />
            <div>
              <div className="thread-message-heading">
                <strong>{message.sender.username}</strong>
                <time dateTime={message.created_at}>{messageTime(message.created_at)}</time>
              </div>
              <p>{message.body}</p>
            </div>
          </li>
        ))}
        <li ref={end} aria-hidden="true" />
      </ol>
      {seen && <p className="field-hint thread-seen">Seen by {friend.username}</p>}
      <form className="thread-composer" onSubmit={submit}>
        <label htmlFor="message-draft">Message {friend.username}</label>
        <textarea
          id="message-draft"
          rows={2}
          value={draft}
          maxLength={MAX_MESSAGE_LENGTH}
          placeholder="Write a message…"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
        />
        {error && <p role="alert" className="field-error">{error}</p>}
        <div className="thread-composer-actions">
          <span className="field-hint">Enter to send · Shift + Enter for a new line · {draft.length}/{MAX_MESSAGE_LENGTH}</span>
          <button className="button primary" type="submit" disabled={sending || !draft.trim()}>
            {sending ? 'Sending…' : 'Send'}
          </button>
        </div>
      </form>
    </section>
  )
}
