import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useProfile } from '../profile/context'
import { changeSeat, getSeat } from './api'
import type { SeatStatus } from './api'
import type { PokerTable } from './types'

/** Reserve the server-defined buy-in, with the final check performed on the server. */
export function SeatPanel({ table, onOccupancy }: {
  table: PokerTable; onOccupancy: (count: number) => void
}) {
  const { registered, loading: identityLoading, refresh: refreshProfile } = useProfile()
  const [status, setStatus] = useState<SeatStatus | null>(null)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [loadedAttempt, setLoadedAttempt] = useState(-1)
  useEffect(() => {
    if (!registered) return
    let active = true
    getSeat(table.id).then(value => {
      if (active) setStatus(value)
    }).catch(() => {
      if (active) setError('We could not check your seat. Refresh or sign in again.')
    }).finally(() => {
      if (active) setLoadedAttempt(attempt)
    })
    return () => { active = false }
  }, [table.id, registered, attempt])
  const refresh = () => { setError(''); setAttempt(n => n + 1) }
  const act = async (method: 'POST' | 'DELETE') => {
    if (!status || pending) return
    setPending(true)
    setError('')
    try {
      const value = await changeSeat(table.id, method, status.csrf_token)
      setStatus(value)
      onOccupancy(value.player_count)
      refreshProfile()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Your seat could not be changed.')
    } finally { setPending(false) }
  }
  if (identityLoading) return <p role="status">Checking your account…</p>
  if (!registered) return <p className="notice"><Link to="/login">Sign in</Link> with a registered account to join this table.</p>
  const loading = loadedAttempt !== attempt
  const required = Math.max(table.buy_in, table.minimum_balance)
  const insufficient = status !== null && status.chip_balance < required
  return <section className="seat-panel" aria-label="Your seat">
    <h2>Your seat</h2>
    {error && <p role="alert" className="notice error-notice">{error}</p>}
    {loading ? <p role="status">Checking your seat…</p> : status && <>
      <p>Available wallet: <strong>{status.chip_balance.toLocaleString('en-US')} chips</strong></p>
      {status.seat ? <>
        <p role="status">You have a seat. Reserved at this table: <strong>{status.seat.stack.toLocaleString('en-US')} chips</strong>.</p>
        <button className="button" disabled={pending || table.status === 'playing'} onClick={() => void act('DELETE')}>Leave table and return chips</button>
        {table.status === 'playing' && <p className="field-hint">Wait for play to finish before leaving.</p>}
      </> : status.other_table_id ? <p className="notice">You already have a seat. <Link to={`/tables/${status.other_table_id}`}>Go to your table</Link> to leave first.</p> : <>
        <p className="field-hint">Joining reserves {table.buy_in.toLocaleString('en-US')} chips from your wallet. Leaving the waiting table returns them.</p>
        {insufficient && <p className="notice">You need at least {required.toLocaleString('en-US')} chips to join. <Link to="/rewards">Get chips</Link></p>}
        <button className="button primary" disabled={pending || insufficient || table.status !== 'waiting' || status.player_count >= table.max_players} onClick={() => void act('POST')}>
          Join table · {table.buy_in.toLocaleString('en-US')} chips
        </button>
        {table.status !== 'waiting' && <p className="field-hint">This table is not accepting players right now.</p>}
        {status.player_count >= table.max_players && <p className="field-hint">This table is full.</p>}
      </>}
    </>}
    <button className="button" disabled={pending || loading} onClick={refresh}>Refresh seat</button>
    {pending && <p role="status">Saving your seat…</p>}
  </section>
}
