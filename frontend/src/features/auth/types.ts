// Mirrors the session contract in docs/contracts.md (S2/S1/S4).
export type SessionUser = {
  id: number
  username: string
  email: string
  is_admin: boolean
}
export type Session = {
  state: 'anonymous' | 'guest' | 'registered'
  user: SessionUser | null
  guest: { name: string } | null
  csrf_token: string
}
export type RegisterInput = { username: string; email: string; password: string }
export type LoginInput = { username: string; password: string }
export type GuestInput = { name: string }
export type AuthErrors = Partial<
  Record<
    'username' | 'email' | 'password' | 'confirm' | 'age' | 'name' | 'non_field_errors',
    string[]
  >
>
