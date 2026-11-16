import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getGame, submitGameAction, submitGameTimeout } from './api'
import type { ActivePokerGame, GamePlayer, GameState } from './types'
import './game.css'

const SUITS: Record<string, { symbol: string; name: string; red: boolean }> = {
  s: { symbol: '♠', name: 'spades', red: false },
  h: { symbol: '♥', name: 'hearts', red: true },
  d: { symbol: '♦', name: 'diamonds', red: true },
  c: { symbol: '♣', name: 'clubs', red: false },
}

const RANKS: Record<string, string> = { T: '10' }

function PlayingCard({ code, hidden = false }: { code?: string; hidden?: boolean }) {
  if (hidden || !code) return <span className="game-card face-down" aria-label="Hidden card" />
  const suit = SUITS[code[1]]
  if (!suit) throw new Error('The game returned an invalid card.')
  const rank = RANKS[code[0]] ?? code[0]
  return (
    <span className={`game-card${suit.red ? ' red-suit' : ''}`} aria-label={`${rank} of ${suit.name}`}>
      <span>{rank}</span>
      <span aria-hidden="true">{suit.symbol}</span>
    </span>
  )
}

function PlayerSeat({ player, viewerId, cards = true }: {
  player: GamePlayer
  viewerId: number
  cards?: boolean
}) {
  const privateView = player.user_id === viewerId
  return (
    <article className={`game-player${player.is_turn ? ' active-turn' : ''}${player.folded ? ' folded' : ''}`}>
      <div className="player-identity">
        <span className="player-avatar" aria-hidden="true">{player.username.slice(0, 1).toUpperCase()}</span>
        <div>
          <strong>{player.username}{privateView ? ' (You)' : ''}</strong>
          <span>{player.is_dealer ? 'Dealer' : player.all_in ? 'All-in' : player.folded ? 'Folded' : 'In hand'}</span>
        </div>
      </div>
      <div className="player-stack">
        <span>{player.stack.toLocaleString('en-US')} chips</span>
        {player.round_bet > 0 && <span>Bet {player.round_bet.toLocaleString('en-US')}</span>}
      </div>
      {cards && (
        <div className="player-cards" aria-label={`${player.username}'s cards`}>
          {(player.hole_cards ?? [undefined, undefined]).map((card, index) => (
            <PlayingCard key={`${player.user_id}-${index}`} code={card} hidden={!card} />
          ))}
        </div>
      )}
      {player.is_turn && <span className="turn-indicator">YOUR TURN</span>}
    </article>
  )
}

function PlayerFromSeat(player: GameState['seated_players'][number]): GamePlayer {
  return {
    ...player,
    round_bet: 0,
    folded: false,
    all_in: false,
    is_dealer: false,
    is_turn: false,
    hole_cards: null,
    hand: null,
    waiting: false,
  }
}

function PokerTableView({ state, game }: { state: GameState; game: ActivePokerGame | null }) {
  const players = game?.players ?? state.seated_players.map(PlayerFromSeat)
  const viewerId = state.viewer_id
  return (
    <section className="poker-table panel" aria-label="Poker table">
      <div className="table-rim">
        <div className="table-felt">
          <div className="table-player-row">
            {players.slice(0, 3).map(player => (
              <PlayerSeat key={player.user_id} player={player} viewerId={viewerId} cards={Boolean(game)} />
            ))}
          </div>
          <div className="board-center">
            <span className="board-caption">{game ? `HAND ${game.number} · ${game.street.toUpperCase()}` : 'WAITING FOR PLAYERS'}</span>
            <div className="community-cards" aria-label="Community cards">
              {Array.from({ length: 5 }, (_, index) => (
                <PlayingCard key={index} code={game?.board[index]} hidden={!game?.board[index]} />
              ))}
            </div>
            {game ? (
              <div className="pot-display">
                <span>POT</span>
                <strong>{game.pot.toLocaleString('en-US')}</strong>
                <span>chips</span>
              </div>
            ) : (
              <p className="table-waiting-copy">Hands start automatically when two funded players are seated.</p>
            )}
          </div>
          <div className="table-player-row lower-row">
            {players.slice(3).map(player => (
              <PlayerSeat key={player.user_id} player={player} viewerId={viewerId} cards={Boolean(game)} />
            ))}
          </div>
        </div>
      </div>
      {game?.waiting_players.length ? (
        <p className="waiting-player-note">Waiting for next hand: {game.waiting_players.map(player => player.username).join(', ')}</p>
      ) : null}
    </section>
  )
}

