/** Hosted and invited private tables, kept separate from public lobby results (S27). */
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { request } from '../../api/client'
import { useProfile } from '../profile/context'
import type { PokerTable } from './types'

/** Fetch private entries only after registered identity has been established. */
export function PrivateTablesPage() {
  const { registered, loading } = useProfile()
  const [tables, setTables] = useState<PokerTable[] | null>(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    if (!registered || loading) return
    let active = true
    request<{ results: PokerTable[] }>('/api/tables/private/')
      .then(value => { if (active) setTables(value.results) })
      .catch(() => { if (active) setError('We could not load your private tables.') })
    return () => { active = false }
  }, [registered, loading, attempt])
  return <section className="panel">
    <h1>Private tables and invitations</h1>
    <Link to="/tables/create">Create a private table</Link>
    {loading ? <p role="status">Checking your account…</p> : !registered ? <p><Link to="/login">Sign in</Link> to see your invitations.</p> : error ? <p role="alert">{error}</p> : !tables ? <p role="status">Loading private tables…</p> : tables.length ? <ul>{tables.map(table => <li key={table.id}><Link to={`/tables/${table.id}`}>{table.name}</Link> · hosted by {table.host.username} · {table.status}</li>)}</ul> : <p>No hosted tables or invitations yet.</p>}
    {registered && <button className="button" onClick={() => { setError(''); setTables(null); setAttempt(n => n + 1) }}>Refresh private tables</button>}
  </section>
}
