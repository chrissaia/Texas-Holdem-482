import { useProfile } from '../features/profile/context'
import type { ProfileSummary } from '../features/profile/types'
import '../features/profile/profile.css'
import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import type { Host } from '../features/tables/types'
import logo from '../assets/figma/geometric-chip-mark.svg'
import house from '../assets/figma/house.svg'
import spade from '../assets/figma/spade.svg'
import grid from '../assets/figma/layout-grid.svg'
import users from '../assets/figma/users.svg'
import message from '../assets/figma/message-circle.svg'
import trophy from '../assets/figma/trophy.svg'
import chart from '../assets/figma/chart-no-axes-combined.svg'
import award from '../assets/figma/award.svg'
import book from '../assets/figma/book-open.svg'
import chips from '../assets/figma/circle-plus.svg'
import settings from '../assets/figma/settings.svg'
import avatar from '../assets/figma/avatar-surface.svg'
import avatarSmall from '../assets/figma/avatar-surface1.svg'
import online from '../assets/figma/online-presence.svg'
import search from '../assets/figma/search.svg'
import bell from '../assets/figma/bell.svg'
import chevron from '../assets/figma/chevron-down.svg'

const navigation = [
  ['Play Poker', spade],
  ['Lobby', grid],
  ['Friends', users],
  ['Messages', message],
  ['Leaderboard', trophy],
  ['Statistics', chart],
  ['Achievements', award],
  ['Tutorial', book],
  ['Store / Get Chips', chips],
  ['Settings', settings],
]

export function AppLayout({
  host,
  summary,
  children,
}: {
  host: Host | null
  summary?: ProfileSummary | null
  children: ReactNode
}) {
  const { pathname } = useLocation()
  const { profile } = useProfile()
  const account = profile || summary
  const initials = host?.username.slice(0, 2).toUpperCase() || '-'
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <aside className="sidebar">
        <Link className="brand" to="/" aria-label="RIVR home">
          <img src={logo} alt="" />
          <span>RIVR</span>
        </Link>
        <nav className="primary-nav" aria-label="Main navigation">
          <Link
            to="/"
            className={`nav-item ${pathname === '/' ? 'active' : ''}`}
          >
            <img src={house} alt="" />
            Home
          </Link>
          {navigation.map(([label, icon]) =>
            label === 'Lobby' ||
            label === 'Settings' ||
            label === 'Store / Get Chips' ? (
              <Link
                key={label}
                to={
                  label === 'Store / Get Chips'
                    ? '/rewards'
                    : label === 'Settings'
                      ? '/settings'
                      : '/lobby'
                }
                className={`nav-item ${(label === 'Store / Get Chips' ? pathname === '/rewards' : label === 'Settings' ? pathname === '/settings' : pathname === '/lobby' || pathname.startsWith('/tables')) ? 'active' : ''}`}
                aria-current={
                  pathname ===
                  (label === 'Store / Get Chips'
                    ? '/rewards'
                    : label === 'Settings'
                      ? '/settings'
                      : '/lobby')
                    ? 'page'
                    : undefined
                }
              >
                <img src={icon} alt="" />
                {label}
              </Link>
            ) : (
              <span
                key={label}
                className={`nav-item unavailable ${label === 'Lobby' && pathname.startsWith('/tables') ? 'active' : ''}`}
                aria-disabled="true"
                title="Coming in a later story"
              >
                <img src={icon} alt="" />
                {label}
              </span>
            ),
          )}
        </nav>
        <div className="sidebar-note">
          <span className="eyebrow">PLAY MONEY ONLY</span>
          <p>All stakes use virtual chips.</p>
        </div>
        <div className="account-summary">
          <div className="avatar avatar-large">
            <img
              src={account?.avatar_url || avatar}
              alt=""
              className={
                account?.avatar_url ? 'shell-uploaded-avatar' : undefined
              }
            />
            {!account?.avatar_url && <span>{initials}</span>}
            {host && <img className="presence" src={online} alt="Signed in" />}
          </div>
          {host && account && (
            <Link className="shell-balance" to="/rewards">
              {account.chip_balance.toLocaleString('en-US')} virtual chips
            </Link>
          )}
          <p>{host?.username || 'Not signed in'}</p>
          {host ? (
            <span className="muted">Registered player</span>
          ) : (
            <Link className="muted" to="/login">
              Sign in to host a table
            </Link>
          )}
        </div>
      </aside>
      <div className="app-body">
        <header className="topbar">
          <div className="global-search" aria-disabled="true">
            <img src={search} alt="" />
            <span>Search players, tables…</span>
            <span className="shortcut">⌘ K</span>
          </div>
          <div className="account-controls">
            <Link className="mobile-lobby-link" to="/lobby">
              Lobby
            </Link>
            <Link className="mobile-settings-link" to="/rewards">
              Chips
            </Link>
            <Link className="mobile-settings-link" to="/settings">
              Settings
            </Link>
            <span className="unavailable" title="Notifications coming later">
              <img src={bell} alt="Notifications unavailable" />
            </span>
            {host && account && (
              <Link className="shell-balance" to="/rewards">
                {account.chip_balance.toLocaleString('en-US')} chips
              </Link>
            )}
            <span className="account-label">
              {host?.username || 'Welcome to RIVR'}
            </span>
            <div className="avatar avatar-small">
              <img
                src={account?.avatar_url || avatarSmall}
                alt=""
                className={
                  account?.avatar_url ? 'shell-uploaded-avatar' : undefined
                }
              />
              {!account?.avatar_url && <span>{initials}</span>}
            </div>
            <img src={chevron} alt="" />
          </div>
        </header>
        <main id="main-content" className="page-content">
          {children}
        </main>
      </div>
    </div>
  )
}
