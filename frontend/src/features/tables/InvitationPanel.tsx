/** Host-only controls for accepted-friend invitations and safe revocation (S27). */
import { useEffect, useState } from 'react'
import { request } from '../../api/client'
import { getFriends } from '../friends/api'
import { getCreationContext } from './api'
import type { PokerTable } from './types'

type Player = { id: number; username: string }
type Invitations = { results: Player[]; csrf_token: string }

/** Check host identity, then load invitation and accepted-friend choices. */
export function InvitationPanel({ table }: { table: PokerTable }) {
  const [data, setData] = useState<Invitations | null>(null)
  const [friends, setFriends] = useState<Player[]>([])
  const [selected, setSelected] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const [host, setHost] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const path = `/api/tables/${table.id}/invitations/`
  useEffect(() => {
    let active = true
    /** Fetch this view’s authorized server data and ignore late responses after unmount. */
    async function load() {
      try {
        const context = await getCreationContext()
        if (!active || context.host?.id !== table.host.id) return
        setHost(true)
        const [invites, list] = await Promise.all([request<Invitations>(path), getFriends()])
        if (active) { setData(invites); setFriends(list.friends.map(entry => entry.player)) }
      } catch { if (active) setError('We could not load the invitation controls.') }
    }
    void load()
    return () => { active = false }
  }, [path, table.host.id, attempt])
  /** Send the host's explicit invite or revoke action with the session CSRF token. */
  async function change(method: 'POST' | 'DELETE', id: number) {
    if (!data || pending) return
    setPending(true); setError('')
    try {
      setData(await request<Invitations>(path, { method, headers: { 'Content-Type': 'application/json', 'X-CSRFToken': data.csrf_token }, body: JSON.stringify({ user_id: id }) }))
      setSelected('')
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not change the invitation.') }
    finally { setPending(false) }
  }
  if (!host) return error ? <p role="alert">{error}</p> : null
  return <section aria-label="Private table invitations">
    <h2>Invite friends</h2>
    {error && <p role="alert">{error}</p>}
    {!data ? <p role="status">Loading invitations…</p> : <>
      <label htmlFor="invited-friend">Accepted friend</label>
      <select id="invited-friend" value={selected} onChange={e => setSelected(e.target.value)} disabled={pending}>
        <option value="">Select a friend</option>
        {friends.filter(friend => !data.results.some(invite => invite.id === friend.id)).map(friend => <option key={friend.id} value={friend.id}>{friend.username}</option>)}
      </select>
      <button className="button" disabled={!selected || pending} onClick={() => void change('POST', Number(selected))}>Invite friend</button>
      <ul>{data.results.map(player => <li key={player.id}>{player.username} <button className="text-button" disabled={pending} onClick={() => void change('DELETE', player.id)}>Revoke {player.username}</button></li>)}</ul>
      {!data.results.length && <p>No invitations yet. Only invited accounts and you can access this table.</p>}
    </>}
    <button className="text-button" disabled={pending} onClick={() => { setError(''); setAttempt(n => n + 1) }}>Refresh invitations</button>
  </section>
}
