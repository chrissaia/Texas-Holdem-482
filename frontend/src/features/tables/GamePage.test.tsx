import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, expect, test, vi } from 'vitest'
import { GamePage } from './GamePage'
import { HINTS_STORAGE_KEY } from './hintsPreference'

const response = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status })

const sockets: MockWebSocket[] = []

class MockWebSocket {
  onopen: ((event: Event) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  onclose: ((event: CloseEvent) => void) | null = null
  readonly url: string

  constructor(url: string) {
    this.url = url
    sockets.push(this)
    queueMicrotask(() => this.onopen?.(new Event('open')))
  }

  close() {
    this.onclose?.(new CloseEvent('close'))
  }

  send() {}

  notify() {
    this.onmessage?.(new MessageEvent('message', { data: '{"type":"game.updated"}' }))
  }
}

const state = {
  viewer_id: 10,
  table: {
    id: 1,
    name: 'Riverside table',
    is_public: true,
    status: 'playing',
    max_players: 6,
    player_count: 2,
    small_blind: 5,
    big_blind: 10,
  },
  game: {
    id: 4,
    number: 4,
    street: 'preflop',
    board: [],
    pot: 15,
    current_bet: 10,
    min_raise: 10,
    dealer_user_id: 10,
    turn_user_id: 10,
    turn_started_at: null,
    turn_deadline: null,
    players: [
      {
        user_id: 10,
        username: 'Player One',
        stack: 95,
        round_bet: 5,
        folded: false,
        all_in: false,
        is_dealer: true,
        is_turn: true,
        hole_cards: ['As', 'Kh'],
        hand: null,
        waiting: false,
      },
      {
        user_id: 20,
        username: 'Player Two',
        stack: 90,
        round_bet: 10,
        folded: false,
        all_in: false,
        is_dealer: false,
        is_turn: false,
        hole_cards: null,
        hand: null,
        waiting: false,
      },
    ],
    waiting_players: [],
    viewer: {
      user_id: 10,
      hole_cards: ['As', 'Kh'],
      hand: null,
      legal_actions: {
        fold: true,
        check: false,
        call: true,
        raise: true,
        all_in: true,
        amount_to_call: 5,
        min_raise_to: 20,
        max_raise_to: 100,
      },
    },
    actions: [],
  },
  last_hand: null,
  seated_players: [
    { user_id: 10, username: 'Player One', stack: 95 },
    { user_id: 20, username: 'Player Two', stack: 90 },
  ],
  csrf_token: 'game-csrf-token',
}

afterEach(() => {
  localStorage.removeItem(HINTS_STORAGE_KEY)
  vi.unstubAllGlobals()
  vi.clearAllMocks()
  sockets.length = 0
})

function renderGame() {
  return render(
    <MemoryRouter initialEntries={['/tables/1/play']}>
      <Routes>
        <Route path="/tables/:id/play" element={<GamePage />} />
      </Routes>
    </MemoryRouter>,
  )
}

test('shows the active game, identifies the viewer, and hides opponent cards', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(state)))
  renderGame()

  expect(await screen.findByRole('heading', { name: 'Riverside table' })).toBeVisible()
  expect(screen.getByText('Player One (You)')).toBeVisible()
  expect(screen.getByText('Player Two')).toBeVisible()
  expect(screen.getAllByLabelText('Hidden card').length).toBeGreaterThan(0)
  expect(screen.getByRole('region', { name: 'Your poker hand' })).toHaveTextContent('Not ranked yet')
  expect(screen.getByLabelText('Your private cards')).toBeVisible()
  expect(screen.getByRole('button', { name: 'Call 5' })).toBeEnabled()
  expect(screen.getByRole('button', { name: 'All-in' })).toBeEnabled()
})

test('shows the server-evaluated best hand after the flop', async () => {
  const flopState = {
    ...state,
    game: {
      ...state.game,
      street: 'flop',
      board: ['2d', '3c', '4h'],
      viewer: { ...state.game.viewer, hand: 'One Pair - Aces' },
    },
  }
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(flopState)))
  renderGame()

  expect(await screen.findByText('One Pair - Aces')).toBeVisible()
  expect(screen.getByText('This may improve as more community cards are dealt.')).toBeVisible()
})

test('explains that a player who joins mid-hand receives cards next hand', async () => {
  const waitingState = {
    ...state,
    game: {
      ...state.game,
      players: state.game.players.filter(player => player.user_id !== state.viewer_id),
      waiting_players: [{ user_id: state.viewer_id, username: 'Player One', stack: 95, waiting: true as const }],
      viewer: { ...state.game.viewer, hole_cards: null, hand: null },
    },
  }
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(waitingState)))
  renderGame()

  expect(await screen.findByText(/You joined during this hand/)).toBeVisible()
})

test('sends an action with the private CSRF token and server route', async () => {
  const fetch = vi.fn()
    .mockResolvedValueOnce(response(state))
    .mockResolvedValueOnce(response({ ...state, game: { ...state.game, turn_user_id: 20 } }))
  vi.stubGlobal('fetch', fetch)
  renderGame()

  fireEvent.click(await screen.findByRole('button', { name: 'Call 5' }))

  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))
  expect(fetch.mock.calls[1][0]).toBe('/api/tables/1/game/action/')
  expect(fetch.mock.calls[1][1]).toMatchObject({
    method: 'POST',
    headers: { 'X-CSRFToken': 'game-csrf-token' },
    body: JSON.stringify({ action: 'call' }),
  })
})