function MyHandPanel({ game, viewerId }: { game: ActivePokerGame | null; viewerId: number }) {
  const viewer = game?.viewer
  const player = game?.players.find(candidate => candidate.user_id === viewerId)

  return (
    <section className="panel my-hand-panel" aria-label="Your poker hand">
      <div>
        <span className="eyebrow">PRIVATE TO YOU</span>
        <h2>Your hand</h2>
      </div>
      {!game ? (
        <p className="muted">Your private cards will appear when the next hand is dealt.</p>
      ) : !viewer?.hole_cards ? (
        <p className="muted">You joined during this hand. Your private cards will be dealt next hand.</p>
      ) : (
        <>
          <div className="my-hole-cards" aria-label="Your private cards">
            {viewer.hole_cards.map((card, index) => (
              <PlayingCard key={`${card}-${index}`} code={card} />
            ))}
          </div>
          <div className="my-hand-strength" aria-live="polite">
            <span>{game.board.length >= 5 ? 'Your final hand' : 'Best hand so far'}</span>
            <strong>{viewer.hand ?? 'Not ranked yet'}</strong>
            <p>
              {player?.folded
                ? 'You folded this hand; your cards stay private to you.'
                : game.board.length < 3
                  ? 'Your hand can be ranked after the flop is dealt.'
                  : game.board.length < 5
                    ? 'This may improve as more community cards are dealt.'
                    : 'This is your best five-card hand at showdown.'}
            </p>
          </div>
        </>
      )}
    </section>
  )
}

function GameControls({ state, onAction, pending, secondsLeft }: {
  state: GameState
  onAction: (action: 'fold' | 'check' | 'call' | 'raise' | 'all_in', raiseTo?: number) => void
  pending: boolean
  secondsLeft: number | null
}) {
  const game = state.game
  const legal = game?.viewer.legal_actions
  const [raiseSelection, setRaiseSelection] = useState<{ key: string; value: number } | null>(null)

  if (!game || !legal) return null
  const raiseKey = `${game.id}:${game.current_bet}:${legal.min_raise_to}:${legal.max_raise_to}`
  const raiseTo = raiseSelection?.key === raiseKey ? raiseSelection.value : legal.min_raise_to
  const chooseRaise = (value: number) => setRaiseSelection({ key: raiseKey, value })
  const potAfterCall = game.pot + legal.amount_to_call
  const potRaise = Math.min(legal.max_raise_to, Math.max(legal.min_raise_to, game.current_bet + potAfterCall))
  const halfPotRaise = Math.min(legal.max_raise_to, Math.max(legal.min_raise_to, game.current_bet + Math.ceil(potAfterCall / 2)))
  const isTurn = game.turn_user_id === game.viewer.user_id
  const me = game.players.find(player => player.user_id === game.viewer.user_id)
  const canAct = legal.fold || legal.check || legal.call || legal.raise || legal.all_in

  return (
    <section className="game-controls panel" aria-label="Betting controls">
      <div className="controls-heading">
        <div>
          <span className="eyebrow">YOUR MOVE</span>
          <h2>{!me ? 'Waiting for next hand' : me.folded ? 'You folded this hand' : me.all_in ? 'You are all-in' : isTurn ? 'Choose an action' : 'Waiting for your turn'}</h2>
        </div>
        <div className="turn-clock" role="status" aria-live="polite">
          <span>{secondsLeft ?? 30} SEC</span>
          <strong>{game.turn_deadline ? 'Time remaining' : 'No active turn'}</strong>
        </div>
      </div>
      <p className="field-hint">
        {isTurn
          ? legal.amount_to_call > 0
            ? `Call ${legal.amount_to_call.toLocaleString('en-US')} chips or fold.`
            : 'No bet to match; check or bet.'
          : !me
            ? 'You joined during this hand and will be dealt into the next one.'
            : me.folded
              ? 'Your cards are folded; wait for the next hand.'
              : me.all_in
                ? 'Your chips are committed; the remaining board will be dealt automatically.'
                : `Current bet: ${game.current_bet.toLocaleString('en-US')} chips`}
      </p>
      {isTurn && canAct ? (
        <>
          <div className="action-buttons">
            {legal.fold && <button className="button" disabled={pending} onClick={() => onAction('fold')}>Fold</button>}
            {legal.check && <button className="button" disabled={pending} onClick={() => onAction('check')}>Check</button>}
            {legal.call && <button className="button" disabled={pending} onClick={() => onAction('call')}>Call {legal.amount_to_call.toLocaleString('en-US')}</button>}
            {legal.all_in && <button className="button all-in-button" disabled={pending} onClick={() => onAction('all_in')}>All-in</button>}
          </div>
          {legal.raise && (
            <div className="raise-controls">
              <label htmlFor="raise-to">Raise to <strong>{raiseTo.toLocaleString('en-US')}</strong> chips</label>
              <input
                id="raise-to"
                type="range"
                min={legal.min_raise_to}
                max={legal.max_raise_to}
                step="1"
                value={Math.min(legal.max_raise_to, Math.max(legal.min_raise_to, raiseTo))}
                onChange={event => chooseRaise(Number(event.target.value))}
              />
              <div className="raise-presets" aria-label="Raise sizing shortcuts">
                <button type="button" className="text-button" onClick={() => chooseRaise(legal.min_raise_to)}>Min</button>
                <button type="button" className="text-button" onClick={() => chooseRaise(halfPotRaise)}>½ pot</button>
                <button type="button" className="text-button" onClick={() => chooseRaise(potRaise)}>Pot</button>
                <button type="button" className="text-button" onClick={() => chooseRaise(legal.max_raise_to)}>Max</button>
              </div>
              <button className="button primary full-width" disabled={pending} onClick={() => onAction('raise', raiseTo)}>Raise to {raiseTo.toLocaleString('en-US')}</button>
            </div>
          )}
        </>
      ) : (
        <p className="notice">
          {!me
            ? 'You joined during this hand and will be dealt into the next one.'
            : me.folded
              ? 'You folded this hand and can wait for the next deal.'
              : me.all_in
                ? 'The hand will continue without further action from you.'
                : `Waiting for ${game.players.find(player => player.user_id === game.turn_user_id)?.username ?? 'another player'} to act.`}
        </p>
      )}
    </section>
  )
}

