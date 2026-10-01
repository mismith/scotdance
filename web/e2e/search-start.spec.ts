import { expect as baseExpect, test, type Page } from '@playwright/test'
import { dbSet, uid } from './support/emulator'
import { retry } from './support/retry'
import { isoDay, removeCompetition } from './support/seed'

// The dev server is shared and busy during a full run: give page loads time.
const expect = baseExpect.configure({ timeout: 20_000 })

// Search before anything's typed: a way into number search (at today's
// competition when one's on), what you opened lately (clearable), and every
// list to browse. Uses the emulator's legacy data (read only), plus one
// listing dated years ago (each project its own day, shown as today via ?now=).

const section = (page: Page, heading: string) =>
  page.locator('section').filter({ has: page.getByRole('heading', { level: 2, name: new RegExp(`^${heading}`) }) })

test('browse opens each list', async ({ page }) => {
  for (const [label, path] of [
    ['Competitions', '/competitions'],
    ['Dancers', '/dancers'],
    ['Judges', '/judges'],
    ['Pipers', '/pipers'],
    ['Venues', '/venues'],
  ]) {
    await page.goto('/search')
    await section(page, 'Browse').getByRole('link', { name: label }).click()
    await expect(page).toHaveURL(new RegExp(`${path}$`))
    await expect(page.getByRole('heading', { level: 1, name: label })).toBeVisible()
  }
})

test('competitions, people and venues you opened come back, newest first', async ({ page }) => {
  const visits = [
    { path: '/judges/-OsoH2I8uTd5UQHwDum4/info', name: 'Aileen Robertson', kind: 'Judge' },
    { path: '/competitions/-L9Sc9TQWQclq_7oA3ij/info', name: 'Nationals', kind: 'Competition' },
    { path: '/venues/-OsoH8n0XvjuN0nhsvMu/info', name: 'Calgary Life Church', kind: 'Venue' },
    { path: '/dancers/-OsoHXgf8ThIQ81eayjM/info', name: 'Oriana Knowles', kind: 'Dancer' },
  ]
  for (const v of visits) {
    await page.goto(v.path)
    await expect(page.getByRole('heading', { level: 1, name: v.name })).toBeVisible()
  }
  await page.goto('/search')
  const rows = section(page, 'Recently viewed').getByRole('link')
  await expect(rows).toHaveCount(4)
  for (const [i, v] of [...visits].reverse().entries()) {
    await expect(rows.nth(i)).toContainText(v.name)
    await expect(rows.nth(i)).toContainText(v.kind)
  }
  // A competition shows its date: the year, for one that's over.
  await expect(rows.filter({ hasText: 'Nationals' })).toContainText('2019')

  await rows.filter({ hasText: 'Nationals' }).click()
  await expect(page).toHaveURL(/\/competitions\/-L9Sc9TQWQclq_7oA3ij\/info$/)
})

test('Clear empties Recently viewed, on Search, Home and the Dancers list alike', async ({ page }) => {
  const dancer = async () => {
    await page.goto('/dancers/-OsoHXgf8ThIQ81eayjM/info')
    await expect(page.getByRole('heading', { level: 1, name: 'Oriana Knowles' })).toBeVisible()
  }
  await dancer()
  await page.goto('/competitions/-L9Sc9TQWQclq_7oA3ij/info')
  await expect(page.getByRole('heading', { level: 1, name: 'Nationals' })).toBeVisible()

  // From Search: everything goes, and Home (nobody followed) has nothing to show.
  await page.goto('/search')
  await section(page, 'Recently viewed').getByRole('button', { name: 'Clear' }).click()
  await expect(section(page, 'Recently viewed')).toHaveCount(0)
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'See your dancer’s day at a glance' })).toBeVisible()
  await expect(page.getByRole('heading', { name: /^Recently viewed/ })).toHaveCount(0)

  // From Home.
  await dancer()
  await page.goto('/')
  await page.getByRole('button', { name: 'Clear recently viewed' }).click()
  await expect(page.getByRole('heading', { name: /^Recently viewed/ })).toHaveCount(0)
  await page.goto('/search')
  await expect(section(page, 'Recently viewed')).toHaveCount(0)

  // From the Dancers list.
  await dancer()
  await page.goto('/dancers')
  await section(page, 'Recently viewed').getByRole('button', { name: 'Clear' }).click()
  await expect(section(page, 'Recently viewed')).toHaveCount(0)
})

test.describe('the number card', () => {
  test.describe.configure({ mode: 'serial' })
  const id = uid('ss-today')
  const name = `Start Today Games ${id.slice(-5)}`
  let day = ''

  test.beforeAll(async ({}, info) => {
    const anchor = -(info.project.name === 'phone' ? 5700 : 5000) - Math.floor(Math.random() * 300)
    day = isoDay(anchor)
    await retry(() => dbSet(`competitions/${id}`, { name, date: day, location: 'Halifax, NS', country: 'CA', published: true, listed: true }))
    await retry(() => dbSet(`competitions:published/${id}`, true))
  })
  test.afterAll(async () => {
    await retry(() => removeCompetition(id))
  })

  test('with a competition on today, opens number search there', async ({ page }) => {
    await page.goto(`/search?now=${day}`)
    const card = page.getByRole('button', { name: new RegExp(`Today.*${name}.*Find a dancer by the number on their card`) })
    await card.click()
    await expect(page).toHaveURL(new RegExp(`[?&]by=number.*[?&]in=${id}(&|$)`))
    await expect(page.getByRole('radiogroup', { name: 'Looking in' }).getByRole('radio', { checked: true })).toContainText(name)
    await expect(page.getByRole('textbox', { name: 'Number on their card' })).toBeFocused()
  })

  test('with nothing on, still offers number search', async ({ page }) => {
    await page.goto('/search?now=2031-02-01')
    await page.getByRole('button', { name: /Know the number on their card\? Search by number instead\./ }).click()
    await expect(page).toHaveURL(/[?&]by=number/)
    await expect(page.getByText('No competitions on right now')).toBeVisible()
  })
})
