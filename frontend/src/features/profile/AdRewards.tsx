import { useEffect, useRef, useState } from 'react'
import { request } from '../../api/client'
import { useProfile } from './context'
import './ad-rewards.css'
import type { Profile } from './types'

type Media = { title: string; kind: 'image' | 'video'; media_url: string; view_seconds: number }
type Ad = Media & { id: number; reward: number; claimed: boolean }
type Catalog = { csrf_token: string; daily_limit: number; remaining: number; ads: Ad[] }
type Playback = Media & { id: number; token: string }
const base = '/api/profile/ads/'

function post<T>(path: string, csrf: string) {
  return request<T>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrf },
    body: '{}',
  })
}

function AdPlayback({ ad, onClaim, onCancel, pending }: {
  ad: Playback; onClaim: () => void; onCancel: () => void; pending: boolean
}) {
  const [loaded, setLoaded] = useState(false)
  const [ended, setEnded] = useState(false)
  const [error, setError] = useState(false)
  const [remaining, setRemaining] = useState(ad.view_seconds)
  const watchedUntil = useRef(0)

  useEffect(() => {
    if (!loaded || error) return
    const deadline = performance.now() + ad.view_seconds * 1000
    const timer = window.setInterval(() => {
      const seconds = Math.max(0, Math.ceil((deadline - performance.now()) / 1000))
      setRemaining(seconds)
      if (!seconds) window.clearInterval(timer)
    }, 250)
    return () => window.clearInterval(timer)
  }, [loaded, error, ad.view_seconds])

  return <div className="ad-playback">
    <h3>{ad.title}</h3>
    {ad.kind === 'image'
      ? <img src={ad.media_url} alt={ad.title} onLoad={() => setLoaded(true)} onError={() => setError(true)} />
      : <video src={ad.media_url} controls playsInline aria-label={ad.title}
          onPlay={() => setLoaded(true)} onEnded={() => setEnded(true)} onError={() => setError(true)}
          onTimeUpdate={event => {
            const video = event.currentTarget
            if (!video.seeking) watchedUntil.current = Math.max(watchedUntil.current, video.currentTime)
          }}
          onSeeking={event => {
            const video = event.currentTarget
            if (video.currentTime > watchedUntil.current + 0.25) video.currentTime = watchedUntil.current
          }} />}
    {error ? <p role="alert">The ad could not play. Close it and try another offer.</p>
      : <p className="field-hint">{!loaded ? (ad.kind === 'image' ? 'Loading image...' : 'Press play to start.')
        : remaining ? `Required viewing time remaining: ${remaining}s`
        : ad.kind === 'video' && !ended ? 'Finish the video to claim.' : 'Reward ready to claim.'}</p>}
    <div className="reward-actions">
      <button className="button primary" disabled={pending || error || !loaded || !!remaining || (ad.kind === 'video' && !ended)}
        onClick={onClaim}>{pending ? 'Claiming…' : 'Claim ad reward'}</button>
      <button className="button" disabled={pending} onClick={onCancel}>Close ad</button>
    </div>
  </div>
}
function AdViewer({ ad, pending, error, onClaim, onClose }: {
  ad: Playback; pending: boolean; error: string; onClaim: () => void; onClose: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const node = dialog.current!
    node.showModal()
    return () => { if (node.open) node.close() }
  }, [])

  return <dialog ref={dialog} className="ad-viewer panel" aria-label={`Sponsored ad: ${ad.title}`}
    onCancel={event => { event.preventDefault(); if (!pending) onClose() }}>
    <p className="eyebrow">Sponsored</p>
    {error && <p role="alert" className="field-error">{error}</p>}
    <AdPlayback ad={ad} pending={pending} onClaim={onClaim} onCancel={onClose} />
  </dialog>
}