export function GamePage() {
  const { id = '' } = useParams()
  const [state, setState] = useState<GameState | null>(null)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [loadedAttempt, setLoadedAttempt] = useState(-1)
  const [clock, setClock] = useState<{ deadline: string; seconds: number } | null>(null)

  useEffect(() => {
    let active = true
    getGame(id)
      .then(value => {
        if (active) {
          setState(value)
          setError('')
          if (value.game?.turn_deadline) {
            setClock({
              deadline: value.game.turn_deadline,
              seconds: Math.max(0, Math.ceil((Date.parse(value.game.turn_deadline) - Date.now()) / 1000)),
            })
          }
        }
      })
      .catch(reason => {
        if (active) {
          setState(null)
          setError(reason instanceof Error ? reason.message : 'The poker table could not be loaded.')
        }
      })
      .finally(() => {
        if (active) setLoadedAttempt(attempt)
      })
    return () => { active = false }
  }, [id, attempt])

  const deadline = state?.game?.turn_deadline
  const csrfToken = state?.csrf_token
  useEffect(() => {
    if (!deadline || !csrfToken) return
    const expiresAt = Date.parse(deadline)
    const updateClock = () => setClock({ deadline, seconds: Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000)) })
    const interval = window.setInterval(updateClock, 1000)
    const timeout = window.setTimeout(() => {
      submitGameTimeout(id, csrfToken)
        .then(value => {
          setState(value)
          if (value.game?.turn_deadline) {
            setClock({
              deadline: value.game.turn_deadline,
              seconds: Math.max(0, Math.ceil((Date.parse(value.game.turn_deadline) - Date.now()) / 1000)),
            })
          }
        })
        .catch(reason => setError(reason instanceof Error ? reason.message : 'The turn timeout could not be processed.'))
    }, Math.max(0, expiresAt - Date.now()))
    return () => {
      window.clearInterval(interval)
      window.clearTimeout(timeout)
    }
  }, [deadline, id, csrfToken])

  const loading = loadedAttempt !== attempt
  const secondsLeft = deadline
    ? clock?.deadline === deadline
      ? clock.seconds
      : 30
    : null

  const refresh = () => {
    setError('')
    setAttempt(value => value + 1)
  }

  const act = async (action: 'fold' | 'check' | 'call' | 'raise' | 'all_in', raiseTo?: number) => {
    if (!state || pending) return
    setPending(true)
    setError('')
    try {
      const value = await submitGameAction(id, action, state.csrf_token, raiseTo)
      setState(value)
      if (value.game?.turn_deadline) {
        setClock({
          deadline: value.game.turn_deadline,
          seconds: Math.max(0, Math.ceil((Date.parse(value.game.turn_deadline) - Date.now()) / 1000)),
        })
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Your action could not be saved.')
      setAttempt(value => value + 1)
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="game-page">
      <Link className="back-link" to={`/tables/${id}`}>← Back to table details</Link>
      {loading && !state ? <p role="status">Loading poker table…</p> : error && !state ? (
        <section className="panel game-error" role="alert">
          <h1>Table unavailable</h1>
          <p>{error}</p>
          <p>Sign in with a registered account and join this table before playing.</p>
          <div className="game-error-links">
            <Link className="button primary" to="/login">Sign in</Link>
            <Link className="button" to={`/tables/${id}`}>Table details</Link>
          </div>
        </section>
      ) : state ? (
        <>
          <header className="game-header">
            <div>
              <span className="eyebrow">RIVR · TEXAS HOLD’EM</span>
              <h1>{state.table.name}</h1>
              <p className="muted">{state.table.small_blind} / {state.table.big_blind} blinds · {state.table.player_count}/{state.table.max_players} players</p>
            </div>
            <button className="button" disabled={pending || loading} onClick={refresh}>Refresh table</button>
          </header>
          {error && <p className="notice error-notice" role="alert">{error}</p>}
          <div className="game-layout">
            <div className="game-main-column">
              <PokerTableView state={state} game={state.game} />
              {state.game && (
                <GameControls
                  state={state}
                  pending={pending}
                  secondsLeft={secondsLeft}
                  onAction={(action, amount) => void act(action, amount)}
                />
              )}
              {state.game?.turn_deadline && (
                <p className="timer-message" role="status">
                  {secondsLeft === null ? 'Turn timer active' : secondsLeft > 0 ? `${secondsLeft} seconds remaining` : 'Turn expired; checking or folding automatically.'}
                </p>
              )}
            </div>
            <aside className="game-side-column">
              <MyHandPanel game={state.game} viewerId={state.viewer_id} />
              <section className="panel game-side-panel">
                <div className="panel-heading"><h2>Last hand</h2><span className="eyebrow">{state.last_hand ? `#${state.last_hand.number}` : '—'}</span></div>
                {state.last_hand ? (
                  <>
                    <p className="last-pot">{state.last_hand.pot.toLocaleString('en-US')} <span>chips</span></p>
                    <div className="last-winners">
                      {state.last_hand.winners.map(winner => (
                        <p key={winner.user_id}><strong>{winner.username}</strong><span>+{winner.amount.toLocaleString('en-US')}</span></p>
                      ))}
                    </div>
                    <div className="community-cards small-cards">
                      {state.last_hand.board.map((card, index) => <PlayingCard key={`${card}-${index}`} code={card} />)}
                    </div>
                  </>
                ) : <p className="muted">Completed hand results will appear here.</p>}
              </section>
              <section className="panel game-side-panel">
                <div className="panel-heading"><h2>Hand guide</h2><Link to="/tutorial">Full rules</Link></div>
                <ol className="hand-guide">
                  {['Royal Flush', 'Straight Flush', 'Four of a Kind', 'Full House', 'Flush', 'Straight', 'Three of a Kind', 'Two Pair', 'One Pair', 'High Card'].map((hand, index) => (
                    <li key={hand}><span>{index + 1}</span>{hand}</li>
                  ))}
                </ol>
              </section>
              {state.game && (
                <section className="panel game-side-panel">
                  <h2>Hand actions</h2>
                  <ol className="action-history">
                    {state.game.actions.slice(-8).reverse().map((action, index) => (
                      <li key={`${action.username}-${action.kind}-${index}`}>
                        <span>{action.username}</span>
                        <strong>{action.kind}{action.amount ? ` · ${action.amount.toLocaleString('en-US')}` : ''}</strong>
                      </li>
                    ))}
                    {!state.game.actions.length && <li className="muted">Blinds have been posted.</li>}
                  </ol>
                </section>
              )}
            </aside>
          </div>
        </>
      ) : null}
    </div>
  )
}
