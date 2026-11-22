import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ApiError, request } from '../../api/client'
import './ad-management.css'

const endpoint = '/api/profile/ads/manage/'

type Ad = {
  id: number; title: string; kind: 'image' | 'video'; reward: number;
  view_seconds: number; active: boolean; media_url: string; revision: string
}
type Catalog = { ads: Ad[]; daily_limit: number; csrf_token: string }

function errorMessage(error: unknown) {
  if (error instanceof ApiError) {
    const fields = Object.entries(error.body).flatMap(([field, messages]) =>
      Array.isArray(messages) ? [`${field.replaceAll('_', ' ')}: ${messages.join(' ')}`] : [])
    if (fields.length) return fields.join(' ')
  }
  return error instanceof Error ? error.message : 'Unable to save changes. Try again.'
}

export function ManageAdsPage() {
  const [catalog, setCatalog] = useState<Catalog | null>(null)
  const [loadError, setLoadError] = useState('')
  const [denied, setDenied] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    request<Catalog>(endpoint, { signal: controller.signal }).then(value => {
      if (!controller.signal.aborted) setCatalog(value)
    }).catch(error => {
      if (controller.signal.aborted) return
      if (error instanceof ApiError && error.status === 403) setDenied(true)
      else setLoadError('Could not load ads. Try again.')
    })
    return () => controller.abort()
  }, [attempt])

  function refresh() {
    setCatalog(null)
    setLoadError('')
    setAttempt(value => value + 1)
  }

  return <section className="ad-manager">
    <header className="page-intro">
      <h1>Manage ads</h1>
      <p>Choose what players see and how many chips they can earn.</p>
    </header>
    {denied ? <div className="panel">
      <p role="alert">Ad management requires an authorized staff account.</p>
      <Link to="/login">Sign in / switch account</Link>
    </div> : loadError ? <div className="panel">
      <p role="alert">{loadError}</p><button className="button" onClick={refresh}>Try again</button>
    </div> : catalog ? <AdWorkspace initial={catalog} onDenied={() => {
      setCatalog(null)
      setDenied(true)
    }} onRefresh={refresh} /> : <p role="status">Loading ads…</p>}
  </section>
}

