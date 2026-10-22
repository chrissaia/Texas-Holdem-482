import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import logo from '../../assets/figma/geometric-chip-mark-36.svg'
import arrowLeft from '../../assets/figma/arrow-left.svg'
import avatarSeat from '../../assets/figma/avatar-seat.svg'
import avatarActive from '../../assets/figma/avatar-seat-active.svg'
import online from '../../assets/figma/online-presence.svg'
import cardBack from '../../assets/figma/card-back-pattern.svg'
import chipBase from '../../assets/figma/chip-base-24.png'
import chipInset from '../../assets/figma/chip-inset-14.svg'
import './auth.css'

// Decorative table from the Figma "Elevated poker table" (nodes 12:409–12:556).
// Positions are the design's own coordinates inside a fixed 592×494 frame.
const seats = [
  { initials: 'MI', name: 'Mira', stack: '3,850', bet: 'Bet -', left: 35.52, top: 107.5 },
  { initials: 'TH', name: 'Theo', stack: '4,100', bet: 'Bet 200', left: 153.92, top: 12.9 },
  { initials: 'JU', name: 'Jun', stack: '2,600', bet: 'Bet -', left: 384.8, top: 12.9, dealer: true },
  { initials: 'NO', name: 'Nova', stack: '3,200', bet: 'Bet -', left: 473.2, top: 107.5 },
  { initials: 'LU', name: 'Luca', stack: '1,950', bet: 'Bet -', left: 461.76, top: 292.4 },
]
const board = [
  ['A♣', '♣'],
  ['10♦', '♦'],
  ['A♥', '♥'],
  ['7♠', '♠'],
  ['2♣', '♣'],
]

function PlayingCard({ label, suit }: { label: string; suit: string }) {
  const red = suit === '♦' || suit === '♥'
  return (
    <div className={`brand-card ${red ? 'red' : ''}`}>
      <span className="brand-card-corner">{label}</span>
      <span className="brand-card-suit">{suit}</span>
    </div>
  )
}

function HiddenCard() {
  return (
    <div className="brand-card hidden">
      <span>R</span>
      <img src={cardBack} alt="" width="21" height="16.66" />
    </div>
  )
}

function Seat({
  initials,
  name,
  stack,
  bet,
  active,
}: {
  initials: string
  name: string
  stack: string
  bet: string
  active?: boolean
}) {
  return (
    <div className={`brand-seat-identity ${active ? 'active' : ''}`}>
      <div className="brand-seat-row">
        <div className="brand-seat-avatar">
          <img src={active ? avatarActive : avatarSeat} alt="" width="25" height="25" />
          <span>{initials}</span>
          <img className="presence" src={online} alt="" width="10" height="10" />
        </div>
        <span className="brand-seat-name">{name}</span>
      </div>
      <div className="brand-seat-stack">
        <span>{stack}</span>
        <span>{bet}</span>
      </div>
      {active && <span className="brand-seat-turn">YOUR TURN · 18s</span>}
    </div>
  )
}

function PokerTableIllustration() {
  return (
    <div className="brand-table" aria-hidden="true">
      <div className="brand-table-shadow" />
      <div className="brand-table-rail" />
      <div className="brand-table-inner" />
      <div className="brand-table-felt" />
      <div className="brand-table-line" />
      <span className="brand-table-mark">RIVR</span>
      <div className="brand-pot">
        <span>POT · VIRTUAL CHIPS</span>
        <span>3,450</span>
      </div>
      <div className="brand-bet">
        <div className="brand-chip">
          <img src={chipBase} alt="" width="24" height="24" />
          <img className="inset" src={chipInset} alt="" width="14" height="14" />
          <span>100</span>
        </div>
        <span>200</span>
      </div>
      <div className="brand-board">
        <div className="brand-cards">
          {board.map(([label, suit]) => (
            <PlayingCard key={label} label={label} suit={suit} />
          ))}
        </div>
        <div className="brand-streets">
          <span>FLOP</span>
          <span>TURN</span>
          <span>RIVER</span>
        </div>
      </div>
      {seats.map(({ left, top, dealer, ...seat }) => (
        <div className="brand-seat" key={seat.name} style={{ left, top }}>
          <Seat {...seat} />
          <div className="brand-hole-cards">
            <HiddenCard />
            <HiddenCard />
          </div>
          {dealer && <span className="brand-dealer">D</span>}
        </div>
      ))}
      <div className="brand-seat you" style={{ left: 223.5, top: 313.9 }}>
        <Seat initials="RI" name="RiverJay" stack="2,400" bet="Bet 0" active />
        <div className="brand-your-cards">
          <PlayingCard label="10♠" suit="♠" />
          <PlayingCard label="K♠" suit="♠" />
        </div>
      </div>
    </div>
  )
}

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="auth-page">
      <aside className="auth-brand">
        <Link className="brand auth-logo" to="/" aria-label="RIVR home">
          <img src={logo} alt="" width="36" height="36" />
          <span>RIVR</span>
        </Link>
        <span className="auth-badge">PLAY MONEY. REAL CONNECTION.</span>
        <p className="auth-hero">
          A seat at the table.
          <br />A place to belong.
        </p>
        <p className="auth-lede">
          Texas Hold’em, without the stakes. Find your people, sharpen your
          game, and make the next hand count.
        </p>
        <PokerTableIllustration />
        <p className="auth-fine-print">
          Virtual chips only · No cash redemption · Fair play protected
        </p>
      </aside>
      <main id="main-content" className="auth-form-side">
        <Link className="auth-back" to="/">
          <img src={arrowLeft} alt="" width="16" height="16" />
          Back to RIVR
        </Link>
        {children}
        <p className="auth-fine-print">
          Terms of Service  ·  Privacy Policy  ·  Community Guidelines
        </p>
        <p className="auth-fine-print">
          Virtual chips have no real-world monetary value. They cannot be
          redeemed for cash.
        </p>
      </main>
    </div>
  )
}
