import { expect, test, type Page } from '@playwright/test'
import { dbGet } from './support/emulator'
import { removeCompetition } from './support/seed'
import { retry } from './support/retry'
import { collectErrors, expectDb, navigate, seedEmptyCompetition, signInOrganiser, toastUndo } from './support/manageData'

// Manage › Details as an organiser: the basics, dates, registration, links
// and uploaded files, the logo, who can see it, and deleting it.

let comp: { id: string; name: string }
test.beforeEach(async ({ page }) => {
  comp = await retry(seedEmptyCompetition)
  await signInOrganiser(page, comp.id)
})
test.afterEach(async () => {
  await retry(() => removeCompetition(comp.id))
})

const info = (p: string) => `competitions/${comp.id}/${p}`
const field = (page: Page, label: string) => page.getByRole('textbox', { name: new RegExp(`^${label}`) })
const details = () => `/competitions/${comp.id}/manage/details`

/** A small, valid one-page PDF of about `kb` kilobytes. */
function pdf(kb = 2) {
  const filler = `% ${'x'.repeat(Math.max(0, kb * 1024 - 400))}\n`
  return Buffer.from(
    `%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]>>endobj\n${filler}trailer<</Root 1 0 R>>\n%%EOF\n`,
  )
}

test('the basics: name, date, number, description; required ones say so', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto(details())
  const name = field(page, 'Name')
  await name.fill('')
  await name.press('Enter')
  await expect(page.getByText('Name can’t be empty.')).toBeVisible()
  await name.fill('Calgary Highland Games 2026')
  await name.press('Enter')
  await expectDb(info('name'), 'Calgary Highland Games 2026')

  await page.locator('input[type=date]').fill('2026-11-14')
  await expectDb(info('date'), '2026-11-14')

  await field(page, 'Registration number').fill('C-AB-CO-26-1234')
  await field(page, 'Registration number').press('Enter')
  await expectDb(info('sobhd'), 'C-AB-CO-26-1234')

  // A description is several lines: Enter adds a line; leaving saves.
  const description = field(page, 'Description')
  await description.fill('Entries close a week before.')
  await description.press('Enter')
  await description.pressSequentially('Bring a chair.')
  await page.getByLabel('Venue name', { exact: true }).focus()
  await expectDb(info('description'), 'Entries close a week before.\nBring a chair.')

  // Town or city: the short form v3 wrote.
  await expect(field(page, 'Town or city')).toHaveAttribute('placeholder', 'e.g. Calgary, AB')
  expect(errors).toEqual([])
})

test('registration: a link that looks like one, and when it opens and closes', async ({ page }) => {
  await page.goto(details())
  // Folded away until it's used.
  await expect(field(page, 'Registration link')).toHaveCount(0)
  await page.getByRole('button', { name: 'Add registration details' }).click()
  const link = field(page, 'Registration link')
  await expect(link).toBeFocused()
  await link.fill('see the website')
  await link.press('Enter')
  await expect(page.getByText('That doesn’t look like a link. Try something like example.com/register.')).toBeVisible()
  await link.fill('example.com/register')
  await link.press('Enter')
  await expectDb(info('registrationURL'), 'example.com/register')

  await page.locator('input[type=datetime-local]').first().fill('2026-10-05T09:00')
  await expectDb(info('registrationStart'), '2026-10-05T09:00')
  await page.locator('input[type=datetime-local]').last().fill('2026-11-01T23:59')
  await expectDb(info('registrationEnd'), '2026-11-01T23:59')
  // Cleared: gone, not an empty string.
  await page.locator('input[type=datetime-local]').last().fill('')
  await page.locator('input[type=datetime-local]').last().blur()
  await expectDb(info('registrationEnd'), null)
})

test('links and files: add, rename, remove with Undo, upload a PDF; bad ones say so', async ({ page }) => {
  await page.goto(details())
  await page.getByRole('button', { name: 'Add a link or file' }).click()
  const newLabel = page.getByPlaceholder('e.g. Program').last()
  const newUrl = page.getByPlaceholder('https://')
  await newUrl.fill('TBA')
  await page.getByRole('button', { name: 'Add link' }).click()
  await expect(page.getByText('That doesn’t look like a link. Try something like example.com/register.')).toBeVisible()
  await newLabel.fill('Program')
  await newUrl.fill('https://example.com/program.pdf')
  await newUrl.press('Enter')
  await expect.poll(async () => Object.values((await dbGet<Record<string, unknown>>(info('links'))) ?? {})).toEqual([{ name: 'Program', url: 'https://example.com/program.pdf', _order: 0 }])
  await expect(newUrl).toHaveValue('')

  const [id] = Object.keys((await dbGet<Record<string, unknown>>(info('links')))!)
  await field(page, 'Label').first().fill('Programme')
  await field(page, 'Label').first().press('Enter')
  await expectDb(info(`links/${id}/name`), 'Programme')

  // Upload a PDF: stored, and added as a link named after the file.
  await page.locator('input[type=file][accept="application/pdf,image/*"]').setInputFiles({ name: 'Entry Form 2026.pdf', mimeType: 'application/pdf', buffer: pdf() })
  await expect.poll(async () => Object.values((await dbGet<Record<string, { name: string; url: string; _order: number }>>(info('links'))) ?? {}).map((l) => [l.name, l._order]), { timeout: 20000 }).toContainEqual(['Entry Form 2026', 1])
  const uploaded = Object.values((await dbGet<Record<string, { name: string; url: string }>>(info('links')))!).find((l) => l.name === 'Entry Form 2026')!
  expect(uploaded.url).toMatch(/entry-form-2026\.pdf/)
  const res = await page.request.get(uploaded.url)
  expect(res.ok()).toBe(true)
  expect((await res.body()).subarray(0, 5).toString()).toBe('%PDF-')

  // Too big for the storage rules: said before uploading.
  await page.locator('input[type=file][accept="application/pdf,image/*"]').setInputFiles({ name: 'huge.pdf', mimeType: 'application/pdf', buffer: pdf(1100) })
  await expect(page.getByRole('status').getByText('That PDF is over 950 KB. Try exporting a smaller one.')).toBeVisible()

  // Remove one, then Undo.
  await page.getByRole('button', { name: 'Remove' }).first().click()
  await expectDb(info(`links/${id}`), null)
  await toastUndo(page).click()
  await expectDb(info(`links/${id}/name`), 'Programme')
})

