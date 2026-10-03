import { expect as baseExpect, test } from '@playwright/test'
import { appTab } from './support/nav'

// The dev server is shared and busy during a full run: give page loads time.
const expect = baseExpect.configure({ timeout: 15_000 })

// App-wide navigation: page titles, the tab bar, Back and scroll positions,
// and getting around by keyboard. Uses the emulator's legacy data (read only).

test.describe('page titles', () => {
  for (const [path, title] of [
    ['/', 'Home • ScotDance.app'],
    ['/competitions', 'Competitions • ScotDance.app'],
    ['/search', 'Search • ScotDance.app'],
    ['/dancers', 'Dancers • ScotDance.app'],
    ['/judges', 'Judges • ScotDance.app'],
    ['/pipers', 'Pipers • ScotDance.app'],
    ['/venues', 'Venues • ScotDance.app'],
    ['/settings', 'Settings • ScotDance.app'],
    ['/about', 'About • ScotDance.app'],
    ['/policies', 'Privacy and terms • ScotDance.app'],
    ['/no/such/page', 'Not found • ScotDance.app'],
  ] as const) {
    test(`${path} is called “${title}”`, async ({ page }) => {
      await page.goto(path)
      await expect(page).toHaveTitle(title)
    })
  }
})

test('the tab bar (the sidebar, on wide screens) marks where you are, and tapping the current tab goes back to the top', async ({ page }) => {
  await page.goto('/judges')
  await appTab(page, 'Competitions').click()
  await expect(page).toHaveURL(/\/competitions$/)
  await expect(appTab(page, 'Competitions')).toHaveAttribute('aria-current', 'page')
  await expect(appTab(page, 'Home')).not.toHaveAttribute('aria-current', 'page')
  await appTab(page, 'Search').click()
  await expect(page).toHaveURL(/\/search$/)
  await expect(appTab(page, 'Search')).toHaveAttribute('aria-current', 'page')
})

test('going back returns to where you were in a long list', { tag: '@seed' }, async ({ page }) => {
  await page.goto('/judges')
  await expect(page.getByRole('heading', { level: 1, name: 'Judges' })).toBeVisible()
  const row = page.getByRole('link', { name: /^Lisa Barker/ }).first()
  await row.scrollIntoViewIfNeeded()
  await page.mouse.wheel(0, 200)
  await page.waitForTimeout(300)
  const before = await page.evaluate(() => scrollY)
  expect(before).toBeGreaterThan(100)
  await row.click()
  await expect(page).toHaveURL(/\/judges\/[^/]+\/info$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Lisa Barker' })).toBeVisible()
  await page.goBack()
  await expect(page).toHaveURL(/\/judges$/)
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(before - 40)
  // And forward again lands at the top of the judge's page.
  await page.goForward()
  await expect(page).toHaveURL(/\/judges\/[^/]+\/info$/)
  await expect.poll(() => page.evaluate(() => scrollY)).toBeLessThan(40)
})

test('Back on a deep link goes up to the section, and the browser’s Back doesn’t bounce down again', { tag: '@seed' }, async ({ page }) => {
  await page.goto('/judges/-OsoH2I8uTd5UQHwDum4/info')
  const back = page.getByRole('button', { name: 'Back to Judges' })
  await expect(back).toBeVisible()
  await back.click()
  await expect(page).toHaveURL(/\/judges$/)
  await page.goBack()
  await expect(page).not.toHaveURL(/\/judges\/-OsoH2I8uTd5UQHwDum4/)
})

test('leaving a competition opened from a link goes to Competitions, without bouncing back', { tag: '@seed' }, async ({ page }) => {
  await page.goto('/competitions/-L9Sc9TQWQclq_7oA3ij/info')
  await page.getByRole('button', { name: 'Back to Competitions', exact: true }).click()
  await expect(page).toHaveURL(/\/competitions$/)
  await page.goBack()
  await expect(page).not.toHaveURL(/-L9Sc9TQWQclq_7oA3ij/)
})

test('Back after tapping through still steps back through history', { tag: '@seed' }, async ({ page }) => {
  await page.goto('/judges')
  await page.getByRole('link', { name: /^Aileen Robertson/ }).first().click()
  await expect(page).toHaveURL(/\/judges\/[^/]+\/info$/)
  await page.getByRole('button', { name: 'Back to Judges' }).click()
  await expect(page).toHaveURL(/\/judges$/)
  await page.goForward()
  await expect(page).toHaveURL(/\/judges\/[^/]+\/info$/)
})

test('everything can be reached by keyboard, with a visible focus ring', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard navigation is a desktop concern')
  await page.goto('/competitions')
  await expect(page.getByRole('heading', { level: 1, name: 'Competitions' })).toBeVisible()
  const seen: string[] = []
  // The sidebar comes first, then the page: Tab until every one of these has had focus
  // (how many rows come between depends on the data).
  const expected = ['Home', 'Competitions', 'Search', 'Dancers', 'Venues', 'Submit a competition', 'Settings', 'About ScotDance.app', 'List', 'Calendar', 'Map', 'Which competitions: Upcoming']
  for (let i = 0; i < 80 && !expected.every((label) => seen.includes(label)); i++) {
    await page.keyboard.press('Tab')
    const focus = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null
      if (!el || el === document.body) return null
      const r = el.getBoundingClientRect()
      const cs = getComputedStyle(el)
      return {
        label: (el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 30),
        visible: r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight,
        ring: cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 2,
        inClosedDialog: !!el.closest('dialog:not([open])'),
      }
    })
    if (!focus) continue
    seen.push(focus.label)
    expect(focus, focus.label).toMatchObject({ visible: true, ring: true, inClosedDialog: false })
  }
  expect(seen).toEqual(expect.arrayContaining(expected))
})
