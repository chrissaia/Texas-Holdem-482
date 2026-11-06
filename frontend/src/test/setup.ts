/**
 * Module: test/setup.ts.
 * Implement setup for the shared application feature and its importing components.
 */
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(cleanup)
