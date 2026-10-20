export class ApiError extends Error {
  status: number
  body: Record<string, unknown>

  constructor(status: number, body: Record<string, unknown>) {
    super(
      typeof body.detail === 'string'
        ? body.detail
        : 'The request could not be completed.',
    )
    this.status = status
    this.body = body
  }
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(path, { ...init, credentials: 'same-origin' })
  } catch {
    throw new Error(
      'Unable to reach RIVR. Check your connection and try again.',
    )
  }
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new ApiError(response.status, body)
  return body as T
}
