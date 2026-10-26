export type Profile = {
  id: number
  username: string
  avatar_url: string | null
  chip_balance: number
  starting_chips_granted_at: string | null
  daily_reward: {
    amount: number
    available: boolean
    next_claim_at: string | null
  }
}
export type ProfileResponse = Profile & { csrf_token: string }
export type ProfileSummary = Pick<Profile, 'avatar_url' | 'chip_balance'>
