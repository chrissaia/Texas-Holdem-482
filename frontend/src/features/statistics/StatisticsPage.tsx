import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { request } from '../../api/client'
import { useProfile } from '../profile/context'
import './statistics.css'

type Statistics = {
  username: string
  period: 'all_time'
  hands_played: number
  hands_won: number
  hands_lost: number
  hands_split: number
  win_rate: number
}

/** Show the signed-in account's recorded hand outcomes, without fabricated history. */
export function StatisticsPage() {
  const { registered, loading: identityLoading } = useProfile()
  const [stats, setStats] = useState<Statistics | null>(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [loadedAttempt, setLoadedAttempt] = useState(-1)
  useEffect(() => {
    if (!registered) return
    let active = true
    request<Statistics>('/api/profile/stats/').then(value => {
      if (active) setStats(value)
    }).catch(() => {
      if (active) setError('We could not load your statistics. Try again or sign in again.')
    }).finally(() => {
      if (active) setLoadedAttempt(attempt)
    })
    return () => { active = false }
  }, [registered, attempt])
  const refresh = () => { setError(''); setAttempt(n => n + 1) }
  const pending = loadedAttempt !== attempt
  const metrics = stats ? [
    ['Hands played', stats.hands_played.toLocaleString('en-US')],
    ['Hands won', stats.hands_won.toLocaleString('en-US')],
    ['Hands lost', stats.hands_lost.toLocaleString('en-US')],
    ['Hands split', stats.hands_split.toLocaleString('en-US')],
    ['Hand win rate', `${stats.win_rate.toFixed(1)}%`],
  ] : []
  return <section className="statistics-page">
    <header className="page-intro">
      <span className="eyebrow">PERSONAL STATISTICS</span>
      <div className="statistics-heading">
        <h1>Your game, in focus.</h1>
        {registered && !identityLoading && <button className="button primary" disabled={pending} onClick={refresh}>Refresh stats</button>}
      </div>
      <p className="muted">A clear record of your completed poker hands.</p>
    </header>
    {identityLoading ? <p role="status">Checking your account…</p> : !registered ?
      <p className="notice"><Link to="/login">Sign in</Link> with a registered account to see your poker statistics.</p> :
      error ? <div role="alert" className="notice error-notice">{error} <button className="text-button" onClick={refresh}>Try again</button></div> :
      pending ? <p role="status">Loading your statistics…</p> : stats && <>
        <div className="statistics-period"><span className="badge">All time</span><span className="muted">{stats.username} · Private to you</span></div>
        <section className="panel" aria-labelledby="performance-heading">
          <h2 id="performance-heading">Performance overview</h2>
          <dl className="statistics-metrics">{metrics.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
        </section>
        {stats.hands_played === 0 ? <section className="panel statistics-empty">
          <h2>No recorded hands yet</h2>
          <p className="muted">Your statistics will appear here when completed hands are recorded. Chip rewards and joining tables do not count as hands.</p>
          <Link to="/lobby">Browse tables</Link>
        </section> : <section className="panel" aria-labelledby="outcomes-heading">
          <h2 id="outcomes-heading">Outcome breakdown</h2>
          <table className="statistics-outcomes" aria-label="Hand outcomes">
            <thead><tr><th scope="col">Outcome</th><th scope="col">Hands</th><th scope="col">Rate</th></tr></thead>
            <tbody>{([
              ['Won', stats.hands_won], ['Lost', stats.hands_lost], ['Split', stats.hands_split],
            ] as const).map(([label, count]) => <tr key={label}><th scope="row">{label}</th><td>{count.toLocaleString('en-US')}</td><td>{(count / stats.hands_played * 100).toFixed(1)}%</td></tr>)}</tbody>
          </table>
          <p className="field-hint">Win rate is outright wins divided by all recorded hands. Split pots count as hands played, but not as wins. Rounded rates may not total exactly 100%.</p>
        </section>}
      </>}
  </section>
}
