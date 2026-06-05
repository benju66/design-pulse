import { defineConfig } from 'vitest/config';
import path from 'path';
import { readFileSync } from 'fs';

// Load .env.local variables for integration tests
function loadDotEnv(): Record<string, string> {
  const result: Record<string, string> = {};
  try {
    const content = readFileSync(path.resolve(__dirname, '.env.local'), 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx);
      let value = trimmed.slice(eqIdx + 1).trim();
      // Strip matching surrounding quotes so quoted secrets don't load with literal quotes
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      result[key] = value;
    }
  } catch {
    // .env.local not found — integration tests will be skipped at runtime
  }
  return result;
}

const envVars = loadDotEnv();

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  define: {
    'process.env.NEXT_PUBLIC_SUPABASE_URL': JSON.stringify(envVars.NEXT_PUBLIC_SUPABASE_URL ?? ''),
    'process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY': JSON.stringify(envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''),
    'process.env.TEST_USER_EMAIL': JSON.stringify(envVars.TEST_USER_EMAIL ?? ''),
    'process.env.TEST_USER_PASSWORD': JSON.stringify(envVars.TEST_USER_PASSWORD ?? ''),
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    setupFiles: ['tests/setup.ts'],
    testTimeout: 15000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/utils/**', 'src/stores/**', 'src/lib/**'],
    },
  },
});
