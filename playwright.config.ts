import { defineConfig, devices } from '@playwright/test';

// Browser tests ALWAYS run against demo mode, on their own port, with their own
// dev server. They never touch the family's real board, even when .env.local
// points at Supabase: VITE_FORCE_DEMO wins (see src/app/connection.ts, ticket T02).
const PORT = 5174;

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: true,
  retries: 0,
  reporter: [['list']],
  timeout: 30_000,
  expect: { timeout: 5_000 },
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: 'en-US',
    timezoneId: 'America/Los_Angeles',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `npm run dev -- --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    env: { VITE_FORCE_DEMO: '1' },
  },
  projects: [
    // His screens: a laptop-sized window. Files named parent.*.spec.ts are skipped here.
    { name: 'kid', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } }, testIgnore: /parent\..*\.spec\.ts$/ },
    // Parent screens: a phone.
    { name: 'parent', use: { ...devices['Pixel 7'] }, testMatch: /parent\..*\.spec\.ts$/ },
  ],
});
