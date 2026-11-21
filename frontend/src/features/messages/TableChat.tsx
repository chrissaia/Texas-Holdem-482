/**
 * Module: messages/TableChat.tsx.
 * S21: chat at a poker table (Figma 12:2106 "Table chat"). Anyone who can see the table reads it;
 * seated players can post. New lines arrive by polling, which also picks up seat changes.
 */
import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ApiError } from '../../api/client'
import { MAX_MESSAGE_LENGTH, getTableChat, sendTableMessage } from './api'
import { mergeMessages, messageTime, sendError } from './format'
import { QUICK_REPLIES, THREAD_POLL_MS } from './constants'
import type { TableChatMessage } from './types'
import './messages.css'

export function TableChat({ tableId }: { tableId: number }) {
  const [messages, setMessages] = useState<TableChatMessage[]>([])
  const [canPost, setCanPost] = useState(false)
  const [players, setPlayers] = useState(0)
  const [csrf, setCsrf] = useState('')
  const [state, setState] = useState<'loading' | 'ready' | 'signed-out' | 'error'>('loading')
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)
  const lastId = useRef(0)

  useEffect(() => {
    let active = true
    const load = (initial: boolean) =>
      getTableChat(tableId, initial ? undefined : lastId.current)
        .then((value) => {
          if (!active) return
          setCanPost(value.can_post)
          setPlayers(value.player_count)
          setCsrf(value.csrf_token)
          setMessages((current) => mergeMessages(current, value.messages))
          const newest = value.messages[value.messages.length - 1]
          if (newest) lastId.current = Math.max(lastId.current, newest.id)
          setState('ready')
        })
        .catch((cause) => {
          if (!active) return
          if (cause instanceof ApiError && cause.status === 403) setState('signed-out')
          else if (initial) setState('error')
        })
    void load(true)
    const timer = window.setInterval(() => void load(false), THREAD_POLL_MS)
    return () => { active = false; window.clearInterval(timer) }
  }, [tableId])

  const send = async (text: string, event?: FormEvent) => {
    event?.preventDefault()
    const body = text.trim()
    if (!body || sending) return
    setSending(true)
    setError('')
    try {
      const sent = await sendTableMessage(tableId, body, csrf)
      setCsrf(sent.csrf_token)
      setMessages((current) => mergeMessages(current, [sent.message]))
      lastId.current = Math.max(lastId.current, sent.message.id)
      if (body === draft.trim()) setDraft('')
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 403) setCanPost(false)
      setError(sendError(cause))
    } finally {
      setSending(false)
    }
  }

  return (
    <section className="table-chat" aria-labelledby="table-chat-heading">
      <h2 id="table-chat-heading">Table chat</h2>
      {state === 'loading' ? <p role="status" className="muted">Loading chat…</p>
        : state === 'signed-out' ? <p className="notice"><Link to="/login">Sign in</Link> with a registered account to read the table chat.</p>
        : state === 'error' ? <p role="alert" className="notice error-notice">The table chat could not be loaded.</p>
        : <>
          <p className="field-hint">{players} {players === 1 ? 'player' : 'players'} seated</p>
          <ol className="table-chat-messages" aria-label="Table chat messages">
            {messages.length === 0 && <li className="muted">No messages yet.</li>}
            {messages.map((message) => (
              <li key={message.id}>
                <div className="thread-message-heading">
                  <strong>{message.sender.username}</strong>
                  <time dateTime={message.created_at}>{messageTime(message.created_at)}</time>
                </div>
                <p>{message.body}</p>
              </li>
            ))}
          </ol>
          {canPost ? <>
            <div className="quick-replies" role="group" aria-label="Quick replies">
              {QUICK_REPLIES.map((reply) => (
                <button key={reply} type="button" className="button quiet" disabled={sending} onClick={() => void send(reply)}>
                  {reply}
                </button>
              ))}
            </div>
            <form className="table-chat-form" onSubmit={(event) => void send(draft, event)}>
              <label htmlFor="table-chat-draft">Message</label>
              <div>
                <input
                  id="table-chat-draft"
                  value={draft}
                  maxLength={MAX_MESSAGE_LENGTH}
                  placeholder="Say something…"
                  onChange={(event) => setDraft(event.target.value)}
                />
                <button className="button primary" type="submit" disabled={sending || !draft.trim()}>Send</button>
              </div>
            </form>
            <p className="field-hint">Keep it friendly. Table chat is visible to everyone who can see this table.</p>
          </> : <p className="field-hint">Take a seat to join the chat. You can still read along.</p>}
          {error && <p role="alert" className="field-error">{error}</p>}
        </>}
    </section>
  )
}
