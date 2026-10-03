import { defineConfig, devices } from '@playwright/test'

// Runs against the emulator stack: `npm run local` (or any `vite --mode emulator`
// server). E2E_BASE_URL points elsewhere, e.g. a second stack on other ports.
// Each run gets its own output folder: Playwright empties it on start, so
// parallel runs sharing one would delete each other's traces.
process.env.E2E_OUTPUT_DIR ??= `test-results/run-${Date.now()}`

// CI (.github/workflows/e2e.yml) has the emulators up but no `npm run local`,
// so it serves the app itself. Its emulators start empty: tests that read
// the local seed data are tagged @seed and left out there, and its search
// collections are made before the tests (ciSetup).
const ci = !!process.env.CI

export default defineConfig({
  testDir: 'e2e',
  outputDir: process.env.E2E_OUTPUT_DIR,
  globalSetup: ci ? './e2e/support/ciSetup.ts' : undefined,
  fullyParallel: true,
  forbidOnly: ci,
  // Every seeded competition fans out into dozens of aggregate triggers in
  // the functions emulator; more workers than this swamps it.
  workers: 2,
  // Even at two workers it sometimes falls behind; once more rules that out.
  retries: ci ? 1 : 0,
  reporter: ci ? [['list'], ['github']] : [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5273',
    channel: 'chrome',
    trace: 'retain-on-failure',
    serviceWorkers: 'block',
  },
  webServer: ci
    ? { command: 'npx vite --mode emulator --port 5273 --strictPort', url: 'http://localhost:5273', timeout: 120_000 }
    : undefined,
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], channel: 'chrome' } },
    { name: 'phone', use: { ...devices['Pixel 7'], channel: 'chrome' } },
  ],
})
