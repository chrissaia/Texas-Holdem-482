import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ApiError } from '../../api/client'
import info from '../../assets/figma/info.svg'
import zap from '../../assets/figma/zap.svg'
import { listTables } from './api'
import type { TableList } from './types'
import { SEAT_OPTIONS } from './validation'
import './lobby.css'

const format = (n: number) => n.toLocaleString('en-US')

export function LobbyPage() {
  const [params, setParams] = useSearchParams()
  const [attempt, setAttempt] = useState(0)
  const [response, setResponse] = useState<{
    key: string
    data?: TableList
    error?: string
  } | null>(null)
  const queryParams = new URLSearchParams(params)
  if (!queryParams.has('available_seats'))
    queryParams.set('available_seats', 'true')
  const query = queryParams.toString()
  const requestKey = `${query}:${attempt}`
  const state = response?.key === requestKey ? response : null
  const loading = !state
  const data = state?.data
  const error = state?.error
  const available = queryParams.get('available_seats') === 'true'
  const search = params.get('search') || ''

  useEffect(() => {
    let active = true
    listTables(query)
      .then((value) => {
        if (active) setResponse({ key: requestKey, data: value })
      })
      .catch((cause) => {
        if (!active) return
        let message = 'We could not load public tables. Please try again.'
        if (cause instanceof ApiError && cause.status === 400)
          message = 'Some lobby filters are invalid. Reset filters to continue.'
        if (cause instanceof ApiError && cause.status === 404)
          message =
            'This results page is no longer available. Reset filters to return to the first page.'
        setResponse({ key: requestKey, error: message })
      })
    return () => {
      active = false
    }
  }, [query, requestKey])

  function updateFilter(name: string, value: string) {
    setParams((current) => {
      const next = new URLSearchParams(current)
      if (value) next.set(name, value)
      else next.delete(name)
      next.delete('page')
      return next
    })
  }
  function changePage(page: number) {
    setParams((current) => {
      const next = new URLSearchParams(current)
      next.set('page', String(page))
      return next
    })
  }

  return (
    <div className="lobby-page">
      <div className="page-intro lobby-intro">
        <p className="lobby-totals">
          {data
            ? `${format(data.total_tables)} ACTIVE TABLES · ${format(data.total_players)} PLAYERS`
            : 'PUBLIC POKER TABLES'}
        </p>
        <div className="lobby-title-row">
          <h1>Find your table.</h1>
          <Link className="button primary" to="/tables/create">
            Create Table
          </Link>
        </div>
        <p>Live tables. Open seats. A game that fits your pace.</p>
      </div>
      <div className="lobby-search-controls">
        <form
          className="form-field"
          onSubmit={(event) => {
            event.preventDefault()
            updateFilter(
              'search',
              String(
                new FormData(event.currentTarget).get('search') || '',
              ).trim(),
            )
          }}
        >
          <label htmlFor="lobby-search">Search tables or hosts</label>
          <div className="lobby-search-input">
            <input
              key={search}
              id="lobby-search"
              name="search"
              type="search"
              defaultValue={search}
              maxLength={150}
              placeholder="Search live tables…"
            />
            <button className="text-button" type="submit">
              Search
            </button>
          </div>
        </form>
        <div className="form-field">
          <label htmlFor="lobby-sort">Sort by</label>
          <select
            id="lobby-sort"
            value={params.get('ordering') || 'newest'}
            onChange={(e) => updateFilter('ordering', e.target.value)}
          >
            <option value="newest">Newest first</option>
            <option value="name">Table name A–Z</option>
            <option value="buy_in">Buy-in: low to high</option>
            <option value="-buy_in">Buy-in: high to low</option>
            <option value="blinds">Blinds: low to high</option>
            <option value="players">Most players</option>
          </select>
        </div>
        <button
          className="button primary"
          type="button"
          disabled
          title="Joining is coming in a later story"
        >
          <img src={zap} alt="" />
          Quick Join
        </button>
      </div>
      <section className="panel lobby-filters" aria-labelledby="filters-title">
        <div className="panel-heading">
          <h2 id="filters-title">Table filters</h2>
          <button
            className="text-button"
            type="button"
            onClick={() => {
              setParams({})
              setAttempt((n) => n + 1)
            }}
          >
            Reset filters
          </button>
        </div>
        <div className="lobby-filter-fields">
          <div className="form-field">
            <label htmlFor="buy-in-filter">Buy-in</label>
            <select
              id="buy-in-filter"
              value={params.get('max_buy_in') || ''}
              onChange={(e) => updateFilter('max_buy_in', e.target.value)}
            >
              <option value="">Any amount</option>
              {[400, 1000, 2000, 20000].map((n) => (
                <option key={n} value={n}>
                  Up to {format(n)} chips
                </option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="blinds-filter">Blind level</label>
            <select
              id="blinds-filter"
              value={params.get('big_blind') || ''}
              onChange={(e) => updateFilter('big_blind', e.target.value)}
            >
              <option value="">All blinds</option>
              {[10, 20, 50, 100, 1000].map((n) => (
                <option key={n} value={n}>
                  {format(n / 2)} / {format(n)}
                </option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="players-filter">Table size</label>
            <select
              id="players-filter"
              value={params.get('max_players') || ''}
              onChange={(e) => updateFilter('max_players', e.target.value)}
            >
              <option value="">2–9 seats</option>
              {SEAT_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n} seats
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="lobby-toggles">
          <button
            className={`button ${available ? 'primary' : ''}`}
            type="button"
            aria-pressed={available}
            onClick={() =>
              updateFilter('available_seats', available ? 'false' : 'true')
            }
          >
            {available ? '✓ ' : ''}Available seats
          </button>
          <span className="button primary">✓ Public tables</span>
          <button
            className="button"
            type="button"
            disabled
            title="Friends are coming in a later story"
          >
            Friends playing
          </button>
          <button
            className="button"
            type="button"
            disabled
            title="Bots are coming in a later story"
          >
            Bot tables
          </button>
        </div>
      </section>
      <section
        className="panel lobby-browser"
        aria-label="Public table results"
        aria-busy={loading}
      >
        {loading ? (
          <div className="lobby-empty" role="status">
            Loading public tables…
          </div>
        ) : error ? (
          <div className="lobby-empty">
            <p role="alert">{error}</p>
            <button
              className="button"
              type="button"
              onClick={() => setAttempt((n) => n + 1)}
            >
              Try again
            </button>
          </div>
        ) : (
          data && (
            <>
              {data.results.length === 0 ? (
                <div className="lobby-empty" role="status">
                  <h2>
                    {data.total_tables === 0
                      ? 'The next poker night starts with you.'
                      : 'No tables match your filters.'}
                  </h2>
                  <p className="muted">
                    {data.total_tables === 0
                      ? 'There are no public tables yet. Create the first one.'
                      : 'Try another search, a higher buy-in, or include full tables.'}
                  </p>
                  {data.total_tables === 0 && (
                    <Link className="button primary" to="/tables/create">
                      Create the first table
                    </Link>
                  )}
                </div>
              ) : (
                <div
                  className="lobby-table-scroll"
                  role="region"
                  aria-label="Public poker tables"
                  tabIndex={0}
                >
                  <table className="lobby-table">
                    <caption className="sr-only">
                      Public Texas Hold’em tables and their current settings
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col">Table</th>
                        <th scope="col">Host</th>
                        <th scope="col">SB / BB</th>
                        <th scope="col">Buy-in</th>
                        <th scope="col">Min. balance</th>
                        <th scope="col">Players</th>
                        <th scope="col">Size</th>
                        <th scope="col">Status</th>
                        <th scope="col">
                          <span className="sr-only">Action</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.results.map((table) => (
                        <tr key={table.id}>
                          <th scope="row">
                            <Link to={`/tables/${table.id}`}>{table.name}</Link>
                          </th>
                          <td>{table.host.username}</td>
                          <td className="numeric">
                            {format(table.small_blind)} /{' '}
                            {format(table.big_blind)}
                          </td>
                          <td className="numeric">{format(table.buy_in)}</td>
                          <td className="numeric">
                            {format(table.minimum_balance)}
                          </td>
                          <td className="numeric">
                            {table.player_count} / {table.max_players}
                          </td>
                          <td className="numeric">{table.max_players}</td>
                          <td>
                            <span
                              className={`table-status ${table.player_count >= table.max_players ? 'full' : table.status === 'playing' ? 'playing' : 'available'}`}
                            >
                              {table.player_count >= table.max_players
                                ? 'Full'
                                : table.status === 'playing'
                                  ? 'Playing'
                                  : 'Available'}
                            </span>
                          </td>
                          <td>
                            <Link
                              className="button primary table-action"
                              aria-label={`View ${table.name}`}
                              to={`/tables/${table.id}`}
                            >
                              View Table →
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="lobby-browser-footer">
                <p role="status">
                  {data.count
                    ? `Showing ${(data.page - 1) * data.page_size + 1}–${Math.min(data.page * data.page_size, data.count)} of ${format(data.count)} matching tables`
                    : '0 matching tables'}
                  <span className="mobile-scroll-hint">
                    {' '}
                    · Scroll across for all settings
                  </span>
                </p>
                <nav className="lobby-pagination" aria-label="Results pages">
                  <button
                    type="button"
                    className="text-button"
                    disabled={!data.previous}
                    onClick={() => changePage(data.page - 1)}
                  >
                    Previous
                  </button>
                  <span>
                    Page {data.page} of {data.total_pages}
                  </span>
                  <button
                    type="button"
                    className="text-button"
                    disabled={!data.next}
                    onClick={() => changePage(data.page + 1)}
                  >
                    Next
                  </button>
                </nav>
              </div>
            </>
          )
        )}
      </section>
      <div className="lobby-footer">
        <div className="notice lobby-notice">
          <img src={info} alt="" />
          <div>
            <strong>All stakes use virtual chips.</strong>
            <p>
              Open a table to review its settings. Joining and gameplay will be
              available in a future update.
            </p>
          </div>
        </div>
        <button
          className="button"
          type="button"
          disabled={loading}
          onClick={() => setAttempt((n) => n + 1)}
        >
          Refresh tables
        </button>
      </div>
    </div>
  )
}
