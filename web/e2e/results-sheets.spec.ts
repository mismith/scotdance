import { expect, test, type Page } from '@playwright/test'
import { dbGet, ensureUser, grantCompetition, signIn, uid } from './support/emulator'
import { collectErrors, confirmDialog, toastUndo } from './support/manageData'
import { retry } from './support/retry'
import { removeCompetition, seedCompetition, type SeededCompetition } from './support/seed'

// Judges' sheets (ADR 0013): an organiser adds a photo, and a PDF, under a
// dance's results in Manage. Each page is made small on the device, everyone
// sees it under that dance's placings, and deleting a page deletes its file
// too (functions/src/sheets.ts).

test.describe.configure({ mode: 'serial' })

let comp: SeededCompetition
let email: string

test.beforeAll(async () => {
  comp = await retry(() => seedCompetition({ id: uid('sheets'), dancersPerGroup: 6, resultsForGroups: 0 }))
  email = `${uid('org')}@example.test`
  await retry(async () => grantCompetition(await ensureUser(email), comp.id))
})
test.afterAll(async () => {
  if (comp) await retry(() => removeCompetition(comp.id))
})

interface StoredPage {
  url: string
  path: string
  width: number
  height: number
}
const premier = () => comp.groups.find((g) => g.id.endsWith('-grp-30'))!
const [fling, sword] = [0, 1].map((i) => () => comp.dances[i])
const pagesOf = async (danceId: string) =>
  Object.values((await dbGet<Record<string, StoredPage>>(`competitions:data/${comp.id}/sheets/${premier().id}/${danceId}`)) ?? {})
const fileInput = (page: Page) => page.locator('input[type=file][accept="image/*,application/pdf"]')

// A 12-megapixel phone photo of a sheet: grey paper under hall lights, grain.
async function photo(page: Page) {
  const bytes = await page.evaluate(async () => {
    const c = document.createElement('canvas')
    c.width = 3024
    c.height = 4032
    const x = c.getContext('2d')!
    x.fillStyle = '#b9b2a4'
    x.fillRect(0, 0, c.width, c.height)
    x.fillStyle = '#1d1b18'
    x.font = '90px sans-serif'
    for (let row = 0; row < 24; row += 1) x.fillText(`50${row}    ${(row % 6) + 1}    ${((row + 2) % 6) + 1}    ${((row + 4) % 6) + 1}`, 220, 400 + row * 140)
    const px = x.getImageData(0, 0, c.width, c.height)
    for (let i = 0; i < px.data.length; i += 4) {
      const n = (Math.random() - 0.5) * 30
      px.data[i] += n
      px.data[i + 1] += n
      px.data[i + 2] += n
    }
    x.putImageData(px, 0, 0)
    const blob: Blob = await new Promise((r) => c.toBlob((b) => r(b!), 'image/jpeg', 0.92))
    return Array.from(new Uint8Array(await blob.arrayBuffer()))
  })
  return Buffer.from(bytes)
}

// The scrutineer's PDF, two pages.
const pdf = () =>
  Buffer.from(
    [
      '%PDF-1.4',
      '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj',
      '2 0 obj<</Type/Pages/Kids[3 0 R 4 0 R]/Count 2>>endobj',
      '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 5 0 R/Resources<</Font<</F1 6 0 R>>>>>>endobj',
      '4 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 5 0 R/Resources<</Font<</F1 6 0 R>>>>>>endobj',
      '5 0 obj<</Length 52>>stream',
      'BT /F1 24 Tf 72 700 Td (No. Judge A Judge B Judge C) Tj ET',
      'endstream endobj',
      '6 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj',
      'trailer<</Root 1 0 R>>',
      '%%EOF',
    ].join('\n'),
  )

