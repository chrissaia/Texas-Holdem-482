/**
 * Module: tables/TableDetailPage.tsx.
 * Render the tables screen, including user actions, loading states and request feedback.
 */
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getTable } from './api'
import { SeatPanel } from './SeatPanel'
import type { PokerTable } from './types'

/** Render the table detail page interface and its current state. */
export function TableDetailPage() {
  const { id = '' } = useParams()
  return <TableRecord key={id} id={id} />
}

/** Render the table record interface and its current state. */
function TableRecord({ id }: { id: string }) {
  const [table, setTable] = useState<PokerTable | null>(null)
  const [error, setError] = useState('')
  useEffect(/* Synchronize component state with external data and release resources on cleanup. */ () => {
    let active = true
    getTable(id)
      .then(/* Apply the successful asynchronous result to the current operation. */ (value) => {
        if (active) setTable(value)
      })
      .catch(/* Handle the failed operation without leaving stale UI feedback. */ () => {
        if (active)
          setError(
            'This table could not be loaded. It may no longer be available.',
          )
      })
    return /* Return the derived value for the enclosing operation. */ () => {
      active = false
    }
  }, [id])
  return (
    <>
      <Link className="back-link" to="/lobby">
        ← Back to lobby
      </Link>
      {error ? (
        <div role="alert" className="notice error-notice">
          {error}
        </div>
      ) : !table ? (
        <p role="status">Loading table…</p>
      ) : (
        <section className="panel table-detail">
          <span className="badge">Public · {table.status}</span>
          <h1>{table.name}</h1>
          <p className="muted">Hosted by {table.host.username}</p>
          <dl className="summary-list">
            <div>
              <dt>Players</dt>
              <dd>
                {table.player_count} / {table.max_players}
              </dd>
            </div>
            <div>
              <dt>Blinds</dt>
              <dd>
                {table.small_blind} / {table.big_blind}
              </dd>
            </div>
            <div>
              <dt>Buy-in</dt>
              <dd>{table.buy_in.toLocaleString('en-US')} virtual chips</dd>
            </div>
            <div>
              <dt>Minimum balance</dt>
              <dd>{table.minimum_balance.toLocaleString('en-US')}</dd>
            </div>
          </dl>
          <SeatPanel table={table} onOccupancy={count => setTable(current => current ? { ...current, player_count: count } : current)} />
          <p className="field-hint">
            Your seat and buy-in can be saved here. Poker hands are not available yet.
          </p>
        </section>
      )}
    </>
  )
}
