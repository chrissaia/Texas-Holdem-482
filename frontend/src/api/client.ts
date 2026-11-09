/**
 * Module: api/client.ts.
 * Implement client for the shared application feature and its importing components.
 */
/** Represent an unsuccessful API response with its HTTP status and parsed error fields. */
export class ApiError extends Error {
  status: number
  body: Record<string, unknown>

  /* Store the HTTP status and parsed response body for caller-side error handling. */
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

/** Send a same-origin API request and translate unsuccessful responses into structured errors. */
export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(path, { ...init, credentials: 'same-origin' })
  } catch {
    throw new Error(
      'Unable to reach RIVR. Check your connection and try again.',
    )
  }
  const body = await response.json().catch(/* Handle the failed operation without leaving stale UI feedback. */ () => ({}))
  if (!response.ok) throw new ApiError(response.status, body)
  return body as T
}
