import { expect, test } from 'vitest'
import {
  DEFAULT_TABLE,
  MAX_CHIPS,
  SEAT_OPTIONS,
  validateTable,
} from './validation'

const input = { ...DEFAULT_TABLE, name: 'Friday poker' }
test.each(SEAT_OPTIONS)(
  'accepts %i seats with valid chip settings',
  (max_players) => {
    expect(validateTable({ ...input, max_players })).toEqual({})
  },
)
test.each([0, -1, 0.5, NaN, Infinity, MAX_CHIPS + 1])(
  'rejects invalid chip value %s',
  (value) => {
    for (const field of [
      'buy_in',
      'minimum_balance',
      'small_blind',
      'big_blind',
    ] as const) {
      expect(validateTable({ ...input, [field]: value })[field]).toBeDefined()
    }
  },
)
test('rejects invalid seat counts, long names and unaffordable starting stacks', () => {
  expect(
    validateTable({
      ...input,
      max_players: 3,
      name: 'x'.repeat(81),
      buy_in: 49,
    }),
  ).toMatchObject({
    name: expect.any(Array),
    max_players: expect.any(Array),
    buy_in: expect.any(Array),
  })
})
