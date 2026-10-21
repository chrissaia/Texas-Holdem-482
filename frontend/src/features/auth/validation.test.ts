import { expect, test } from 'vitest'
import { validateGuestName, validateLogin, validateRegister } from './validation'

const valid = {
  email: 'finn@example.com',
  username: 'Finn_1.2-3',
  password: 'a-long-passphrase',
  confirm: 'a-long-passphrase',
  age: true,
}

test('a complete registration form passes', () => {
  expect(validateRegister(valid)).toEqual({})
})

test.each([
  [{ email: '  ' }, 'email', 'Enter your email address.'],
  [{ username: 'ab' }, 'username', 'Use 3–30 characters.'],
  [{ username: 'a'.repeat(31) }, 'username', 'Use 3–30 characters.'],
  [
    { username: 'Finn!' },
    'username',
    'Use only letters, numbers, periods, hyphens, and underscores.',
  ],
  [{ password: '', confirm: '' }, 'password', 'Enter a password.'],
  [{ confirm: 'different' }, 'confirm', 'Passwords do not match.'],
  [
    { age: false },
    'age',
    'Confirm that you meet the minimum age requirement.',
  ],
] as const)('registration rejects %o', (change, field, message) => {
  expect(validateRegister({ ...valid, ...change })[field]).toEqual([message])
})

test('login requires both fields', () => {
  expect(validateLogin('Finn', 'pw')).toEqual({})
  expect(validateLogin(' ', '')).toEqual({
    username: ['Enter your username.'],
    password: ['Enter your password.'],
  })
})

test.each([
  ['River Jay', {}],
  ['  Ri  ', {}],
  ['R', { name: ['Use 2–20 characters.'] }],
  ['x'.repeat(21), { name: ['Use 2–20 characters.'] }],
  [
    'River.Jay',
    {
      name: ['Use only letters, numbers, spaces, hyphens, and underscores.'],
    },
  ],
])('guest name %j', (name, expected) => {
  expect(validateGuestName(name)).toEqual(expected)
})