test('refreshes the private game state when another player changes the game', async () => {
  const updatedState = {
    ...state,
    game: { ...state.game, pot: 25, turn_user_id: 20 },
  }
  const fetch = vi.fn()
    .mockResolvedValueOnce(response(state))
    .mockResolvedValueOnce(response(updatedState))
  vi.stubGlobal('fetch', fetch)
  vi.stubGlobal('WebSocket', MockWebSocket)
  renderGame()

  expect(await screen.findByText('Live updates on')).toBeVisible()
  expect(sockets[0].url).toBe('ws://localhost:3000/ws/tables/1/game/')
  sockets[0].notify()

  expect(await screen.findByText('25')).toBeVisible()
  expect(fetch).toHaveBeenCalledTimes(2)
})

test('failed table access explains that sign-in and a seat are required', async () => {
  vi.stubGlobal('WebSocket', MockWebSocket)
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ detail: 'Sign in with an active registered account to play.' }, 403)))
  renderGame()

  expect(await screen.findByRole('heading', { name: 'Table unavailable' })).toBeVisible()
  expect(screen.getByText(/Return to table details and select Join table/)).toBeVisible()
  expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login')
  expect(screen.getByRole('link', { name: 'Table details' })).toHaveAttribute('href', '/tables/1')
  expect(sockets).toHaveLength(0)
})

test('hints can be turned off without disabling moves and the choice survives a reload', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => response(state)))
  const first = renderGame()
  const toggle = await screen.findByRole('button', { name: 'Hints', pressed: true })
  expect(screen.getByRole('region', { name: 'Action hints' })).toHaveTextContent('Match the bet by adding 5 chips.')
  fireEvent.click(toggle)
  expect(screen.queryByRole('region', { name: 'Action hints' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Call 5' })).toBeEnabled()
  first.unmount()
  renderGame()
  fireEvent.click(await screen.findByRole('button', { name: 'Hints', pressed: false }))
  expect(screen.getByRole('region', { name: 'Action hints' })).toBeVisible()
})

test('live state replaces old hints and hides them when the other player acts', async () => {
  const changed = {
    ...state,
    game: {
      ...state.game,
      viewer: { ...state.game.viewer, legal_actions: {
        ...state.game.viewer.legal_actions,
        check: true, call: false, raise: false, all_in: false, amount_to_call: 0,
      } },
    },
  }
  vi.stubGlobal('fetch', vi.fn()
    .mockResolvedValueOnce(response(state))
    .mockResolvedValueOnce(response(changed))
    .mockResolvedValueOnce(response({ ...changed, game: { ...changed.game, turn_user_id: 20 } })))
  vi.stubGlobal('WebSocket', MockWebSocket)
  renderGame()
  expect(await screen.findByText('Live updates on')).toBeVisible()
  expect(screen.getByRole('region', { name: 'Action hints' })).toHaveTextContent('adding 5 chips')
  sockets[0].notify()
  expect(await screen.findByText('Stay in the hand without adding chips.')).toBeVisible()
  expect(screen.getByRole('region', { name: 'Action hints' })).not.toHaveTextContent('Raise.')
  expect(screen.getByRole('region', { name: 'Action hints' })).not.toHaveTextContent('Call.')
  sockets[0].notify()
  await screen.findByRole('heading', { name: 'Waiting for your turn' })
  expect(screen.queryByRole('region', { name: 'Action hints' })).not.toBeInTheDocument()
})

test('a short-stacked call hint explains the actual amount at stake', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => response({
    ...state,
    game: { ...state.game, players: [{ ...state.game.players[0], stack: 3 }, state.game.players[1]] },
  })))
  renderGame()
  expect(await screen.findByRole('region', { name: 'Action hints' })).toHaveTextContent('Put in your remaining 3 chips to call all-in.')
})

test('the toggle remains usable when browser storage is blocked', async () => {
  const storage = {
    getItem: () => { throw new Error('Storage blocked') },
    setItem: () => { throw new Error('Storage blocked') },
    removeItem: () => {},
  }
  vi.stubGlobal('localStorage', storage)
  vi.stubGlobal('fetch', vi.fn(async () => response(state)))
  renderGame()
  fireEvent.click(await screen.findByRole('button', { name: 'Hints', pressed: true }))
  expect(screen.getByRole('button', { name: 'Hints', pressed: false })).toBeVisible()
  expect(screen.queryByRole('region', { name: 'Action hints' })).not.toBeInTheDocument()
})

test('a single legal raise size is explained as one total', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => response({
    ...state,
    game: {
      ...state.game,
      viewer: { ...state.game.viewer, legal_actions: {
        ...state.game.viewer.legal_actions, min_raise_to: 20, max_raise_to: 20,
      } },
    },
  })))
  renderGame()
  expect(await screen.findByRole('region', { name: 'Action hints' }))
    .toHaveTextContent('Raise your total bet this round to 20 chips.')
})
