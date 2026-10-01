import { expect as baseExpect, test, type Page } from '@playwright/test'

// The dev server is shared and busy during a full run: give page loads time.
const expect = baseExpect.configure({ timeout: 15_000 })

// Sheets and menus (components/Dialog.vue): closed ones must be truly gone,
// not just transparent, and opening/closing must work with and without
// motion, by tap, Escape and the backdrop.

const closedDialogs = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('dialog:not([open])')].map((d) => ({
      display: getComputedStyle(d).display,
      text: (d.textContent ?? '').trim().slice(0, 40),
    })),
  )

async function settle(page: Page) {
  // Let any exit transition (220ms) or morph (150ms) finish.
  await page.waitForTimeout(500)
}

test('closed sheets are not displayed, so they never block taps or reach screen readers', async ({ page }) => {
  await page.goto('/competitions')
  await expect(page.getByRole('heading', { level: 1, name: 'Competitions' })).toBeVisible()
  const closed = await closedDialogs(page)
  expect(closed.length).toBeGreaterThan(0)
  for (const d of closed) expect(d, d.text).toMatchObject({ display: 'none' })
  // Nothing in the accessibility tree should be a dialog while none is open.
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('a sheet opens and closes, and leaves nothing behind', async ({ page }) => {
  await page.goto('/competitions')
  const trigger = page.getByRole('button', { name: /^Show as/ })
  await trigger.click()
  const sheet = page.getByRole('dialog').filter({ hasText: 'Show competitions as' })
  await expect(sheet).toBeVisible()
  await settle(page)
  await sheet.getByRole('radio', { name: /Calendar/ }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page).toHaveURL(/view=calendar/)
  await settle(page)
  for (const d of await closedDialogs(page)) expect(d, d.text).toMatchObject({ display: 'none' })
  // The page underneath takes taps where the sheet was.
  await page.getByRole('button', { name: 'Next month' }).click()
  await page.getByRole('button', { name: /^Show as/ }).click()
  await settle(page)
  await page.getByRole('dialog').getByRole('radio', { name: /List/ }).click()
  await expect(page).not.toHaveURL(/view=/)
})

test('Escape and the backdrop close a sheet; focus goes back to the page', async ({ page }) => {
  await page.goto('/competitions')
  await page.getByRole('button', { name: /^Show as/ }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)

  await page.getByRole('button', { name: /^Show as/ }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  // Taps during the opening morph go to the transition, not the page.
  await settle(page)
  // Top-left corner is backdrop on every screen size.
  await page.mouse.click(5, 5)
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await settle(page)

  // Tabbing never lands inside a closed sheet.
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab')
    const inClosedDialog = await page.evaluate(() => !!document.activeElement?.closest('dialog:not([open])'))
    expect(inClosedDialog).toBe(false)
  }
})

test.describe('with Reduce Motion', () => {
  test.use({ reducedMotion: 'reduce' })

  test('sheets still open and close', async ({ page }) => {
    await page.goto('/competitions')
    await page.getByRole('button', { name: /^Show as/ }).click()
    const sheet = page.getByRole('dialog')
    await expect(sheet).toBeVisible()
    await sheet.getByRole('button', { name: 'Close' }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    for (const d of await closedDialogs(page)) expect(d, d.text).toMatchObject({ display: 'none' })
  })
})

test('the More menu opens from the tab bar and its items navigate', async ({ page }) => {
  await page.goto('/')
  const nav = page.getByRole('navigation', { name: 'App' })
  await nav.getByRole('button', { name: 'More' }).click()
  const menu = page.getByRole('dialog', { name: 'More' })
  await expect(menu).toBeVisible()
  await menu.getByRole('button', { name: 'Judges' }).click()
  await expect(page).toHaveURL(/\/judges$/)
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('heading', { level: 1, name: 'Judges' })).toBeVisible()
  await settle(page)
  for (const d of await closedDialogs(page)) expect(d, d.text).toMatchObject({ display: 'none' })
})

test.describe('with large text (150%)', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() =>
      document.addEventListener('DOMContentLoaded', () => {
        const s = document.createElement('style')
        s.textContent = 'html { font-size: 150% !important }'
        document.head.append(s)
      }),
    )
  })

  test('the More menu fits on screen and every item can be reached', async ({ page }) => {
    await page.goto('/competitions')
    await page.getByRole('navigation', { name: 'App' }).getByRole('button', { name: 'More' }).click()
    const menu = page.getByRole('dialog', { name: 'More' })
    await expect(menu).toBeVisible()
    await settle(page)
    const box = (await menu.boundingBox())!
    const viewport = page.viewportSize()!
    expect(box.y).toBeGreaterThanOrEqual(0)
    expect(box.x).toBeGreaterThanOrEqual(0)
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width)
    for (const name of ['Dancers', 'Judges', 'Submit a competition', 'About ScotDance']) {
      const item = menu.getByRole('button', { name, exact: true })
      await item.scrollIntoViewIfNeeded()
      await expect(item).toBeInViewport()
    }
  })
})

test.describe('page changes', () => {
  const countTransitions = async (page: Page) => {
    await page.addInitScript(() => {
      const w = window as Window & { __vt?: number }
      w.__vt = 0
      const start = document.startViewTransition?.bind(document)
      if (start)
        document.startViewTransition = ((arg: Parameters<typeof start>[0]) => {
          w.__vt = (w.__vt ?? 0) + 1
          return start(arg)
        }) as typeof document.startViewTransition
    })
  }

  test('animate between tabs normally', async ({ page }) => {
    await countTransitions(page)
    await page.goto('/competitions')
    await page.getByRole('navigation', { name: 'App' }).getByRole('link', { name: 'Search' }).click()
    await expect(page).toHaveURL(/\/search$/)
    expect(await page.evaluate(() => (window as Window & { __vt?: number }).__vt)).toBeGreaterThan(0)
  })

  test.describe('with Reduce Motion', () => {
    test.use({ reducedMotion: 'reduce' })
    test('just change, without a transition', async ({ page }) => {
      await countTransitions(page)
      await page.goto('/competitions')
      const nav = page.getByRole('navigation', { name: 'App' })
      await nav.getByRole('link', { name: 'Search' }).click()
      await expect(page).toHaveURL(/\/search$/)
      await nav.getByRole('link', { name: 'Home' }).click()
      await expect(page).toHaveURL(/\/$/)
      expect(await page.evaluate(() => (window as Window & { __vt?: number }).__vt)).toBe(0)
    })
  })
})