test('an organiser adds a photo and a PDF, each page made small', async ({ page }) => {
  // Making a 12-megapixel photo, then shrinking it and drawing a PDF, takes a while.
  test.slow()
  const errors = collectErrors(page)
  await signIn(page, email)
  await page.goto(`/competitions/${comp.id}/manage/results/${premier().id}/${fling().id}`)
  await expect(page.getByRole('heading', { name: 'Judges’ sheet' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Add a photo or PDF' })).toBeVisible()

  const big = await photo(page)
  expect(big.length).toBeGreaterThan(1024 * 1024)
  await fileInput(page).setInputFiles({ name: 'IMG_4021.jpg', mimeType: 'image/jpeg', buffer: big })
  await expect.poll(async () => (await pagesOf(fling().id)).length, { timeout: 30000 }).toBe(1)
  const [shot] = await pagesOf(fling().id)
  expect(Math.max(shot.width, shot.height)).toBeLessThanOrEqual(2000)
  expect(shot.path.startsWith(`competitions/sheets/${comp.id}/`)).toBe(true)
  const file = await page.request.get(shot.url)
  expect(file.ok()).toBe(true)
  expect(file.headers()['content-type']).toMatch(/^image\/(webp|jpeg)/)
  expect((await file.body()).length).toBeLessThanOrEqual(320 * 1024)
  await expect(page.getByRole('button', { name: 'View the judges’ sheet' })).toBeVisible()

  await page.goto(`/competitions/${comp.id}/manage/results/${premier().id}/${sword().id}`)
  await fileInput(page).setInputFiles({ name: 'Sword Dance.pdf', mimeType: 'application/pdf', buffer: pdf() })
  await expect.poll(async () => (await pagesOf(sword().id)).length, { timeout: 45000 }).toBe(2)
  await expect(page.getByRole('button', { name: 'View page 2' })).toBeVisible()
  expect(errors).toEqual([])
})

test('everyone sees them under the dance, a page at a time', async ({ browser }) => {
  // Signed out.
  const page = await (await browser.newContext()).newPage()
  const fetched: string[] = []
  page.on('request', (r) => /\/sheets%2F/.test(r.url()) && fetched.push(r.url()))
  await page.goto(`/competitions/${comp.id}/results/${premier().id}`)
  const row = (danceId: string) => page.locator(`[id="dance-${danceId}"]`).getByRole('button', { name: /Judges’ sheet/ })
  await expect(row(fling().id)).toBeVisible()
  await expect(row(sword().id)).toContainText('2 pages')
  // Nobody downloads a sheet until they open one.
  expect(fetched).toEqual([])

  await row(sword().id).click()
  const viewer = page.locator('dialog[open]')
  await expect(viewer.locator('header')).toContainText('Page 1 of 2')
  const first = viewer.getByRole('img', { name: /judges’ sheet, page 1 of 2/ })
  await expect(first).toBeVisible()
  await expect.poll(() => first.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true)
  await page.keyboard.press('ArrowRight')
  await expect(viewer.locator('header')).toContainText('Page 2 of 2')
  await page.keyboard.press('Escape')
  await expect(viewer).toHaveCount(0)
})

test('deleting a page takes it off for everyone and deletes its file', async ({ page }) => {
  await signIn(page, email)
  await page.goto(`/competitions/${comp.id}/manage/results/${premier().id}/${sword().id}`)
  const before = await pagesOf(sword().id)
  await page.getByRole('button', { name: 'Delete page 2' }).click()
  await page.locator('dialog[open]').getByRole('button', { name: 'Delete', exact: true }).click()
  await expect.poll(async () => (await pagesOf(sword().id)).length).toBe(1)
  const [kept] = await pagesOf(sword().id)
  const gone = before.find((p) => p.path !== kept.path)!
  await expect.poll(async () => (await page.request.get(gone.url)).status(), { timeout: 20000 }).toBe(404)
  expect((await page.request.get(kept.url)).ok()).toBe(true)
  await expect(page.getByRole('button', { name: 'View the judges’ sheet' })).toBeVisible()
})

test('deleting a dance deletes its sheets for good: Undo brings back the dance, not them', async ({ page }) => {
  await signIn(page, email)
  const kept = await pagesOf(sword().id)
  expect(kept.length).toBe(1)
  await page.goto(`/competitions/${comp.id}/manage/dances/${sword().id}`)
  await page.getByRole('button', { name: 'Delete dance' }).click()
  await expect(confirmDialog(page)).toContainText('judges’ sheets go for good')
  await confirmDialog(page).getByRole('button', { name: 'Delete', exact: true }).click()
  await expect.poll(() => pagesOf(sword().id)).toEqual([])
  await expect.poll(async () => (await page.request.get(kept[0].url)).status(), { timeout: 20000 }).toBe(404)
  await toastUndo(page).click()
  await expect.poll(() => dbGet(`competitions:data/${comp.id}/dances/${sword().id}/name`)).toBe(sword().name)
  expect(await pagesOf(sword().id)).toEqual([])
})