test('the logo: a big photo is shrunk and saved; Remove clears it', async ({ page }) => {
  await page.goto(details())
  const png = await page.evaluate(async () => {
    const c = document.createElement('canvas')
    c.width = 3000
    c.height = 2000
    const ctx = c.getContext('2d')!
    for (let i = 0; i < 6000; i += 1) {
      ctx.fillStyle = `hsl(${(i * 7) % 360} 80% ${20 + (i % 60)}%)`
      ctx.fillRect(Math.random() * 3000, Math.random() * 2000, 30, 30)
    }
    const blob: Blob = await new Promise((r) => c.toBlob((b) => r(b!), 'image/png'))
    return Array.from(new Uint8Array(await blob.arrayBuffer()))
  })
  expect(png.length).toBeGreaterThan(244 * 1024)
  await page.locator('input[type=file][accept="image/*"]').setInputFiles({ name: 'Games Logo.png', mimeType: 'image/png', buffer: Buffer.from(png) })
  await expect.poll(() => dbGet<string>(info('image')), { timeout: 30000 }).toMatch(/games-logo/)
  const res = await page.request.get((await dbGet<string>(info('image')))!)
  expect(res.ok()).toBe(true)
  expect((await res.body()).length).toBeLessThan(244 * 1024)
  await page.getByRole('button', { name: 'Remove' }).click()
  await expectDb(info('image'), null)
})

test('who can see it: unlisting unpublishes; publishing lists', async ({ page }) => {
  await page.goto(details())
  const listed = page.getByRole('switch', { name: /^Listed/ })
  const published = page.getByRole('switch', { name: /^Published/ })
  await expect(published).toHaveAttribute('aria-checked', 'true')
  await listed.click()
  await expectDb(info('listed'), false)
  await expectDb(info('published'), false)
  await expect(published).toHaveAttribute('aria-checked', 'false')
  await published.click()
  await expectDb(info('published'), true)
  await expectDb(info('listed'), true)
})

test('links added here show on the competition page', async ({ page }) => {
  await page.goto(details())
  await page.getByRole('button', { name: 'Add a link or file' }).click()
  await page.getByPlaceholder('e.g. Program').last().fill('Program')
  await page.getByPlaceholder('https://').fill('https://example.com/program.pdf')
  await page.getByRole('button', { name: 'Add link' }).click()
  await expect.poll(() => dbGet(info('links'))).not.toBeNull()
  await page.goto(`/competitions/${comp.id}/info`)
  await expect(page.getByRole('link', { name: /Program/ })).toBeVisible({ timeout: 5000 })
})

test('deleting the competition asks, then it’s gone from the lists too', async ({ page }) => {
  // Load the public list first, so it's cached for the visit; then go to
  // Details without reloading.
  await page.goto('/competitions')
  await expect(page.getByText(comp.name).first()).toBeVisible()
  await navigate(page, details())
  await page.getByRole('button', { name: 'Delete competition' }).click()
  await expect(page.locator('dialog[open]')).toContainText(`Delete ${comp.name}?`)
  await page.locator('dialog[open]').getByRole('button', { name: 'Delete competition' }).click()
  await expect(page).toHaveURL('/manage')
  await expectDb(`competitions/${comp.id}`, null)
  await expectDb(`competitions:data/${comp.id}`, null)
  await expect(page.getByText(comp.name)).toHaveCount(0)
  // Back to the public list in the same visit (no reload).
  await navigate(page, '/competitions')
  await expect(page).toHaveURL('/competitions')
  await page.waitForTimeout(1500)
  await expect(page.getByText(comp.name)).toHaveCount(0)
})

test('a failed upload says so in plain words', async ({ page }) => {
  await page.goto(details())
  await page.route('**/v0/b/**', (route) => route.fulfill({ status: 400, contentType: 'application/json', body: '{"error":{"code":400,"message":"Bad Request"}}' }))
  const png = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8ffff3f0005fe02fea7d6a4ab0000000049454e44ae426082', 'hex')
  await page.locator('input[type=file][accept="image/*"]').setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: png })
  await expect(page.getByRole('alert').filter({ hasText: 'That file didn’t upload. Check your connection and try again.' })).toBeVisible({ timeout: 15000 })
  await expect(page.getByText(/storage\//)).toHaveCount(0)
  expect(await dbGet(info('image'))).toBeNull()
})
