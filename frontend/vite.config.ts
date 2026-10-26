import react from '@vitejs/plugin-react'
import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react()],
    server: {
      host: '127.0.0.1',
      port: 5173,
      strictPort: true,
      proxy: {
        '/api': { target: env.API_PROXY_TARGET || 'http://127.0.0.1:8000' },
        '/admin': { target: env.API_PROXY_TARGET || 'http://127.0.0.1:8000' },
        '/media': { target: env.API_PROXY_TARGET || 'http://127.0.0.1:8000' },
        '/static': { target: env.API_PROXY_TARGET || 'http://127.0.0.1:8000' },
      },
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      coverage: {
        provider: 'v8',
        include: ['src/**/*.{ts,tsx}'],
        exclude: ['src/test/**', 'src/main.tsx'],
        reporter: ['text', 'html', 'json-summary'],
      },
    },
  }
})
