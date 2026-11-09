/**
 * Module: frontend/vite.config.ts.
 * Implement vite.config for the shared application feature and its importing components.
 */
import react from "@vitejs/plugin-react";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

export default defineConfig(/* Handle the defineConfig callback using the current operation's state. */ ({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react()],
    server: {
      host: "127.0.0.1",
      port: 5173,
      strictPort: true,
      proxy: {
        "/api": { target: env.API_PROXY_TARGET || "http://127.0.0.1:8000" },
        "/admin": { target: env.API_PROXY_TARGET || "http://127.0.0.1:8000" },
        "/media": { target: env.API_PROXY_TARGET || "http://127.0.0.1:8000" },
        "/static": { target: env.API_PROXY_TARGET || "http://127.0.0.1:8000" },
      },
    },
    test: {
      environment: "jsdom",
      setupFiles: ["./src/test/setup.ts"],
      coverage: {
        provider: "v8",
        include: ["src/**/*.{ts,tsx}"],
        exclude: ["src/test/**", "src/**/*.test.{ts,tsx}", "src/**/*.d.ts"],
        reporter: ["text", "html", "json", "json-summary"],
      },
    },
  };
});
