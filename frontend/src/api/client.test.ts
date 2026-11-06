/**
 * Regression tests: api/client.test.ts.
 * Exercises observable behavior and isolates API or browser dependencies.
 */
import { afterEach, expect, test, vi } from 'vitest'
import { ApiError, request } from './client'

afterEach(/* Restore test isolation after the preceding scenario. */ () => vi.unstubAllGlobals())
test('non-JSON server errors retain HTTP status without leaking raw HTML', /* Verify non-JSON server errors retain HTTP status without leaking raw HTML. */ async () => {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValue(
        new Response('<html>internal exception</html>', { status: 500 }),
      ),
  )
  await expect(request('/api/tables/')).rejects.toMatchObject({
    status: 500,
    body: {},
    message: 'The request could not be completed.',
  })
})
test('API errors expose field data and optional detail safely', /* Verify API errors expose field data and optional detail safely. */ () => {
  expect(new ApiError(400, { name: ['Invalid'] }).message).toBe(
    'The request could not be completed.',
  )
})
