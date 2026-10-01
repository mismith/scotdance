import { expect, test, type Page } from '@playwright/test'
import { fileURLToPath } from 'node:url'
import { dbGet, dbSet } from './support/emulator'
import { removeCompetition } from './support/seed'
import { retry } from './support/retry'
import { collectErrors, expectDb, seedEmptyCompetition, signInOrganiser, toastUndo } from './support/manageData'

// Manage › Dancers › Import with real files (e2e/fixtures, made by
// make-import-fixtures.mjs): an Excel program, the same list a week later as a
// Windows CSV, a table needing a column chosen, pasted cells and a bad file.

const fixture = (name: string) => fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url))

type Dancer = { number: string; firstName?: string; lastName?: string; location?: string; groupId?: string; categoryId?: string }
type Group = { name?: string; categoryId?: string; _order?: number }

let comp: { id: string; name: string }
test.beforeEach(async ({ page }) => {
  comp = await retry(seedEmptyCompetition)
  await signInOrganiser(page, comp.id)
})
test.afterEach(async () => {
  await retry(() => removeCompetition(comp.id))
})

const data = (p: string) => `competitions:data/${comp.id}/${p}`
const importPage = () => `/competitions/${comp.id}/manage/dancers/import`
const filterButton = (page: Page, name: RegExp) => page.getByRole('radio', { name })

/** Every dancer as "number First Last [Category Age group] Location". */
async function dancersNow() {
  const [dancers, groups, cats] = await Promise.all([
    dbGet<Record<string, Dancer> | null>(data('dancers')),
    dbGet<Record<string, Group> | null>(data('groups')),
    dbGet<Record<string, { name: string }> | null>(data('categories')),
  ])
  return Object.values(dancers ?? {})
    .map((d) => {
      const g = groups?.[d.groupId ?? '']
      const c = cats?.[g?.categoryId ?? '']
      expect(d.categoryId ?? null).toBe(g?.categoryId ?? null)
      return `${d.number} ${d.firstName ?? ''} ${d.lastName ?? ''} [${`${c?.name ?? ''} ${g?.name ?? ''}`.trim()}] ${d.location ?? ''}`.trim()
    })
    .sort()
}

