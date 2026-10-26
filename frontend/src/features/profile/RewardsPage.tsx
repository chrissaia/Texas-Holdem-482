import { useEffect, useRef, useState } from 'react'
import { ApiError } from '../../api/client'
import info from '../../assets/figma/info.svg'
import chip60 from '../../assets/figma/reward-chip-60.png'
import inset50 from '../../assets/figma/reward-chip-inset-50.svg'
import chip38 from '../../assets/figma/reward-chip-38.png'
import inset28 from '../../assets/figma/reward-chip-inset-28.svg'
import { claimDaily } from './api'
import { ProfileGate } from './ProfileGate'
import { useProfile } from './context'
import './profile.css'

export function RewardsPage() {
  return (
    <div className="rewards-page">
      <div className="page-intro">
        <p className="eyebrow">VIRTUAL PLAY MONEY ONLY</p>
        <h1>Keep a seat at the table.</h1>
        <p>Claim your daily reward and make room for another poker night.</p>
      </div>
      <div className="notice reward-notice">
        <img src={info} alt="" />
        <div>
          <strong>No cash-out. No real-world monetary value.</strong>
          <p>
            RIVR chips are virtual play money. New registered players start with
            1,000 chips.
          </p>
        </div>
      </div>
      <ProfileGate>
        <RewardCards />
      </ProfileGate>
    </div>
  )
}
function RewardCards() {
  const { profile, token, update, refresh } = useProfile()
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const busy = useRef(false)
  const nextClaim = profile?.daily_reward.next_claim_at
  useEffect(() => {
    if (!nextClaim) return
    const delay = new Date(nextClaim).getTime() - Date.now()
    if (delay <= 0) return // A manual refresh also handles clocks with a different time.
    const timer = setTimeout(refresh, Math.min(delay + 1000, 2_147_483_647))
    return () => clearTimeout(timer)
  }, [nextClaim, refresh])
  async function claim() {
    if (!profile?.daily_reward.available || busy.current) return
    busy.current = true
    setPending(true)
    setError('')
    setMessage('')
    try {
      update(await claimDaily(token))
      setMessage('500 virtual chips added to your balance.')
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Unable to claim your daily chips.',
      )
      if (cause instanceof ApiError && [403, 409].includes(cause.status))
        refresh()
    } finally {
      busy.current = false
      setPending(false)
    }
  }
  if (!profile) return null
  const reward = profile.daily_reward
  return (
    <>
      <section className="panel reward-balance" aria-labelledby="balance-title">
        <h2 id="balance-title">Your virtual balance</h2>
        <div className="balance-row">
          <div className="virtual-chip chip-large" aria-hidden="true">
            <img src={chip60} alt="" />
            <img className="chip-inset" src={inset50} alt="" />
          </div>
          <div>
            <p className="muted">{profile.username}</p>
            <p className="balance-value">
              {profile.chip_balance.toLocaleString('en-US')}
            </p>
            <p className="field-hint">Virtual chips</p>
          </div>
          <p className="balance-help muted">
            {profile.starting_chips_granted_at
              ? 'Your 1,000 starting chips were granted once when you registered.'
              : 'This account has no recorded starting-chip grant. Daily rewards are available below.'}
          </p>
        </div>
      </section>
      <section className="panel daily-panel" aria-labelledby="daily-title">
        <div className="reward-heading">
          <h2 id="daily-title">Daily Reward - +{reward.amount} Chips</h2>
          <span className="field-hint">Resets at 00:00 UTC</span>
        </div>
        <div className="daily-reward-tile">
          <span>Today’s reward</span>
          <div className="virtual-chip chip-small" aria-hidden="true">
            <img src={chip38} alt="" />
            <img className="chip-inset" src={inset28} alt="" />
          </div>
          <strong>+{reward.amount}</strong>
          <span>
            {reward.available ? 'Ready to claim' : 'Claimed for today'}
          </span>
        </div>
        <div className="reward-actions">
          <button
            className="button primary"
            type="button"
            disabled={pending || !reward.available}
            onClick={claim}
          >
            {pending
              ? 'Claiming…'
              : reward.available
                ? 'Claim Daily Reward'
                : 'Claimed today'}
          </button>
          <p className="field-hint">
            Once per UTC calendar day. No purchase required.
          </p>
        </div>
        {reward.next_claim_at && (
          <p className="field-hint">
            Next reward:{' '}
            {new Date(reward.next_claim_at).toLocaleString(undefined, {
              timeZone: 'UTC',
            })}{' '}
            UTC
          </p>
        )}
        {message && <p role="status">{message}</p>}
        {error && (
          <p role="alert" className="field-error">
            {error}
          </p>
        )}
        <button
          className="text-button refresh-profile"
          type="button"
          disabled={pending}
          onClick={refresh}
        >
          Refresh balance
        </button>
      </section>
    </>
  )
}
