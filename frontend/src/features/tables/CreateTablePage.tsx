import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ApiError } from '../../api/client'
import { FormField } from '../../components/FormField'
import check from '../../assets/figma/circle-check.svg'
import { createTable } from './api'
import type {
  CreationContext,
  FieldErrors,
  PokerTable,
  TableInput,
} from './types'
import {
  DEFAULT_TABLE,
  MAX_CHIPS,
  SEAT_OPTIONS,
  validateTable,
} from './validation'

export type ContextState = {
  context: CreationContext | null
  loading: boolean
  error: string
  refresh: () => void
}
const format = (n: number) =>
  Number.isFinite(n) ? n.toLocaleString('en-US') : '-'

export function CreateTablePage({
  context,
  loading,
  error,
  refresh,
}: ContextState) {
  const [input, setInput] = useState<TableInput>({ ...DEFAULT_TABLE })
  const [errors, setErrors] = useState<FieldErrors>({})
  const [message, setMessage] = useState('')
  const [pending, setPending] = useState(false)
  const [created, setCreated] = useState<PokerTable | null>(null)
  const submitting = useRef(false)
  const form = useRef<HTMLFormElement>(null)
  const status = useRef<HTMLDivElement>(null)

  function update<K extends keyof TableInput>(field: K, value: TableInput[K]) {
    setInput((current) => ({ ...current, [field]: value }))
    setErrors({})
    setMessage('')
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (submitting.current || created || !context?.host) return
    const nextErrors = validateTable(input)
    setErrors(nextErrors)
    setMessage('')
    if (Object.keys(nextErrors).length) {
      // Wait for React to attach aria-invalid, then move keyboard focus to the first error.
      requestAnimationFrame(() =>
        form.current
          ?.querySelector<HTMLElement>('[aria-invalid="true"]')
          ?.focus(),
      )
      return
    }
    submitting.current = true
    setPending(true)
    try {
      const table = await createTable(
        { ...input, name: input.name.trim() },
        context.csrf_token,
      )
      setCreated(table)
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 400) {
        setErrors(cause.body as FieldErrors)
        setMessage('Please check the highlighted settings and try again.')
      } else if (cause instanceof ApiError && cause.status === 403) {
        setMessage(
          'Your session could not be verified. Refresh your session or sign in again.',
        )
      } else {
        setMessage(
          cause instanceof Error
            ? cause.message
            : 'Unable to create the table. Try again.',
        )
      }
    } finally {
      submitting.current = false
      setPending(false)
      requestAnimationFrame(() => status.current?.focus())
    }
  }

  function reset() {
    setInput({ ...DEFAULT_TABLE })
    setErrors({})
    setMessage('')
    setCreated(null)
    form.current?.querySelector('input')?.focus()
  }

  return (
    <>
      <div className="page-intro">
        <h1>Your table. Your rules.</h1>
        <p>Set up a poker night in seconds. All stakes use virtual chips.</p>
      </div>
      {loading && (
        <p role="status" className="notice">
          Checking your session…
        </p>
      )}
      {error && (
        <div className="notice error-notice" role="alert">
          {error}{' '}
          <button type="button" className="text-button" onClick={refresh}>
            Try again
          </button>
        </div>
      )}
      {!loading && !error && !context?.host && (
        <div className="notice">
          Sign in with a registered account to create a table.{' '}
          <a href="/admin/login/?next=/tables/create/">Sign in</a>
        </div>
      )}
      <form ref={form} onSubmit={submit} noValidate>
        <div className="table-configuration">
          <div className="configuration-fields">
            <section className="panel" aria-labelledby="details-title">
              <h2 id="details-title">Table details</h2>
              <fieldset className="fields" disabled={pending || !!created}>
                <FormField
                  label="Table name"
                  id="table-name"
                  value={input.name}
                  placeholder="The usual crew"
                  maxLength={80}
                  required
                  errors={errors.name}
                  onChange={(e) => update('name', e.target.value)}
                />
                <div className="form-field">
                  <label htmlFor="game-type">Game type</label>
                  <select id="game-type" value="holdem" disabled>
                    <option value="holdem">Texas Hold’em</option>
                  </select>
                </div>
                <div className="form-field">
                  <span className="field-label" id="privacy-label">
                    Privacy
                  </span>
                  <div className="option-row" aria-labelledby="privacy-label">
                    <span className="badge">Public</span>
                    <button
                      type="button"
                      className="button quiet"
                      disabled
                      title="Private tables are coming later"
                    >
                      Private
                    </button>
                  </div>
                  <p className="field-hint divider">
                    Your table is public and visible to other players.
                  </p>
                </div>
                <fieldset className="seat-field">
                  <legend>Table size</legend>
                  <div className="seat-options">
                    {SEAT_OPTIONS.map((n) => (
                      <label className="seat-option" key={n}>
                        <input
                          type="radio"
                          name="capacity"
                          value={n}
                          checked={input.max_players === n}
                          onChange={() => update('max_players', n)}
                        />
                        <span>{n} seats</span>
                      </label>
                    ))}
                  </div>
                  {errors.max_players && (
                    <p className="field-error">
                      {errors.max_players.join(' ')}
                    </p>
                  )}
                </fieldset>
                <div className="field-grid">
                  {(
                    [
                      ['buy_in', 'Starting buy-in'],
                      ['minimum_balance', 'Minimum balance'],
                      ['small_blind', 'Small blind'],
                      ['big_blind', 'Big blind'],
                    ] as const
                  ).map(([field, label]) => (
                    <FormField
                      key={field}
                      label={label}
                      id={field}
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={
                        field === 'small_blind'
                          ? Math.floor(MAX_CHIPS / 2)
                          : MAX_CHIPS
                      }
                      step={1}
                      required
                      value={Number.isNaN(input[field]) ? '' : input[field]}
                      errors={errors[field]}
                      onChange={(e) => update(field, e.target.valueAsNumber)}
                    />
                  ))}
                </div>
              </fieldset>
            </section>
            <section
              className="panel practice-panel"
              aria-labelledby="practice-title"
            >
              <h2 id="practice-title">Practice opponents</h2>
              <div className="option-row">
                <span className="badge">No bots</span>
                <button className="button quiet" type="button" disabled>
                  Bots coming later
                </button>
              </div>
              <p className="field-hint divider">
                This table is for human players. Practice opponents will be
                available in a future update.
              </p>
            </section>
          </div>
          <aside className="configuration-summary">
            <section className="panel" aria-labelledby="public-title">
              <h2 id="public-title">Open to everyone</h2>
              <p className="muted">
                Create a public place for your next poker night. Other players
                will be able to find it in the lobby.
              </p>
              <dl className="summary-list">
                <div>
                  <dt>Visibility</dt>
                  <dd>Public</dd>
                </div>
                <div>
                  <dt>Invitations</dt>
                  <dd>No invite needed</dd>
                </div>
                <div>
                  <dt>Players on creation</dt>
                  <dd>0 / {input.max_players}</dd>
                </div>
              </dl>
            </section>
            <section
              className="panel ready-panel"
              aria-labelledby="ready-title"
            >
              <h2 id="ready-title">Ready to host</h2>
              <h3>{input.name.trim() || 'Your new table'}</h3>
              <p className="muted">
                Public · {input.max_players} seats · Texas Hold’em
                <br />
                {format(input.small_blind)} / {format(input.big_blind)} blinds ·
                No bots
              </p>
              <dl className="summary-list">
                <div>
                  <dt>Starting buy-in</dt>
                  <dd>{format(input.buy_in)}</dd>
                </div>
                <div>
                  <dt>Minimum balance</dt>
                  <dd>{format(input.minimum_balance)}</dd>
                </div>
              </dl>
              <div className="notice success-notice">
                <img src={check} alt="" />
                <div>
                  <strong>Virtual chips. Real company.</strong>
                  <p>
                    Creating a table is free. Chips stay in your balance until
                    joining is available.
                  </p>
                </div>
              </div>
              <div ref={status} tabIndex={-1} className="submission-status">
                {message && (
                  <div className="error-notice notice" role="alert">
                    {message}
                    <button
                      type="button"
                      className="text-button"
                      onClick={refresh}
                    >
                      Refresh session
                    </button>
                  </div>
                )}
                {created && (
                  <div className="notice success-notice" role="status">
                    <div>
                      <strong>Table created!</strong>
                      <p>{created.name} is saved and ready for players.</p>
                      <Link to={`/tables/${created.id}`}>
                        View your table →
                      </Link>
                      <Link className="created-lobby-link" to="/lobby">
                        See it in the lobby →
                      </Link>
                    </div>
                  </div>
                )}
              </div>
              {created ? (
                <button
                  className="button primary full-width"
                  type="button"
                  onClick={reset}
                >
                  Create another table
                </button>
              ) : (
                <button
                  className="button primary full-width"
                  type="submit"
                  disabled={pending || loading || !context?.host}
                >
                  {pending ? 'Creating table…' : 'Create Table →'}
                </button>
              )}
              <Link
                className={`button quiet full-width ${pending ? 'disabled-link' : ''}`}
                aria-disabled={pending}
                to="/"
                onClick={(e) => {
                  if (pending) e.preventDefault()
                }}
              >
                Cancel
              </Link>
            </section>
          </aside>
        </div>
      </form>
    </>
  )
}
