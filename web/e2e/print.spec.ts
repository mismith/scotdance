import { expect, test, type Page } from '@playwright/test'
import { dbSet, ensureUser, grantCompetition, signIn, uid } from './support/emulator'
import { retry } from './support/retry'
import { removeCompetition, seedCompetition, type SeededCompetition } from './support/seed'

// Manage › Print: documents laid out from what's in Manage, measured and
// packed into pages so the preview is what prints. Only the pages go to
// paper; each also downloads as a Word file to edit.

test.describe.configure({ mode: 'default' })

let comp: SeededCompetition
let email: string

test.beforeAll(async () => {
  comp = await retry(() => seedCompetition({ id: uid('comp'), dancersPerGroup: 6, resultsForGroups: 2 }))
  email = `${uid('org')}@example.test`
  const user = await ensureUser(email)
  await retry(() => grantCompetition(user, comp.id))
})
test.afterAll(async () => {
  if (comp) await retry(() => removeCompetition(comp.id))
})

const preview = (page: Page) => page.getByRole('region', { name: 'Preview' })
const pageCount = (page: Page) => page.getByText(/^\d+ pages? · (Letter|A4)$/)
async function pagesShown(page: Page) {
  await expect(pageCount(page)).toBeVisible()
  return Number((await pageCount(page).textContent())!.match(/\d+/)![0])
}

test('the program: cover, each session’s grid then its age groups, a championship’s draw before its grid to fill in', async ({ page }) => {
  await signIn(page, email)
  await page.goto(`/competitions/${comp.id}/manage/print`)
  const pages = await pagesShown(page)
  expect(pages).toBeGreaterThan(4)

  const shown = preview(page)
  await expect(shown.getByRole('heading', { name: comp.name, exact: true })).toBeVisible()
  // A session's grid: its time, the judge in each platform's cell, the age groups (no entry counts).
  await expect(shown.getByRole('heading', { name: 'Saturday · Morning', exact: true })).toBeVisible()
  await expect(shown.getByText('A. Robertson').first()).toBeVisible()
  await expect(shown.getByText('Beginner 7 & 8 Years', { exact: true }).first()).toBeVisible()
  await expect(shown.getByText('Beginner 7 & 8 Years (6)')).toHaveCount(0)
  // An age group: its dancers and an empty grid with six places to write in.
  const first = comp.dancers[0]
  await expect(shown.getByText(`${first.firstName} ${first.lastName}`).first()).toBeVisible()
  await expect(shown.getByRole('columnheader', { name: '6th' }).first()).toBeVisible()
  await expect(shown.getByText('Overall winner', { exact: true }).first()).toBeVisible()
  // Its draw differs dance by dance, so it comes first, as its Draw.
  const group = comp.groups.find((g) => g.categoryId.endsWith('-cat-beg'))!
  const blocks = shown.locator('section').filter({ has: page.getByRole('heading', { name: `Beginner ${group.name}`, exact: true }) })
  await expect(blocks.first()).toContainText('Draw')
  await expect(blocks.nth(1)).toContainText(/\d+ dancers/)

  // Page numbers at the foot.
  await expect(shown.locator('footer').first()).toHaveText('2')

  // Paper size and places, rarely changed, are in the ⋯ menu.
  // (Each pick waits for the menu to finish closing before it opens again.)
  const option = async (name: string) => {
    await page.getByRole('button', { name: 'Print options' }).click()
    await page.getByRole('button', { name, exact: true }).click()
    await expect(page.getByRole('dialog', { name: 'Print options' })).toBeHidden()
  }
  await option('A4')
  await expect(pageCount(page)).toHaveText(/ · A4$/)
  await option('Up to 10')
  await option('Letter')
  await option('Up to 6')

  // Printing puts just the pages, as previewed, on paper.
  await expect(pageCount(page)).toHaveText(`${pages} pages · Letter`)
  await page.evaluate(() => (window.print = () => {}))
  await page.getByRole('main').getByRole('button', { name: 'Print', exact: true }).click()
  await expect(page.locator('[data-print-root] > div')).toHaveCount(pages)
  await page.emulateMedia({ media: 'print' })
  await expect(page.locator('#app')).toBeHidden()
  await expect(page.locator('[data-print-root]')).toBeVisible()
  await page.emulateMedia({ media: 'screen' })
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')))
  await expect(page.locator('[data-print-root]')).toHaveCount(0)

  // The browser's own Print (⌘P) prints the pages too, not the screen.
  await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')))
  await expect(page.locator('[data-print-root] > div')).toHaveCount(pages)
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')))
  await expect(page.locator('[data-print-root]')).toHaveCount(0)
})

test('before you print: a dancer with no age group is flagged, with a way to fix it', async ({ page }) => {
  // (No number, so she's only in the check under test.)
  const stray = `${comp.id}-stray-${test.info().project.name}`
  await retry(() => dbSet(`competitions:data/${comp.id}/dancers/${stray}`, { firstName: 'Una', lastName: 'Placed' }))
  await signIn(page, email)
  await page.goto(`/competitions/${comp.id}/manage/print`)
  const fix = page.getByRole('link', { name: /dancers? (has|have) no age group/ })
  await expect(fix).toBeVisible()
  await fix.click()
  await expect(page).toHaveURL(/\/manage\/dancers\/.+-stray-/)
  await retry(() => dbSet(`competitions:data/${comp.id}/dancers/${stray}`, null))
})

test('platform sheets: one per platform, numbers in the order they dance', async ({ page }) => {
  await signIn(page, email)
  await page.goto(`/competitions/${comp.id}/manage/print/day`)
  await pagesShown(page)
  const shown = preview(page)
  await expect(shown.getByText('For the judge, steward, announcer and piper: numbers in the order they dance.').first()).toBeVisible()
  await expect(shown.getByRole('columnheader', { name: 'Order', exact: true }).first()).toBeVisible()
})

test('downloading a document as a Word file', async ({ page }) => {
  await signIn(page, email)
  await page.goto(`/competitions/${comp.id}/manage/print`)
  await pagesShown(page)
  const [file] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download for Word, Docs or Pages' }).click()])
  expect(file.suggestedFilename()).toBe(`${comp.name} program.docx`)
  const chunks: Buffer[] = []
  for await (const chunk of await file.createReadStream()) chunks.push(chunk as Buffer)
  // A Word file is a zip: it starts "PK".
  expect(Buffer.concat(chunks).subarray(0, 2).toString()).toBe('PK')
})
