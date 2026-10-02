import { expect, test, type Page } from '@playwright/test'
import { dbSet, dbUpdate, ensureUser, grantCompetition, grantSystemAdmin, uid } from './support/emulator'
import { removeCompetition, seedCompetition, type SeededCompetition } from './support/seed'
import { signInFromSheet } from './support/parent'

// A competition's public pages: what the Overview shows, hidden tabs,
// unpublished competitions, and the biggest real ones.

let comp: SeededCompetition
test.beforeAll(async () => {
  comp = await seedCompetition({ dancersPerGroup: 1, startOffset: 9 })
})
test.afterAll(async () => {
  await removeCompetition(comp.id)
})

async function signInAs(page: Page, email: string) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await signInFromSheet(page, email)
}

test('links and files show on the Overview, in order, skipping any with no address', async ({ page }) => {
  await dbUpdate(`competitions/${comp.id}`, {
    links: {
      '-b': { name: 'Program', url: 'example.com/program.pdf', _order: 1 },
      '-a': { name: 'Entry form', url: 'https://example.com/entry', _order: 0 },
      '-c': { name: 'No address' },
      '-d': {
        url: 'https://firebasestorage.googleapis.com/v0/b/x/o/development%2Fcompetitions%2Flinks%2FDay%20schedule.pdf?alt=media&token=t',
      },
    },
    registrationURL: 'example.com/register',
    registrationStart: '',
    registrationEnd: new Date(Date.now() + 3 * 86_400_000).toISOString(),
  })
  await page.goto(`/competitions/${comp.id}/info`)
  // (Not the map apps in the Directions menu.)
  const links = page.locator('main a[target=_blank]:not(dialog *)')
  await expect(links).toHaveText(['Register', 'Entry form', 'Program', 'Day schedule.pdf'])
  await expect(links.nth(2)).toHaveAttribute('href', 'https://example.com/program.pdf')
  await expect(page.getByText('No address')).toHaveCount(0)
  await expect(page.getByText(/^Registration closes /)).toBeVisible()
  await expect(page.getByText(/^Registration open/)).toHaveCount(0)

  // Registration closed: still says when, and Register is greyed out.
  await dbUpdate(`competitions/${comp.id}`, { registrationEnd: '2020-01-01T07:00:00.000Z' })
  // (Not waiting for "load": that waits for the map's tiles too.)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(page.getByText(/^Registration closed /)).toBeVisible()
  await expect(page.getByRole('link', { name: 'Register' })).toHaveAttribute('aria-disabled', 'true')
})

test('following no one here, the Overview finds your dancer by name or number', async ({ page }) => {
  const d = comp.dancers[3]
  await page.goto(`/competitions/${comp.id}/info`)
  await expect(page.getByText('Is your dancer here?')).toBeVisible()
  const find = page.getByRole('searchbox', { name: 'Find your dancer by name or number' })
  await find.fill(d.number)
  const match = page.getByRole('link', { name: new RegExp(`${d.firstName} ${d.lastName}`) })
  await expect(match).toBeVisible()
  await find.fill('zzqx')
  await expect(page.getByText('No dancer matches “zzqx”.', { exact: false })).toBeVisible()
})

test('Directions offers the map apps and copies the address; the map opens full size', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.goto(`/competitions/${comp.id}/info`)
  await page.getByRole('button', { name: 'Directions' }).click()
  const menu = page.getByRole('dialog', { name: 'Directions' })
  await expect(menu.getByRole('link', { name: 'Google Maps' })).toHaveAttribute('href', /google\.com\/maps\/dir\/.*destination=Spruce%20Meadows/)
  await menu.getByRole('button', { name: 'Copy address' }).click()
  await expect(menu.getByRole('button', { name: 'Address copied' })).toBeVisible()
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('Spruce Meadows, 18011 Spruce Meadows Way SW, Calgary, AB')
  await expect(page.locator('dialog[open]')).toHaveCount(0)

  await page.getByRole('button', { name: 'Show the map' }).click()
  const sheet = page.locator('dialog[open]')
  await expect(sheet.getByRole('heading', { name: 'Spruce Meadows' })).toBeVisible()
  await expect(sheet.getByRole('link', { name: 'Google Maps' })).toBeVisible()
})

