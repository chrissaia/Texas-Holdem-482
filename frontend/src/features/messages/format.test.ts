import { expect, test } from 'vitest'
import { ApiError } from '../../api/client'
import { mergeMessages, messageTime, sendError } from './format'

test('times show the clock for today and the date otherwise', () => {
  const now = new Date(2026, 10, 20, 21, 0)
  expect(messageTime(new Date(2026, 10, 20, 20, 42).toISOString(), now)).toBe('20:42')
  expect(messageTime(new Date(2026, 10, 18, 9, 5).toISOString(), now)).toBe('Nov 18, 09:05')
})

test('merging skips messages already shown and keeps order', () => {
  const current = [{ id: 1 }, { id: 3 }]
  expect(mergeMessages(current, [])).toBe(current)
  expect(mergeMessages(current, [{ id: 3 }, { id: 2 }]).map((m) => m.id)).toEqual([1, 2, 3])
})

test('send errors prefer the server message', () => {
  expect(sendError(new ApiError(400, { body: ['Ensure this field has no more than 500 characters.'] }))).toContain('500')
  expect(sendError(new ApiError(404, {}))).toContain('friends')
  expect(sendError(new ApiError(403, {}))).toContain('sign in again')
  expect(sendError(new Error('offline'))).toBe('offline')
  expect(sendError('?')).toBe('Your message was not sent. Try again.')
})
