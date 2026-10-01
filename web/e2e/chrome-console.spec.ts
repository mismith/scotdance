import { expect, test } from '@playwright/test'

// Every public page loads without a console error or an uncaught exception,
// on a phone and a desktop. Uses the emulator's legacy data (read only),
// including its quirks: string dates, ISO dates, blank registration dates,
// a competition without a date.

const ROUTES = [
  '/',
  '/competitions',
  '/competitions?view=calendar',
  '/competitions?view=map',
  '/search',
  '/search?q=isla',
  '/search?q=zzzzqqq',
  '/search?by=number',
  '/dancers',
  '/judges',
  '/pipers',
  '/venues',
  '/judges/-OsoH2I8uTd5UQHwDum4/info',
  '/pipers/-OsoH4N8bjTwWiUudjkx/info',
  '/venues/-OsoH8n0XvjuN0nhsvMu/info',
  '/dancers/-OsoHXgf8ThIQ81eayjM/info',
  '/dancers/nope/info',
  '/settings',
  '/about',
  '/about#faq-privacy',
  '/policies',
  '/no/such/page',
  '/competitions/submit',
  '/profile',
  '/competitions/-L9Sc9TQWQclq_7oA3ij/info',
  '/competitions/-L9Sc9TQWQclq_7oA3ij/dancers',
  '/competitions/-L9Sc9TQWQclq_7oA3ij/schedule',
  '/competitions/-L9Sc9TQWQclq_7oA3ij/results',
  '/competitions/-L9Sck5Kb-4D4wYsQWtZ/info',
  '/competitions/-L9O-hu-htXrSPqsEG8l/info',
  '/competitions/-LRPrYbzJDPcpXGutoIV/info',
  '/competitions/-OUSSlB1Yj8e57t9co0R/info',
  '/competitions/nope/info',
]

// Noise from third parties that isn't the app's to fix: the support chat's
// socket closing when a test navigates away mid-connect.
const IGNORE = [/relay\.crisp\.chat/]

test('every public page loads without errors', async ({ page }) => {
  test.setTimeout(ROUTES.length * 15_000)
  const problems: string[] = []
  page.on('console', (m) => {
    if (m.type() !== 'error') return
    const text = m.text()
    if (!IGNORE.some((re) => re.test(text))) problems.push(`${page.url()} :: ${text.slice(0, 300)}`)
  })
  page.on('pageerror', (e) => problems.push(`${page.url()} :: uncaught ${e.message}`))
  for (const path of ROUTES) {
    await page.goto(path)
    await expect(page.locator('main').first()).toBeAttached({ timeout: 15_000 })
    await page.waitForTimeout(1200)
  }
  expect(problems).toEqual([])
})
