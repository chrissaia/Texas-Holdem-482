import type { AuthErrors } from './types'

// Quick browser-side checks that mirror backend/accounts/serializers.py. The
// server still validates everything; these only save a round trip.
const USERNAME = /^[A-Za-z0-9_.-]+$/
const GUEST_NAME = /^[A-Za-z0-9 _-]+$/

export type RegisterForm = {
  email: string
  username: string
  password: string
  confirm: string
  age: boolean
}

export function validateRegister(form: RegisterForm): AuthErrors {
  const errors: AuthErrors = {}
  if (!form.email.trim()) errors.email = ['Enter your email address.']
  const username = form.username.trim()
  if (username.length < 3 || username.length > 30)
    errors.username = ['Use 3–30 characters.']
  else if (!USERNAME.test(username))
    errors.username = [
      'Use only letters, numbers, periods, hyphens, and underscores.',
    ]
  if (!form.password) errors.password = ['Enter a password.']
  if (form.confirm !== form.password)
    errors.confirm = ['Passwords do not match.']
  if (!form.age)
    errors.age = ['Confirm that you meet the minimum age requirement.']
  return errors
}

export function validateLogin(username: string, password: string): AuthErrors {
  const errors: AuthErrors = {}
  if (!username.trim()) errors.username = ['Enter your username.']
  if (!password) errors.password = ['Enter your password.']
  return errors
}

export function validateGuestName(raw: string): AuthErrors {
  const name = raw.trim()
  if (name.length < 2 || name.length > 20)
    return { name: ['Use 2–20 characters.'] }
  if (!GUEST_NAME.test(name))
    return {
      name: ['Use only letters, numbers, spaces, hyphens, and underscores.'],
    }
  return {}
}
