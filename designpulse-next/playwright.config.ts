import { defineConfig, devices } from '@playwright/test';
import { readFileSync } from 'fs';
import path from 'path';

/**
 * Playwright E2E test configuration for Design Pulse.
 *
 * Assumes the Next.js dev server is running on http://localhost:8000
 * (via `npm run dev` which maps to `next dev -p 8000`).
 *
 * Run with: npm run test:e2e
 */

// Load .env.local into process.env so specs can read TEST_USER_EMAIL / TEST_USER_PASSWORD
// (and any other keys) without hardcoding secrets. Missing file → specs fail loudly.
(function loadDotEnv() {
  try {
    const content = readFileSync(path.resolve(__dirname, '.env.local'), 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx);
      let value = trimmed.slice(eqIdx + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = value;
    }
  } catch {
    // .env.local not found — credential-dependent specs will fail loudly at runtime.
  }
})();

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
