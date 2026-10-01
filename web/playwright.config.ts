import { defineConfig, devices } from '@playwright/test'

// Runs against the emulator stack: `npm run local` (or any `vite --mode emulator`
// server). E2E_BASE_URL points elsewhere, e.g. a second stack on other ports.
// Each run gets its own output folder: Playwright empties it on start, so
// parallel runs sharing one would delete each other's traces.
process.env.E2E_OUTPUT_DIR ??= `test-results/run-${Date.now()}`

export default defineConfig({
  testDir: 'e2e',
  outputDir: process.env.E2E_OUTPUT_DIR,
  fullyParallel: true,
  // Every seeded competition fans out into dozens of aggregate triggers in
  // the functions emulator; more workers than this swamps it.
  workers: 2,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5273',
    channel: 'chrome',
    trace: 'retain-on-failure',
    serviceWorkers: 'block',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], channel: 'chrome' } },
    { name: 'phone', use: { ...devices['Pixel 7'], channel: 'chrome' } },
  ],
})
