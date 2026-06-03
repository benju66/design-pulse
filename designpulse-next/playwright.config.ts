import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E test configuration for Design Pulse.
 *
 * Assumes the Next.js dev server is running on http://localhost:8000
 * (via `npm run dev` which maps to `next dev -p 8000`).
 *
 * Run with: npm run test:e2e
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false, // Sequential execution — tests share auth state
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Single worker — tests depend on shared state
  reporter: 'html',
  timeout: 60_000, // 60s per test — allows for network latency

  use: {
    baseURL: 'http://localhost:8000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Do NOT auto-start the dev server — it should already be running.
  // The dev server has complex proxy configuration for the Python backend.
  // webServer: { command: 'npm run dev', url: 'http://localhost:8000', reuseExistingServer: true },
});
