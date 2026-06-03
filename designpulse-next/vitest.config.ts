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
      result[trimmed.slice(0, eqIdx)] = trimmed.slice(eqIdx + 1);
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
