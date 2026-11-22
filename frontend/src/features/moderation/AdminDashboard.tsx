import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ApiError, request } from '../../api/client'
import './moderation.css'

type Access = {
  username: string; csrf_token: string; can_view_users: boolean; can_change_users: boolean
  can_view_tables: boolean; can_change_tables: boolean; can_view_audit: boolean
}
type Tab = 'users' | 'tables' | 'audit'
type Row = {
  id: number; username?: string; is_active?: boolean; is_admin?: boolean; name?: string
  host?: string; status?: string; is_public?: boolean; player_count?: number; max_players?: number
  buy_in?: number; actor?: string; target?: string; action?: string; reason?: string
  before?: string; after?: string; created_at?: string
}
type Page = { count: number; page: number; page_size: number; results: Row[] }
type Selection = { id: number; label: string; action: string; expected: string }

function forbidden(error: unknown) { return error instanceof ApiError && error.status === 403 }

/** The API is authoritative; no private records render before staff authorization. */
export function AdminDashboard() {
  const [access, setAccess] = useState<Access | null>(null)
  const [error, setError] = useState('')
  const [denied, setDenied] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    request<Access>('/api/moderation/').then(value => {
      if (active) setAccess(value)
    }).catch(cause => {
      if (!active) return
      if (forbidden(cause)) setDenied(true)
      else setError('We could not load administration. Try again.')
    })
    return () => { active = false }
  }, [attempt])
  if (denied) return <section className="panel"><h1>Administrator access required</h1>
    <p>This area is available to authorized staff only.</p><Link to="/login">Sign in / switch account</Link></section>
  if (error) return <section className="panel"><p role="alert">{error}</p>
    <button className="button" onClick={() => { setError(''); setAttempt(n => n + 1) }}>Try again</button></section>
  if (!access) return <p role="status">Checking administrator access…</p>
  return <Workspace access={access} onDenied={() => { setAccess(null); setDenied(true) }} />
}

