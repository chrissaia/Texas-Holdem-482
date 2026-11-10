/** Read-only observer for authoritative table occupancy; gameplay integration is pending (S26). */
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { request } from '../../api/client'

type State = {
  id: number; name: string; status: string; is_public: boolean; max_players: number;
  small_blind: number; big_blind: number; gameplay_available: false;
  players: { id: number; username: string; stack: number }[];
}

/** Poll safe server state without joining, debiting chips or exposing private card data. */
export function SpectatorPage() {
  const { id } = useParams()
  const [state, setState] = useState<State | null>(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    let pending = false
    /** Fetch this view’s authorized server data and ignore late responses after unmount. */
    async function load() {
      if (pending || document.visibilityState === 'hidden') return
      pending = true
      try {
        const value = await request<State>(`/api/tables/${id}/watch/`)
        if (active) { setState(value); setError('') }
      } catch {
        if (active) { setState(null); setError('This table is unavailable or you no longer have access.') }
      } finally { pending = false }
    }
    void load()
    const interval = window.setInterval(() => void load(), 5000)
    window.addEventListener('focus', load)
    document.addEventListener('visibilitychange', load)
    return () => { active = false; window.clearInterval(interval); window.removeEventListener('focus', load); document.removeEventListener('visibilitychange', load) }
  }, [id, attempt])
  return <section className="panel" aria-label="Spectator view">
    <Link to={`/tables/${id}`}>Back to table</Link>
    <h1>Watch table</h1>
    <p className="badge">Read-only · no seat or chips required</p>
    {error ? <p role="alert">{error}</p> : !state ? <p role="status">Loading table state…</p> : <>
      <h2>{state.name}</h2>
      <p>{state.is_public ? 'Public' : 'Private'} · {state.status} · Blinds {state.small_blind} / {state.big_blind}</p>
      <p>{state.players.length} / {state.max_players} seated</p>
      <ul>{state.players.map(player => <li key={player.id}>{player.username} · {player.stack.toLocaleString('en-US')} table chips</li>)}</ul>
      {!state.players.length && <p>Waiting for players to take a seat.</p>}
      <p className="notice">Seat updates refresh every five seconds. Live poker hands, cards and betting are not available yet.</p>
    </>}
    <button className="button" onClick={() => setAttempt(n => n + 1)}>Refresh spectator view</button>
  </section>
}