export function AdRewards({ placement = 'rewards' }: { placement?: 'lobby' | 'rewards' }) {
  const { registered, update } = useProfile()
  const [catalog, setCatalog] = useState<Catalog | null>(null)
  const [playback, setPlayback] = useState<Playback | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [revision, setRevision] = useState(0)
  const busy = useRef(false)
  const lobby = placement === 'lobby'
  const featured = catalog && catalog.remaining > 0 ? catalog.ads.find(ad => !ad.claimed) : undefined

  useEffect(() => {
    if (!registered) return
    const controller = new AbortController()
    request<Catalog>(base, { signal: controller.signal }).then(value => {
      if (!Array.isArray(value.ads)) throw new Error('Could not load ad offers.')
      if (!controller.signal.aborted) setCatalog(value)
    }).catch(cause => {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Could not load ad offers.')
    })
    return () => controller.abort()
  }, [registered, revision])

  async function run(action: () => Promise<void>) {
    if (busy.current) return
    busy.current = true
    setPending(true)
    setError('')
    try { await action() }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'The ad request could not be completed.') }
    finally { busy.current = false; setPending(false) }
  }

  function start(ad: Ad) {
    if (!catalog) return
    setNotice('')
    void run(async () => {
      const playback = await post<Omit<Playback, 'id'>>(`${base}${ad.id}/start/`, catalog.csrf_token)
      setPlayback({ ...playback, id: ad.id })
    })
  }

  async function claim() {
    if (!catalog || !playback) return
    const result = await post<{ profile: Profile; awarded: number }>(`${base}claim/${playback.token}/`, catalog.csrf_token)
    update(result.profile)
    setPlayback(null)
    setNotice(`${result.awarded.toLocaleString()} virtual chips earned from this ad.`)
    // Update eligibility immediately even if the refresh fails.
    setCatalog({
      ...catalog,
      remaining: Math.max(0, catalog.remaining - 1),
      ads: catalog.ads.map(ad => ad.id === playback.id ? { ...ad, claimed: true } : ad),
    })
    setRevision(value => value + 1)
  }

  function refresh() {
    setError('')
    setRevision(value => value + 1)
  }

  if (!registered || (lobby && !featured && !playback && !notice)) return null
  return <section className={`panel ad-rewards${lobby ? ' sponsored-offer' : ''}`}
    aria-label={lobby ? 'Sponsored chip offer' : 'Earn chips from ads'}>
    {!lobby && <h2>Earn chips from ads</h2>}
    {notice && <p role="status">{notice}</p>}
    {!playback && error && <p role="alert" className="field-error">{error}</p>}
    {playback && <AdViewer key={playback.token} ad={playback} pending={pending} error={error}
      onClose={() => { setError(''); setPlayback(null); refresh() }}
      onClaim={() => void run(claim)} />}
    {lobby ? featured && <div className="sponsored-offer-content">
      {featured.kind === 'image' && <img className="sponsored-preview" src={featured.media_url} alt="" loading="lazy" />}
      <div>
        <p className="eyebrow">Sponsored</p>
        <h2>{featured.title}</h2>
        <p className="field-hint">{featured.kind === 'video' ? 'Video' : 'Image'} · {featured.view_seconds}s minimum</p>
      </div>
      <button className="button" disabled={pending} onClick={() => start(featured)}>
        View ad · Earn {featured.reward.toLocaleString()} chips
      </button>
    </div> : <>
      {!catalog && !error && <p role="status">Loading ad offers…</p>}
      {catalog && <>
        <p className="field-hint">{catalog.remaining} of {catalog.daily_limit} ad rewards available today. Resets at 00:00 UTC.</p>
        {!catalog.ads.length && <p>No ads available right now.</p>}
        {!!catalog.ads.length && !catalog.remaining && <p>You’ve reached today’s ad reward limit.</p>}
        {!!catalog.ads.length && <ul className="ad-list">{catalog.ads.map(ad => <li key={ad.id}>
          <div><strong>{ad.title}</strong><p className="field-hint">
            {ad.kind === 'video' ? 'Video' : 'Image'} · {ad.view_seconds}s minimum · +{ad.reward.toLocaleString()} chips
          </p></div>
          <button className="button" disabled={pending || ad.claimed || !catalog.remaining}
            aria-label={ad.claimed ? `${ad.title} claimed today` : `View ${ad.title}`}
            onClick={() => start(ad)}>{ad.claimed ? 'Claimed today' : 'View ad'}</button>
        </li>)}</ul>}
      </>}
      {(catalog || error) && <button className="text-button" disabled={pending} onClick={refresh}>Refresh ads</button>}
    </>}
  </section>
}
