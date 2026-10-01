import { expect as baseExpect, test, type Page } from '@playwright/test'
import { uid } from './support/emulator'
import { retry } from './support/retry'
import { removeCompetition, seedCompetition, type SeededCompetition } from './support/seed'

// The dev server is shared and busy during a full run: give page loads time.
const expect = baseExpect.configure({ timeout: 20_000 })

// Search (Typesense through the searchAll function): by name across every
// competition, and by number within one. By-name tests use the emulator's
// legacy data (read only); by-number seeds one small competition.

const searchBox = (page: Page) => page.getByRole('searchbox', { name: 'Search' })
const results = (page: Page, heading: string) =>
  page.locator('section').filter({ has: page.getByRole('heading', { level: 2, name: new RegExp(`^${heading}\\b`) }) })

async function search(page: Page, q: string) {
  await page.goto('/search')
  await searchBox(page).fill(q)
}

test('finds a dancer by name and opens their page', async ({ page }) => {
  await search(page, 'oriana knowles')
  const row = results(page, 'Dancers').getByRole('button', { name: /Oriana Knowles/ })
  await expect(row).toBeVisible()
  await expect(page).toHaveURL(/\/search\?q=oriana/)
  await row.click()
  await expect(page).toHaveURL(/\/dancers\/[^/]+\/info$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Oriana Knowles' })).toBeVisible()
  // Back returns to the same search, and the button says so.
  const back = page.getByRole('button', { name: 'Back to Search' })
  await expect(back).toBeVisible()
  await back.click()
  await expect(page).toHaveURL(/\/search\?q=oriana/)
  await expect(searchBox(page)).toHaveValue('oriana knowles')
})

test('finds a judge and a competition', async ({ page }) => {
  await search(page, 'aileen robertson')
  await results(page, 'Judges').getByRole('button', { name: /Aileen Robertson/ }).click()
  await expect(page).toHaveURL(/\/judges\/[^/]+\/info$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Aileen Robertson' })).toBeVisible()

  await search(page, 'nationals')
  await results(page, 'Competitions').getByRole('link', { name: /Nationals/ }).first().click()
  await expect(page).toHaveURL(/\/competitions\/-L9Sc9TQWQclq_7oA3ij\/info$/)
})

test('finds a venue and opens its page', async ({ page }) => {
  await search(page, 'telus')
  await results(page, 'Places').getByRole('button', { name: /Telus Convention Centre/ }).first().click()
  await expect(page).toHaveURL(/\/venues\/[^/]+\/info$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Telus Convention Centre' })).toBeVisible()
})

test('finds a town and shows its competitions', async ({ page }) => {
  await search(page, 'calgary')
  // The town (venues named after it, like Calgary Life Church, show too).
  await expect(results(page, 'Places').getByRole('button', { name: /^Calgary AB\b/ })).toBeVisible()
})

test('says so when nothing matches', async ({ page }) => {
  await search(page, 'zzzzqqqxx')
  await expect(page.getByText('Nothing matches “zzzzqqqxx”. Check the spelling, or try just a first or last name.')).toBeVisible()
})

test('odd characters are searched as text, never break the page', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  await page.goto('/search')
  for (const q of ['O’Neill', 'Ó Briain', '<img src=x onerror=alert(1)>', '100%', 'a\\b', '"quoted"', '#12', '   ']) {
    await searchBox(page).fill(q)
    await page.waitForTimeout(600)
    await expect(page.getByRole('heading', { level: 1, name: 'Search' })).toBeVisible()
  }
  await expect(page.locator('img[src="x"]')).toHaveCount(0)
  expect(errors).toEqual([])
})

test('remembers recent searches until cleared', async ({ page }) => {
  await search(page, 'Oriana')
  await expect(results(page, 'Dancers')).toBeVisible()
  // Recorded once typing pauses.
  await page.waitForTimeout(2500)
  await page.getByRole('button', { name: 'Clear search' }).click()
  const recent = results(page, 'Recent')
  await expect(recent.getByRole('button', { name: 'Oriana' })).toBeVisible()
  await recent.getByRole('button', { name: 'Oriana' }).click()
  await expect(searchBox(page)).toHaveValue('Oriana')
  await page.getByRole('button', { name: 'Clear search' }).click()
  await recent.getByRole('button', { name: 'Clear' }).click()
  await expect(results(page, 'Recent')).toHaveCount(0)
})

test.describe('by number', () => {
  test.describe.configure({ mode: 'serial' })
  let comp: SeededCompetition
  const id = uid('search')
  test.beforeAll(async () => {
    comp = await retry(() => seedCompetition({ id, dancersPerGroup: 2, resultsForGroups: 0, startOffset: 0 }))
  })
  test.afterAll(async () => {
    await retry(() => removeCompetition(id))
  })

  test('finds a dancer by the number on their card', async ({ page }) => {
    const dancer = comp.dancers[0]
    // Choosing the competition is search-number.spec's job: a link picks it here.
    await page.goto(`/search?by=number&in=${comp.id}`)
    await page.getByRole('textbox', { name: 'Number on their card' }).fill(dancer.number)
    const row = page.getByRole('link', { name: new RegExp(`${dancer.firstName} ${dancer.lastName}`) })
    await expect(row).toBeVisible()
    await row.click()
    await expect(page).toHaveURL(new RegExp(`/competitions/${comp.id}/dancers/${dancer.id}$`))
  })

  test('only digits go in, and an unknown number says so', async ({ page }) => {
    await page.goto(`/search?by=number&in=${comp.id}`)
    const input = page.getByRole('textbox', { name: 'Number on their card' })
    await input.pressSequentially('9x9a9')
    await expect(input).toHaveValue('999')
    await expect(page.getByText(`No dancer with number 999 at ${comp.name}.`)).toBeVisible()
  })
})

test('with no competition on around now, number search says so and offers name search', async ({ page }) => {
  await page.goto('/search?by=number&now=2031-02-01')
  await expect(page.getByText('No competitions on right now')).toBeVisible()
  await page.getByRole('button', { name: 'Search by name' }).click()
  await expect(searchBox(page)).toBeFocused()
})

test('the address keeps the search mode, so a reload stays put', async ({ page }) => {
  await page.goto('/search')
  const by = page.getByRole('group', { name: 'Search by' })
  await by.getByRole('button', { name: 'By number' }).click()
  await expect(page).toHaveURL(/[?&]by=number/)
  await page.reload()
  await expect(by.getByRole('button', { name: 'By number' })).toHaveAttribute('aria-pressed', 'true')
  await by.getByRole('button', { name: 'By name' }).click()
  await expect(page).not.toHaveURL(/by=|in=/)
})
