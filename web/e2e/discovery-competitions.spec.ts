import { expect as baseExpect, test, type Page } from '@playwright/test'
import { dbRemove, dbUpdate, uid } from './support/emulator'
import { removeCompetition, seedCompetition, type SeededCompetition } from './support/seed'
import { retry } from './support/retry'

// The dev server is shared and busy during a full run: give page loads time.
const expect = baseExpect.configure({ timeout: 15_000 })

// Competitions: Upcoming / Past results, list, calendar and map, and where
// to look. One small set of competitions is seeded for the whole file.

// A Canadian visitor (the location filter guesses the country from the zone).
test.use({ timezoneId: 'America/Edmonton' })
test.describe.configure({ mode: 'serial' })

const tag = uid('disc').slice(-5)
let noCountry: SeededCompetition // in 3 days, no country yet
let twoDay: SeededCompetition // started yesterday, on today too
let oneDay: SeededCompetition // yesterday only
let today: SeededCompetition // today, Canada
let aussie: SeededCompetition // in 4 days, Australia

test.beforeAll(async () => {
  const small = { dancersPerGroup: 1, resultsForGroups: 0 }
  noCountry = await retry(() => seedCompetition({ ...small, id: `disc-nocountry-${tag}`, startOffset: 3, name: `No Country Games ${tag}` }))
  await retry(() => dbUpdate(`competitions/${noCountry.id}`, { country: null, region: null, locality: null }))
  twoDay = await retry(() => seedCompetition({ ...small, id: `disc-twoday-${tag}`, startOffset: -1, name: `Two Day Games ${tag}` }))
  oneDay = await retry(() => seedCompetition({ ...small, id: `disc-oneday-${tag}`, startOffset: -1, name: `One Day Games ${tag}` }))
  await retry(() => dbRemove(`competitions:data/${oneDay.id}/schedule/days/${oneDay.id}-day2`))
  today = await retry(() => seedCompetition({ ...small, id: `disc-today-${tag}`, startOffset: 0, name: `Today Games ${tag}` }))
  aussie = await retry(() => seedCompetition({ ...small, id: `disc-aussie-${tag}`, startOffset: 4, name: `Aussie Games ${tag}` }))
  await retry(() => dbUpdate(`competitions/${aussie.id}`, { country: 'AU', region: 'QLD', locality: 'Brisbane', location: 'Brisbane, QLD' }))
})

test.afterAll(async () => {
  // By id, so a half-finished seed is cleaned up too.
  for (const kind of ['nocountry', 'twoday', 'oneday', 'today', 'aussie']) await retry(() => removeCompetition(`disc-${kind}-${tag}`))
})

const row = (page: Page, c: SeededCompetition) => page.getByRole('link', { name: new RegExp(c.name) })
const section = (page: Page, label: string | RegExp) =>
  page.locator('section').filter({ has: page.getByRole('heading', { level: 2, name: label }) })

async function show(page: Page, range: 'Upcoming' | 'Past results') {
  const button = page.getByRole('group', { name: 'Which competitions' }).getByRole('button', { name: range })
  await button.click()
  await expect(button).toHaveAttribute('aria-pressed', 'true')
}

test('a competition without a country still shows with the guessed country filter on', async ({ page }) => {
  await page.goto('/competitions')
  await expect(page.getByRole('button', { name: /^Location: CA/ })).toBeVisible()
  await expect(row(page, noCountry)).toBeVisible()
})

test('day 2 of a two-day competition is still Today, not Past results', async ({ page }) => {
  await page.goto('/competitions')
  await show(page, 'Upcoming')
  await expect(section(page, 'Today').getByRole('link', { name: new RegExp(twoDay.name) })).toBeVisible()
  await expect(section(page, 'Today').getByRole('link', { name: new RegExp(today.name) })).toBeVisible()
  await show(page, 'Past results')
  await expect(row(page, oneDay)).toBeVisible()
  await expect(row(page, twoDay)).toHaveCount(0)
})

test('a one-day competition from yesterday is under Past results only', async ({ page }) => {
  await page.goto('/competitions')
  await show(page, 'Upcoming')
  await expect(row(page, twoDay)).toBeVisible()
  await expect(row(page, oneDay)).toHaveCount(0)
})

test('the calendar shows today’s competitions and moves between months', async ({ page }) => {
  await page.goto('/competitions?view=calendar')
  await expect(row(page, today)).toBeVisible()
  const month = page.getByRole('heading', { level: 2 }).first()
  const thisMonth = (await month.textContent()) ?? ''
  await page.getByRole('button', { name: 'Next month' }).click()
  await expect(month).not.toHaveText(thisMonth)
  await page.getByRole('button', { name: 'Today', exact: true }).click()
  await expect(month).toHaveText(thisMonth)
  await expect(row(page, today)).toBeVisible()
})

test('the map loads its worker and puts competitions on it, without errors', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/competitions?view=map')
  await expect(page.locator('.maplibregl-canvas')).toBeVisible()
  await expect(page.locator('.map-pin, .map-cluster').first()).toBeAttached()
  // Switching to Past results and back redraws without trouble.
  await show(page, 'Past results')
  await expect(page.locator('.maplibregl-canvas')).toBeVisible()
  await show(page, 'Upcoming')
  await expect(page.locator('.map-pin, .map-cluster').first()).toBeAttached()
  expect(errors).toEqual([])
})

test('a view mode in a shared link opens in that mode', async ({ page }) => {
  await page.goto('/competitions?view=calendar')
  await expect(page.getByRole('button', { name: 'Show as Calendar' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Previous month' })).toBeVisible()
})

test('Everywhere shows every country; a country narrows it', async ({ page }) => {
  await page.goto('/competitions')
  await expect(row(page, today)).toBeVisible()
  await expect(row(page, aussie)).toHaveCount(0)

  await page.getByRole('button', { name: /^Location:/ }).click()
  await page.waitForTimeout(400)
  await page.getByRole('dialog').getByRole('radio', { name: 'Everywhere' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(row(page, aussie)).toBeVisible()
  await expect(row(page, today)).toBeVisible()

  await page.getByRole('button', { name: /^Location:/ }).click()
  await page.waitForTimeout(400)
  await page.getByRole('dialog').getByRole('radio', { name: 'Australia' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Done' }).click()
  await expect(row(page, aussie)).toBeVisible()
  await expect(row(page, today)).toHaveCount(0)
})

test('a competition in the list opens its page', async ({ page }) => {
  await page.goto('/competitions')
  await row(page, today).click()
  await expect(page).toHaveURL(new RegExp(`/competitions/${today.id}/info$`))
  await expect(page.getByText(today.name).first()).toBeVisible()
})

test('the calendar goes back past the last three months', async ({ page }) => {
  // Pretend it's May 2019: Nationals (14 Jan 2019) is four months back.
  await page.goto('/competitions?now=2019-05-14')
  await show(page, 'Upcoming')
  await page.goto('/competitions?view=calendar')
  const month = page.getByRole('heading', { level: 2 }).first()
  await expect(month).toHaveText(/2019/)
  for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'Previous month' }).click()
  await expect(month).toHaveText(/January 2019/)
  await page.getByRole('button', { name: /January 14, 2019, 1 competition/ }).click()
  await expect(page.getByRole('link', { name: /Nationals/ })).toBeVisible()
})