test('an event’s rows open the dancing order, posted ones add Results, and judges say what they judge', async ({ page }) => {
  await page.goto(`/competitions/${comp.id}/schedule/${comp.id}-day1/${comp.id}-b1/${comp.id}-e1`)
  await page.getByRole('button', { name: /^Primary Under 7/ }).first().click()
  const sheet = page.locator('dialog[open]')
  await expect(sheet.getByText('Dancing order')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(sheet).toHaveCount(0)

  await page.getByRole('button', { name: /Aileen Robertson/ }).first().click()
  await expect(sheet.getByText(/Judging here/).locator('..')).toContainText('Platform A · Highland Fling (4), Sword Dance (2&1)')
  await page.keyboard.press('Escape')

  await page.getByRole('link', { name: 'Primary Under 7 results' }).first().click()
  await expect(page).toHaveURL(new RegExp(`/results/${comp.id}-grp-00#dance-`))
})

test('a Ceilidh or reception in the schedule says what it is, with no page to open', async ({ page }) => {
  const path = `competitions:data/${comp.id}/schedule/days/${comp.id}-day1/blocks/${comp.id}-b2/events/${comp.id}-e9`
  await dbSet(path, { order: 1, name: 'Ceilidh', description: 'Everyone welcome in the main hall.' })
  try {
    await page.goto(`/competitions/${comp.id}/schedule`)
    await expect(page.getByText('Everyone welcome in the main hall.')).toBeVisible()
    await expect(page.getByRole('link', { name: /Ceilidh/ })).toHaveCount(0)
  } finally {
    await dbSet(path, null)
  }
})

test('hidden Schedule and Results tabs go from the bar, and their links say why', async ({ page }) => {
  await dbSet(`competitions:data/${comp.id}/schedule`, false)
  await dbSet(`competitions:data/${comp.id}/results`, false)
  try {
    await page.goto(`/competitions/${comp.id}/info`)
    const bar = page.getByRole('navigation', { name: 'Competition' })
    await expect(bar.getByRole('link', { name: 'Dancers' })).toBeVisible()
    await expect(bar.getByRole('link', { name: 'Schedule' })).toHaveCount(0)
    await expect(bar.getByRole('link', { name: 'Results' })).toHaveCount(0)

    await page.goto(`/competitions/${comp.id}/schedule`)
    await expect(page.getByText('No schedule here')).toBeVisible()
    await expect(page.getByText('Check with the organisers.', { exact: false })).toBeVisible()
    await page.goto(`/competitions/${comp.id}/results`)
    await expect(page.getByText('No results here')).toBeVisible()
  } finally {
    await dbSet(`competitions:data/${comp.id}/schedule`, null)
    await dbSet(`competitions:data/${comp.id}/results`, null)
  }
})

test.describe('a listed competition, not yet published', () => {
  let listed: SeededCompetition
  test.beforeAll(async () => {
    listed = await seedCompetition({ dancersPerGroup: 1, published: false, listed: true, startOffset: 21 })
  })
  test.afterAll(async () => {
    await removeCompetition(listed.id)
  })

  test('shows in the list and its overview, judges and all; the rest waits for publishing', async ({ page }) => {
    await page.goto('/competitions')
    await expect(page.getByRole('link', { name: new RegExp(listed.name) })).toBeVisible()

    await page.goto(`/competitions/${listed.id}/info`)
    await expect(page.getByRole('heading', { name: listed.name, level: 1 })).toBeVisible()
    await expect(page.getByText('Dancers, the schedule and results show here once they’re published.')).toBeVisible()
    await expect(page.getByText('Aileen Robertson').first()).toBeVisible()
    await expect(page.getByText('Is your dancer here?')).toHaveCount(0)

    await page.goto(`/competitions/${listed.id}/dancers`)
    await expect(page.getByRole('main').getByText('Not published yet', { exact: true })).toBeVisible()
    await expect(page.getByText(`${listed.dancers[0].firstName} ${listed.dancers[0].lastName}`)).toHaveCount(0)
  })
})

test.describe('a private competition (neither listed nor published)', () => {
  let hidden: SeededCompetition
  test.beforeAll(async () => {
    hidden = await seedCompetition({ dancersPerGroup: 1, published: false, listed: false, startOffset: 20 })
  })
  test.afterAll(async () => {
    await removeCompetition(hidden.id)
  })

  test('isn’t found signed out, or by someone who doesn’t run it', async ({ page }) => {
    await page.goto(`/competitions/${hidden.id}/info`)
    await expect(page.getByText('Competition not found')).toBeVisible()
    await signInAs(page, await newUser())
    await page.goto(`/competitions/${hidden.id}/dancers`)
    await expect(page.getByText('Competition not found')).toBeVisible()
  })

  test('opens for its organiser straight away, without a "not found" first', async ({ page }) => {
    const email = `${uid('org')}@example.test`
    await grantCompetition(await ensureUser(email), hidden.id)
    await signInAs(page, email)
    // Note any moment the page says "not found".
    await page.addInitScript(() => {
      const w = window as unknown as { sawNotFound: boolean }
      w.sawNotFound = false
      new MutationObserver(() => {
        if (document.body?.innerText.includes('Competition not found')) w.sawNotFound = true
      }).observe(document, { subtree: true, childList: true, characterData: true })
    })
    await page.goto(`/competitions/${hidden.id}/info`)
    await expect(page.getByRole('heading', { name: hidden.name, level: 1 })).toBeVisible()
    await page.goto(`/competitions/${hidden.id}/dancers`)
    await expect(page.getByRole('heading', { name: /Dancers/, level: 1 })).toBeVisible()
    expect(await page.evaluate(() => (window as unknown as { sawNotFound: boolean }).sawNotFound)).toBe(false)
  })
})

async function newUser() {
  const email = `${uid('parent')}@example.test`
  await ensureUser(email)
  return email
}

test.describe('the biggest competitions', () => {
  test.setTimeout(90_000)

  test('Nationals: 1,091 dancers list, search and sort quickly', async ({ page }) => {
    const started = Date.now()
    await page.goto('/competitions/-L9Sc9TQWQclq_7oA3ij/dancers')
    const rows = page.locator('main ul > li')
    await expect(rows.first()).toBeVisible({ timeout: 20_000 })
    const shown = Date.now() - started
    await expect(page.getByRole('heading', { level: 1 })).toContainText('1091')
    const search = page.getByRole('searchbox', { name: 'Search dancers by name or number' })
    let t = Date.now()
    await search.fill('Thow')
    await expect(page.locator('main ul > li').filter({ hasText: 'Rebecca Thow' }).first()).toBeVisible()
    const searched = Date.now() - t
    await search.fill('11')
    await expect(rows.first()).toContainText('11')
    t = Date.now()
    await page.getByRole('button', { name: /^Sort by/ }).click()
    await page.getByRole('radio', { name: 'Last name' }).click()
    await search.fill('')
    await expect(page.locator('main h2').first()).toHaveText(/^[A-Z]\s*\d+$/)
    const sorted = Date.now() - t
    console.log(`Nationals dancers: shown ${shown}ms, search ${searched}ms, sort ${sorted}ms`)
    expect(searched).toBeLessThan(3000)
    expect(sorted).toBeLessThan(3000)
  })

  test('SDCCS2025 (1,243 dancers, unpublished, schedule hidden) opens for a system admin', async ({ page }) => {
    const email = `${uid('admin')}@example.test`
    await grantSystemAdmin(await ensureUser(email))
    await signInAs(page, email)
    await page.goto('/competitions/-OUSSlB1Yj8e57t9co0R/dancers')
    await expect(page.getByRole('heading', { level: 1 })).toContainText('1243', { timeout: 20_000 })
    const bar = page.getByRole('navigation', { name: 'Competition' })
    await expect(bar.getByRole('link', { name: 'Results' })).toBeVisible()
    await expect(bar.getByRole('link', { name: 'Schedule' })).toHaveCount(0)
    await page.goto('/competitions/-OUSSlB1Yj8e57t9co0R/info')
    // No date yet: no "Today", no crash.
    await expect(page.getByRole('heading', { name: 'SDCCS2025 tester', level: 1 })).toBeVisible()
  })
})

test.describe('sharing a page', () => {
  test.beforeEach(async ({ context, page }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    // No share sheet here: the link is copied instead.
    await page.addInitScript(() => Object.defineProperty(navigator, 'share', { value: undefined }))
  })

  test('copies the page’s link on the web', async ({ page }) => {
    await page.goto(`/competitions/${comp.id}/info`)
    await page.getByRole('button', { name: 'Share this page' }).click()
    await expect(page.getByRole('button', { name: 'Link copied' })).toBeVisible()
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(page.url())
  })

  test('shares the website’s address from the app, not the app’s own', async ({ page }) => {
    await page.addInitScript(() => {
      ;(window as unknown as { Capacitor: unknown }).Capacitor = { getPlatform: () => 'ios', Plugins: {} }
    })
    await page.goto(`/competitions/${comp.id}/info`)
    await page.getByRole('button', { name: 'Share this page' }).click()
    await expect(page.getByRole('button', { name: 'Link copied' })).toBeVisible()
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      `https://scotdance.app/competitions/${comp.id}/info`,
    )
  })
})
