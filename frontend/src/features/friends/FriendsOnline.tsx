/**
 * Module: friends/FriendsOnline.tsx.
 * S20: "N friends online" in the top bar. Polling it also keeps the signed-in player online
 * for their friends, on every page.
 */
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getOnlineCount } from './api'

export const ONLINE_POLL_MS = 30_000

export function FriendsOnline() {
  const [count, setCount] = useState<number | null>(null)
  useEffect(() => {
    let active = true
    const load = () => {
      getOnlineCount()
        .then(({ online_count }) => { if (active) setCount(online_count) })
        .catch(() => { if (active) setCount(null) })
    }
    load()
    const timer = window.setInterval(load, ONLINE_POLL_MS)
    return () => { active = false; window.clearInterval(timer) }
  }, [])
  if (count === null) return null
  return (
    <Link className="friends-online-link" to="/friends">
      {count} {count === 1 ? 'friend' : 'friends'} online
    </Link>
  )
}