function Workspace({ access, onDenied }: { access: Access; onDenied: () => void }) {
  const tabs: Tab[] = [
    ...(access.can_view_users ? ['users' as const] : []),
    ...(access.can_view_tables ? ['tables' as const] : []),
    ...(access.can_view_audit ? ['audit' as const] : []),
  ]
  const [tab, setTab] = useState<Tab>(tabs[0] || 'users')
  const [draft, setDraft] = useState('')
  const [filter, setFilter] = useState('all')
  const [query, setQuery] = useState({ q: '', state: 'all', page: 1 })
  const [page, setPage] = useState<Page | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [selection, setSelection] = useState<Selection | null>(null)
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const busy = useRef(false)
  const reasonInput = useRef<HTMLTextAreaElement>(null)
  const hasTabs = tabs.length > 0

  useEffect(() => {
    if (!hasTabs) return
    let active = true
    request<Page>(`/api/moderation/${tab}/?${new URLSearchParams({ ...query, page: String(query.page) })}`)
      .then(value => { if (active) setPage(value) })
      .catch(cause => {
        if (!active) return
        if (forbidden(cause)) onDenied()
        else setError('We could not load records. Refresh to try again.')
      })
    return () => { active = false }
  }, [tab, query, attempt, hasTabs, onDenied])
  useEffect(() => { if (selection) reasonInput.current?.focus() }, [selection])

  function reload() { setPage(null); setError(''); setAttempt(n => n + 1) }
  function changeTab(next: Tab) {
    setTab(next); setPage(null); setDraft(''); setFilter('all')
    setQuery({ q: '', state: 'all', page: 1 }); setSelection(null); setError(''); setNotice('')
  }
  function select(row: Row) {
    setError(''); setNotice(''); setReason('')
    setSelection({ id: row.id, label: row.username || row.name || '',
      action: tab === 'users' ? (row.is_active ? 'suspend' : 'reactivate') : (row.status === 'closed' ? 'reopen' : 'close'),
      expected: tab === 'users' ? (row.is_active ? 'active' : 'suspended') : row.status! })
  }
  async function confirm(event: React.FormEvent) {
    event.preventDefault()
    if (!selection || busy.current) return
    busy.current = true; setSaving(true); setError('')
    try {
      await request(`/api/moderation/${tab}/${selection.id}/action/`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRFToken': access.csrf_token },
        body: JSON.stringify({ action: selection.action, expected: selection.expected, reason: reason.trim() }),
      })
      setNotice(`Saved ${selection.action} for ${selection.label}. The change was recorded in the audit trail.`)
      setSelection(null); reload()
    } catch (cause) {
      if (forbidden(cause)) onDenied()
      else {
        setError(cause instanceof Error ? cause.message : 'The change could not be saved.')
        if (cause instanceof ApiError && cause.status === 409) {
          setSelection(null); setPage(null); setAttempt(n => n + 1)
        }
      }
    } finally { busy.current = false; setSaving(false) }
  }

  return <section className="moderation-page">
    <header className="page-intro"><span className="eyebrow">ADMINISTRATION</span>
      <h1>Keep the table fair.</h1><p>Manage accounts and tables. Every change leaves a record.</p></header>
    <div className="moderation-callout"><strong>Moderation, with care.</strong>
      <p>Account suspensions preserve player data. Seated players, administrator accounts, occupied tables and games in play are protected.</p></div>
    {!hasTabs ? <p className="notice">Your staff account has no dashboard view permissions. Ask your administrator to assign them.</p> : <>
      <nav className="moderation-tabs" aria-label="Administration sections">{tabs.map(value =>
        <button className={`button ${tab === value ? 'primary' : ''}`} aria-pressed={tab === value}
          key={value} disabled={saving} onClick={() => changeTab(value)}>
          {value === 'audit' ? 'Audit trail' : value === 'users' ? 'Users' : 'Tables'}</button>)}</nav>
      <div className="panel">
        <form className="moderation-filters" onSubmit={event => {
          event.preventDefault(); setPage(null); setSelection(null); setError('')
          setQuery({ q: draft, state: filter, page: 1 })
        }}>
          <label>Search {tab === 'users' ? 'usernames' : tab === 'tables' ? 'tables or hosts' : 'targets or administrators'}
            <input type="search" maxLength={80} value={draft} disabled={saving} onChange={e => setDraft(e.target.value)} /></label>
          {tab !== 'audit' && <label>Status<select value={filter} disabled={saving} onChange={e => setFilter(e.target.value)}>
            <option value="all">All statuses</option>
            {(tab === 'users' ? ['active', 'suspended'] : ['waiting', 'playing', 'closed']).map(value => <option key={value}>{value}</option>)}
          </select></label>}
          <button className="button primary" disabled={saving}>Search</button>
          <button type="button" className="button" disabled={saving} onClick={() => { setSelection(null); reload() }}>Refresh</button>
        </form>
        {notice && <p role="status" className="notice">{notice}</p>}
        {error && <p role="alert" className="notice error-notice">{error}</p>}
        {selection && <form className="moderation-confirm" onSubmit={confirm} aria-label="Confirm moderation change">
          <h2>Confirm {selection.action}: {selection.label}</h2>
          <p>This changes the {tab === 'users' ? 'account access' : 'table availability'} immediately.</p>
          <label htmlFor="moderation-reason">Reason (required)</label>
          <textarea id="moderation-reason" ref={reasonInput} required minLength={3} maxLength={300}
            value={reason} disabled={saving} onChange={e => setReason(e.target.value)} />
          <div className="moderation-actions"><button className="button primary" disabled={saving || reason.trim().length < 3}>
            {saving ? 'Saving…' : `Confirm ${selection.action}`}</button>
            <button className="button" type="button" disabled={saving} onClick={() => setSelection(null)}>Cancel</button></div>
        </form>}
        {!page && !error ? <p role="status">Loading records…</p> : page && <>
          <p className="field-hint">{page.count} matching {tab === 'audit' ? 'changes' : tab}</p>
          {!page.results.length ? <p className="notice">No matching records. Try another search or status.</p> :
            <div className="moderation-table" role="region" aria-label={`${tab} records`} tabIndex={0}>
              <table><thead><tr>{(tab === 'users' ? ['User', 'Status', 'Role', 'Action'] : tab === 'tables' ?
                ['Table / host', 'Visibility', 'Status', 'Seats', 'Buy-in', 'Action'] :
                ['When / administrator', 'Target', 'Change', 'Reason']).map(text => <th key={text} scope="col">{text}</th>)}</tr></thead>
                <tbody>{page.results.map(row => <tr key={row.id}>
                  {tab === 'users' ? <><th scope="row">{row.username}<small>#{row.id}</small></th>
                    <td><span className="badge">{row.is_active ? 'Active' : 'Suspended'}</span></td>
                    <td>{row.is_admin ? 'Administrator' : 'Player'}</td><td>{access.can_change_users ?
                      <button className="button" disabled={saving || row.is_admin} aria-label={`${row.is_active ? 'Suspend' : 'Reactivate'} ${row.username}`}
                        onClick={() => select(row)}>{row.is_active ? 'Suspend' : 'Reactivate'}</button> : 'View only'}</td></> :
                  tab === 'tables' ? <><th scope="row">{row.name}<small>#{row.id} · {row.host}</small></th>
                    <td>{row.is_public ? 'Public' : 'Private'}</td><td><span className="badge">{row.status}</span></td>
                    <td>{row.player_count} / {row.max_players}</td><td>{row.buy_in?.toLocaleString()} chips</td>
                    <td>{access.can_change_tables ? <button className="button" disabled={saving || row.status === 'playing' || !!row.player_count}
                      aria-label={`${row.status === 'closed' ? 'Reopen' : 'Close'} ${row.name}`} onClick={() => select(row)}>
                      {row.status === 'closed' ? 'Reopen' : 'Close'}</button> : 'View only'}</td></> :
                  <><td>{new Date(row.created_at!).toLocaleString()}<small>{row.actor}</small></td><th scope="row">{row.target}</th>
                    <td>{row.action}<small>{row.before} → {row.after}</small></td><td>{row.reason}</td></>}
                </tr>)}</tbody></table>
            </div>}
          <div className="moderation-pagination"><button className="button" disabled={saving || page.page <= 1} onClick={() => {
            setPage(null); setSelection(null); setQuery(value => ({ ...value, page: value.page - 1 }))
          }}>Previous</button><span>Page {page.page} of {Math.max(1, Math.ceil(page.count / page.page_size))}</span>
            <button className="button" disabled={saving || page.page * page.page_size >= page.count} onClick={() => {
              setPage(null); setSelection(null); setQuery(value => ({ ...value, page: value.page + 1 }))
            }}>Next</button></div>
        </>}
      </div>
    </>}
  </section>
}
