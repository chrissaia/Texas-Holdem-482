import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getTable } from './api'
import type { PokerTable } from './types'

export function TableDetailPage() {
  const { id = '' } = useParams()
  return <TableRecord key={id} id={id} />
}

function TableRecord({ id }: { id: string }) {
  const [table, setTable] = useState<PokerTable | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    getTable(id)
      .then((value) => {
        if (active) setTable(value)
      })
      .catch(() => {
        if (active)
          setError(
            'This table could not be loaded. It may no longer be available.',
          )
      })
    return () => {
      active = false
    }
  }, [id])
  return (
    <>
      <Link className="back-link" to="/tables/create">
        ← Create a table
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
          <p className="field-hint">
            Your table settings are saved. Joining and gameplay are coming in
            later stories.
          </p>
        </section>
      )}
    </>
  )
}
