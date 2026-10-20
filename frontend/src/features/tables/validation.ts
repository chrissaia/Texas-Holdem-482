import type { FieldErrors, TableInput } from './types'

export const SEAT_OPTIONS = [2, 4, 6, 8, 9] as const
export const MAX_CHIPS = 2_147_483_647
export const DEFAULT_TABLE: TableInput = {
  name: '',
  max_players: 6,
  buy_in: 1000,
  minimum_balance: 1000,
  small_blind: 25,
  big_blind: 50,
}

export function validateTable(input: TableInput): FieldErrors {
  const errors: FieldErrors = {}
  if (!input.name.trim() || input.name.trim().length > 80) {
    errors.name = ['Enter a table name between 1 and 80 characters.']
  }
  for (const field of [
    'buy_in',
    'minimum_balance',
    'small_blind',
    'big_blind',
  ] as const) {
    const max = field === 'small_blind' ? Math.floor(MAX_CHIPS / 2) : MAX_CHIPS
    if (
      !Number.isInteger(input[field]) ||
      input[field] < 1 ||
      input[field] > max
    ) {
      errors[field] = [
        `Enter a whole number between 1 and ${max.toLocaleString('en-US')}.`,
      ]
    }
  }
  if (!SEAT_OPTIONS.some((n) => n === input.max_players))
    errors.max_players = ['Choose a supported table size.']
  if (
    !errors.small_blind &&
    !errors.big_blind &&
    input.big_blind !== input.small_blind * 2
  ) {
    errors.big_blind = ['Big blind must be twice the small blind.']
  }
  if (!errors.buy_in && !errors.big_blind && input.buy_in < input.big_blind) {
    errors.buy_in = ['Buy-in must be at least the big blind.']
  }
  if (
    !errors.minimum_balance &&
    !errors.buy_in &&
    input.minimum_balance < input.buy_in
  ) {
    errors.minimum_balance = ['Minimum balance must be at least the buy-in.']
  }
  return errors
}