function AdWorkspace({ initial, onDenied, onRefresh }: {
  initial: Catalog; onDenied: () => void; onRefresh: () => void
}) {
  const [ads, setAds] = useState(initial.ads)
  const [limit, setLimit] = useState(initial.daily_limit)
  const [savedLimit, setSavedLimit] = useState(initial.daily_limit)
  const [selected, setSelected] = useState<Ad | 'new' | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const busy = useRef(false)
  const editor = useRef<HTMLElement>(null)

  useEffect(() => { if (selected) editor.current?.focus() }, [selected])

  async function save(action: () => Promise<void>) {
    if (busy.current) return
    busy.current = true
    setPending(true)
    setError('')
    setNotice('')
    try { await action() }
    catch (cause) {
      if (cause instanceof ApiError && cause.status === 403) onDenied()
      else setError(errorMessage(cause))
    } finally {
      busy.current = false
      setPending(false)
    }
  }

  function edit(ad: Ad | 'new' | null) {
    setError('')
    setNotice('')
    setSelected(ad)
  }

  function submitAd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selected) return
    const data = new FormData(event.currentTarget)
    const upload = data.get('media')
    if (upload instanceof File && !upload.name) data.delete('media')
    if (selected !== 'new') data.set('revision', selected.revision)
    void save(async () => {
      const ad = await request<Ad>(selected === 'new' ? endpoint : `${endpoint}${selected.id}/`, {
        method: 'POST', body: data, headers: { 'X-CSRFToken': initial.csrf_token },
      })
      setAds(previous => selected === 'new' ? [ad, ...previous] : previous.map(item => item.id === ad.id ? ad : item))
      setSelected(null)
      setNotice(`${ad.title} saved as ${ad.active ? 'active' : 'inactive'}.`)
    })
  }

  function submitLimit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void save(async () => {
      const result = await request<{ daily_limit: number }>(endpoint + 'policy/', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRFToken': initial.csrf_token },
        body: JSON.stringify({ daily_limit: limit }),
      })
      setSavedLimit(result.daily_limit)
      setNotice(`Daily limit saved. Players can claim up to ${result.daily_limit} ad reward${result.daily_limit === 1 ? '' : 's'} per UTC day.`)
    })
  }

  const current = selected === 'new' ? null : selected
  return <>
    <section className="panel">
      <h2>Daily reward limit</h2>
      <p className="field-hint">Maximum ad rewards per player. Resets at 00:00 UTC.</p>
      <form className="ad-manager-limit" onSubmit={submitLimit}>
        <label>Rewards per player per day
          <input type="number" min={1} max={30} required disabled={pending}
            value={Number.isNaN(limit) ? '' : limit} onChange={e => setLimit(e.currentTarget.valueAsNumber)} />
        </label>
        <button type="submit" className="button" disabled={pending || limit === savedLimit}>Save limit</button>
      </form>
    </section>
    {notice && <p role="status" className="notice">{notice}</p>}
    {error && <p role="alert" className="notice error-notice">{error}</p>}
    {selected && <section className="panel ad-editor" ref={editor} tabIndex={-1}>
      <h2>{current ? `Edit ${current.title}` : 'Create an ad'}</h2>
      <form key={current?.id ?? 'new'} onSubmit={submitAd}>
        <fieldset disabled={pending}>
          <label>Title<input name="title" required maxLength={100} defaultValue={current?.title} /></label>
          <label>Format<select name="kind" defaultValue={current?.kind ?? 'image'}>
            <option value="image">Image</option><option value="video">Video</option>
          </select></label>
          <div className="ad-manager-numbers">
            <label>Chip reward<input name="reward" type="number" min={1} max={10000}
              required defaultValue={current?.reward ?? 75} /></label>
            <label>Minimum viewing time (seconds)<input name="view_seconds" type="number" min={3} max={300}
              required defaultValue={current?.view_seconds ?? 5} /></label>
          </div>
          <label>{current ? 'Replace media (optional)' : 'Upload media'}
            <input name="media" type="file" accept=".png,.jpg,.jpeg,.webp,.mp4,.webm" required={!current} />
          </label>
          <p className="field-hint">Images up to 5 MB (PNG, JPEG, WebP). Videos up to 25 MB (MP4, WebM).</p>
          {current && <a href={current.media_url} target="_blank" rel="noreferrer">Open current media</a>}
          <label className="ad-manager-check"><input name="active" type="checkbox" defaultChecked={current?.active} />
            Show this ad to players
          </label>
        </fieldset>
        <div className="ad-manager-actions">
          <button className="button primary" disabled={pending}>{pending ? 'Saving…' : 'Save ad'}</button>
          <button className="button" type="button" disabled={pending} onClick={() => edit(null)}>Cancel</button>
        </div>
      </form>
    </section>}
    <section className="panel">
      <div className="ad-manager-heading">
        <h2>Rewarded ads</h2>
        <div className="ad-manager-actions">
          <button className="button" disabled={pending} onClick={onRefresh}>Refresh</button>
          <button className="button primary" disabled={pending} onClick={() => edit('new')}>Create ad</button>
        </div>
      </div>
      {ads.length ? <ul className="ad-list">{ads.map(ad => <li key={ad.id}>
        <div><strong>{ad.title}</strong>
          <p className="field-hint">{ad.active ? 'Active' : 'Inactive'} · {ad.kind === 'image' ? 'Image' : 'Video'} · {ad.reward.toLocaleString()} chips · {ad.view_seconds}s minimum</p>
        </div>
        <button className="button" disabled={pending} aria-label={`Edit ${ad.title}`} onClick={() => edit(ad)}>Edit</button>
      </li>)}</ul> : <p className="field-hint">No ads yet. Create one to get started.</p>}
    </section>
  </>
}
