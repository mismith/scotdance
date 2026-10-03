import { expect as baseExpect, test, type Page } from '@playwright/test'
import { appNav, appTab, hasSidebar } from './support/nav'

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
  const trigger = page.getByRole('button', { name: /^Which competitions/ })
  await trigger.click()
  const sheet = page.getByRole('dialog', { name: 'Which competitions' })
  await expect(sheet).toBeVisible()
  await settle(page)
  await sheet.getByRole('radio', { name: /^Past results/ }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(trigger).toHaveAccessibleName('Which competitions: Past results')
  await settle(page)
  for (const d of await closedDialogs(page)) expect(d, d.text).toMatchObject({ display: 'none' })
  // The page underneath takes taps again.
  const views = page.getByRole('group', { name: 'Show competitions as' })
  await views.getByRole('button', { name: 'Calendar' }).click()
  await expect(page).toHaveURL(/view=calendar/)
  await page.getByRole('button', { name: 'Next month' }).click()
  await views.getByRole('button', { name: 'List' }).click()
  await expect(page).not.toHaveURL(/view=/)
})

test('Escape and the backdrop close a sheet; focus goes back to the page', async ({ page }) => {
  await page.goto('/competitions')
  await page.getByRole('button', { name: /^Which competitions/ }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)

  await page.getByRole('button', { name: /^Which competitions/ }).click()
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
    await page.getByRole('button', { name: /^Which competitions/ }).click()
    const sheet = page.getByRole('dialog')
    await expect(sheet).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)
    for (const d of await closedDialogs(page)) expect(d, d.text).toMatchObject({ display: 'none' })
  })
})

test('the More menu opens from the tab bar and its items navigate', async ({ page }, info) => {
  test.skip(info.project.name !== 'phone', 'wide screens have no tab bar or More: see the next test')
  await page.goto('/')
  await appNav(page).getByRole('button', { name: 'More' }).click()
  const menu = page.getByRole('dialog', { name: 'More' })
  await expect(menu).toBeVisible()
  await menu.getByRole('button', { name: 'Judges' }).click()
  await expect(page).toHaveURL(/\/judges$/)
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('heading', { level: 1, name: 'Judges' })).toBeVisible()
  await settle(page)
  for (const d of await closedDialogs(page)) expect(d, d.text).toMatchObject({ display: 'none' })
})

test('on wide screens the More menu’s items are links in the sidebar, with no tab bar', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'phones have the More menu: see the test before')
  await page.goto('/')
  await expect(page.getByRole('navigation', { name: 'App', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'More', exact: true })).toHaveCount(0)
  for (const [name, path] of [
    ['Dancers', /\/dancers$/],
    ['Judges', /\/judges$/],
    ['Pipers', /\/pipers$/],
    ['Venues', /\/venues$/],
    ['Submit a competition', /\/competitions\/submit$/],
    ['About ScotDance.app', /\/about$/],
  ] as const) {
    await appNav(page).getByRole('link', { name, exact: true }).click()
    await expect(page).toHaveURL(path)
    await expect(appNav(page).getByRole('link', { name, exact: true })).toHaveAttribute('aria-current', 'page')
  }
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

  test('the More menu fits on screen and every item can be reached', async ({ page }, info) => {
    test.skip(info.project.name !== 'phone', 'wide screens have no More: see the next test')
    await page.goto('/competitions')
    await appNav(page).getByRole('button', { name: 'More' }).click()
    const menu = page.getByRole('dialog', { name: 'More' })
    await expect(menu).toBeVisible()
    await settle(page)
    const box = (await menu.boundingBox())!
    const viewport = page.viewportSize()!
    expect(box.y).toBeGreaterThanOrEqual(0)
    expect(box.x).toBeGreaterThanOrEqual(0)
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width)
    for (const name of ['Dancers', 'Judges', 'Submit a competition', 'About ScotDance.app']) {
      const item = menu.getByRole('button', { name, exact: true })
      await item.scrollIntoViewIfNeeded()
      await expect(item).toBeInViewport()
    }
  })

  test('the sidebar fits on screen and every item can be reached', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'phones have the More menu: see the test before')
    await page.goto('/competitions')
    const sidebar = page.locator('aside')
    await expect(sidebar).toBeVisible()
    const box = (await sidebar.boundingBox())!
    const viewport = page.viewportSize()!
    expect(box.y).toBeGreaterThanOrEqual(0)
    expect(box.x).toBeGreaterThanOrEqual(0)
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width)
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height)
    for (const name of ['Dancers', 'Judges', 'Submit a competition', 'About ScotDance.app']) {
      const item = appNav(page).getByRole('link', { name, exact: true })
      await item.scrollIntoViewIfNeeded()
      await expect(item).toBeInViewport()
    }
  })
})

test.describe('page changes', () => {
  const countTransitions = async (page: Page) => {
    await page.addInitScript(() => {
      const w = window as Window & { __vt?: number }
      const v = window as Window & { __types?: string[][] }
      w.__vt = 0
      v.__types = []
      const start = document.startViewTransition?.bind(document)
      if (start)
        document.startViewTransition = ((arg: Parameters<typeof start>[0]) => {
          w.__vt = (w.__vt ?? 0) + 1
          v.__types!.push(arg && typeof arg === 'object' ? [...(arg.types ?? [])] : [])
          return start(arg)
        }) as typeof document.startViewTransition
    })
  }

  test('animate between tabs normally', async ({ page }) => {
    await countTransitions(page)
    await page.goto('/competitions')
    await appTab(page, 'Search').click()
    await expect(page).toHaveURL(/\/search$/)
    expect(await page.evaluate(() => (window as Window & { __vt?: number }).__vt)).toBeGreaterThan(0)
  })

  test('move toward the tab you tap, along its bar (or down the sidebar), and Back reverses it', async ({ page }) => {
    await countTransitions(page)
    const axis = hasSidebar(page) ? 'axis-y' : 'axis-x'
    await page.goto('/')
    await appTab(page, 'Search').click()
    await expect(page).toHaveURL(/\/search$/)
    await page.goBack()
    await expect(page).toHaveURL(/\/$/)
    expect(await page.evaluate(() => (window as Window & { __types?: string[][] }).__types)).toEqual([
      ['next', axis],
      ['prev', axis],
    ])
  })

  test('a link in the page goes deeper, from the right; its back button comes back out', async ({ page }) => {
    await countTransitions(page)
    await page.goto('/competitions')
    await page.getByRole('main').getByRole('link', { name: /QA Highland Games/ }).first().click()
    await expect(page).toHaveURL(/\/competitions\/[^/]+\/info$/)
    await page.getByRole('button', { name: /^Back to Competitions/ }).click()
    await expect(page).toHaveURL(/\/competitions$/)
    const types = await page.evaluate(() => (window as Window & { __types?: string[][] }).__types)
    expect(types?.map((t) => t.filter((n) => n === 'forward' || n === 'back'))).toEqual([['forward'], ['back']])
  })

  test.describe('with Reduce Motion', () => {
    test.use({ reducedMotion: 'reduce' })
    test('just change, without a transition', async ({ page }) => {
      await countTransitions(page)
      await page.goto('/competitions')
      await appTab(page, 'Search').click()
      await expect(page).toHaveURL(/\/search$/)
      await appTab(page, 'Home').click()
      await expect(page).toHaveURL(/\/$/)
      expect(await page.evaluate(() => (window as Window & { __vt?: number }).__vt)).toBe(0)
    })
  })
})