test('imports an Excel program, then the updated list, and re-importing changes nothing', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto(importPage())
  await page.locator('input[type=file]').setInputFiles(fixture('program.xlsx'))

  // The program sheet is picked over the notes.
  await expect(page.getByRole('combobox', { name: 'Sheet' })).toHaveValue('1')
  await expect(filterButton(page, /^All 10$/)).toBeVisible()
  await expect(filterButton(page, /^New 10$/)).toBeVisible()
  await expect(filterButton(page, /^Needs fixing 0$/)).toBeVisible()
  await expect(page.getByText('New categories: Primary, Beginner, Premier, Premier Championship')).toBeVisible()
  await expect(page.getByText('New age groups: Primary, Beginner 7 & Under 9 Years, Premier 12 & Under 14 Years, Premier Championship 12 & Over')).toBeVisible()

  await page.getByRole('button', { name: 'Import 10 dancers' }).click()
  await expect(page).toHaveURL(`/competitions/${comp.id}/manage/dancers`)
  await expect(page.getByRole('status').getByText('Imported: 10 added')).toBeVisible()
  expect(await dancersNow()).toEqual([
    '101 Isla MacDonald [Primary] Calgary, AB',
    '102 Ava O’Neill [Primary] Edmonton, AB',
    '103 Seán Ó Briain [Primary] Glasgow',
    '201 Mia Reid [Beginner 7 & Under 9 Years] Ottawa, ON',
    '202 Ella Grant [Beginner 7 & Under 9 Years]',
    '203A Lucy Kerr [Beginner 7 & Under 9 Years] Halifax, NS',
    '301 Freya Ross [Premier 12 & Under 14 Years] Vancouver, BC',
    '301 Freya Ross [Premier Championship 12 & Over] Vancouver, BC',
    '302 Hannah Murray [Premier 12 & Under 14 Years] Calgary, AB',
    '401 Ruby Sinclair [Premier Championship 12 & Over] Calgary, AB',
  ])
  const groups = Object.values((await dbGet<Record<string, Group>>(data('groups'))) ?? {})
  expect(groups.map((g) => g._order).sort()).toEqual([0, 1, 2, 3])

  // The same file again: nothing to do.
  await page.goto(importPage())
  await page.locator('input[type=file]').setInputFiles(fixture('program.xlsx'))
  await expect(filterButton(page, /^No change 10$/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Nothing to change' })).toBeDisabled()

  // Ella (202) has a result, so removing her would leave a "?" there.
  const [ellaId, ella] = Object.entries((await dbGet<Record<string, Dancer>>(data('dancers')))!).find(([, d]) => d.number === '202')!
  await dbSet(data(`results/${ella.groupId}/some-dance`), [ellaId])

  // A week later, saved as a CSV by Excel on Windows.
  await page.getByRole('button', { name: 'Choose another' }).click()
  await page.locator('input[type=file]').setInputFiles(fixture('program-updated.csv'))
  await expect(filterButton(page, /^New 1$/)).toBeVisible()
  await expect(filterButton(page, /^Changed 2$/)).toBeVisible()
  await expect(filterButton(page, /^No change 7$/)).toBeVisible()
  await filterButton(page, /^Changed 2$/).click()
  await expect(page.getByText('Last name: MacDonald → MacDonald-Smith')).toBeVisible()
  await expect(page.getByText('Age group: Premier 12 & Under 14 Years → Premier 14 & Under 16 Years')).toBeVisible()
  await expect(page.getByRole('cell', { name: 'Seán' })).toHaveCount(0)
  await filterButton(page, /^No change 7$/).click()
  await expect(page.getByRole('cell', { name: /Ó Briain/ })).toBeVisible()
  await expect(page.getByText('Remove 1 dancer who isn’t in this file')).toBeVisible()
  await expect(page.getByText('202 Ella Grant')).toBeVisible()
  await expect(page.getByText('They have results entered. Those places would show as an unknown dancer (?).')).toBeVisible()
  await page.getByRole('checkbox', { name: /Remove 1 dancer/ }).check()
  await page.getByRole('button', { name: 'Import 3 dancers' }).click()
  await expect(page.getByRole('status').getByText('Imported: 1 added, 2 updated, 1 removed')).toBeVisible()
  const after = await dancersNow()
  expect(after).toContain('101 Isla MacDonald-Smith [Primary] Calgary, AB')
  expect(after).toContain('204 Grace Fraser [Beginner 7 & Under 9 Years] Red Deer, AB')
  expect(after).toContain('302 Hannah Murray [Premier 14 & Under 16 Years] Calgary, AB')
  expect(after.some((d) => d.startsWith('202 '))).toBe(false)
  expect(after).toHaveLength(10)

  // Undo the whole import from its toast.
  await toastUndo(page).click()
  await expect.poll(dancersNow).toContain('202 Ella Grant [Beginner 7 & Under 9 Years]')
  const undone = await dancersNow()
  expect(undone).toContain('101 Isla MacDonald [Primary] Calgary, AB')
  expect(undone.some((d) => d.startsWith('204 '))).toBe(false)
  expect(undone).toContain('302 Hannah Murray [Premier 12 & Under 14 Years] Calgary, AB')
  expect(errors).toEqual([])
})

test('a table under a title: choose the number column by hand', async ({ page }) => {
  await page.goto(importPage())
  await page.locator('input[type=file]').setInputFiles(fixture('table.xlsx'))
  await expect(page.getByRole('heading', { name: 'Columns' })).toBeVisible()
  await expect(page.getByRole('combobox', { name: 'Number' })).toHaveValue('-1')
  await expect(page.getByRole('combobox', { name: 'Location' })).toHaveValue('3')
  await expect(filterButton(page, /^Needs fixing 3$/)).toBeVisible()
  await expect(page.getByText('Choose the column with the dancers’ numbers.')).toBeVisible()
  await page.getByRole('combobox', { name: 'Number' }).selectOption({ label: 'Bib No.' })
  await expect(filterButton(page, /^New 3$/)).toBeVisible()
  await expect(page.getByText('Choose the column with the dancers’ numbers.')).toBeHidden()
  await page.getByRole('button', { name: 'Import 3 dancers' }).click()
  await expect(page.getByRole('status').getByText('Imported: 3 added')).toBeVisible()
  expect(await dancersNow()).toEqual([
    '11 Eilidh Campbell [Novice 10 & Under 12 Years] Calgary, AB',
    '12 Morag Stewart [Novice 10 & Under 12 Years] Edmonton, AB',
    '21 Kirsty Mackenzie [Intermediate 12 Years & Over] Banff, AB',
  ])
})

test('pasted cells; rows that need fixing are shown and skipped', async ({ page }) => {
  await page.goto(importPage())
  await page.getByRole('textbox').fill(
    ['Number\tFirst name\tLast name\tAge group', '7\tAva\tReid\tPremier 12 & Under 14', '7\tMia\tLee\tPremier 12 & Under 14', '8\t\t\tPremier 12 & Under 14', 'x9\tLucy\tKerr\tPremier 12 & Under 14', '10\tEilidh\tCampbell\tPremier 12 & Under 14'].join('\n'),
  )
  await page.getByRole('button', { name: 'Use these cells' }).click()
  await expect(filterButton(page, /^Needs fixing 4$/)).toBeVisible()
  await expect(page.getByText('4 rows need fixing and will be skipped.')).toBeVisible()
  await expect(page.getByText('Number 7 is in this age group more than once').first()).toBeVisible()
  await expect(page.getByText('No name')).toBeVisible()
  await expect(page.getByText('Number “x9” should be digits, like 101')).toBeVisible()
  await page.getByRole('button', { name: 'Import 1 dancer' }).click()
  await expect(page.getByRole('status').getByText('Imported: 1 added')).toBeVisible()
  expect(await dancersNow()).toEqual(['10 Eilidh Campbell [Premier 12 & Under 14]'])
})

test('a file that isn’t a spreadsheet says so', async ({ page }) => {
  await page.goto(importPage())
  await page.locator('input[type=file]').setInputFiles({ name: 'entries.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from('not really a spreadsheet') })
  await expect(page.getByText('That file couldn’t be read. Save it as an Excel workbook (.xlsx) or CSV and try again.')).toBeVisible()
  await page.locator('input[type=file]').setInputFiles({ name: 'empty.csv', mimeType: 'text/csv', buffer: Buffer.from('hello,world\n') })
  await expect(page.getByText('No dancers found.')).toBeVisible({ timeout: 15000 })
})

test('the import page fits a phone', async ({ page }) => {
  await page.goto(importPage())
  await page.locator('input[type=file]').setInputFiles(fixture('program.xlsx'))
  await expect(page.getByRole('button', { name: 'Import 10 dancers' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await expectDb(data('dancers'), null)
})
