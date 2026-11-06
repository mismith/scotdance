import { readFile } from 'node:fs/promises'
import { expect, test, type Page } from '@playwright/test'
import { dbGet } from './support/emulator'
import { removeCompetition, seedCompetition, type SeededCompetition } from './support/seed'
import { retry } from './support/retry'
import { confirmDialog, expectDb, signInOrganiser, toastUndo } from './support/manageData'

// Manage › Aggregates, as an organiser: making one, choosing who can win it
// (a switch for a whole category, and for single age groups), entering its
// placings in Results the way an age group's Overall is entered, and what
// deleting an aggregate or one of its age groups does.

let comp: SeededCompetition
test.beforeEach(async ({ page }) => {
  comp = await retry(() => seedCompetition({ dancersPerGroup: 2, resultsForGroups: 0 }))
  await signInOrganiser(page, comp.id)
})
test.afterEach(async () => {
  await retry(() => removeCompetition(comp.id))
})

const data = (path: string) => `competitions:data/${comp.id}/${path}`
const manage = (path = '') => `/competitions/${comp.id}/manage${path}`
const field = (page: Page, label: string) => page.getByRole('textbox', { name: new RegExp(`^${label}`) })
/** A dancer's row in the list to tap (its name starts with the number). */
const tap = (page: Page, number: string) => page.getByRole('button', { name: new RegExp(`^${number}\\b`) }).first()

// Premier has three age groups in the seed: Under 7, 7 & 8 Years, 9 & 10 Years.
const premierGroups = () => comp.groups.filter((g) => comp.categories[g.categoryId] === 'Premier')

async function addAggregate(page: Page, name: string) {
  await page.goto(manage('/aggregates/new'))
  await field(page, 'Name').fill(name)
  await page.getByRole('button', { name: 'Add aggregate' }).click()
  await expect(page.getByRole('heading', { name })).toBeVisible()
  await expect.poll(async () => Object.values((await dbGet<Record<string, { name: string }>>(data('aggregates'))) ?? {}).some((a) => a.name === name)).toBe(true)
  const all = await dbGet<Record<string, { name: string }>>(data('aggregates'))
  return Object.entries(all).find(([, a]) => a.name === name)![0]
}

test('starts empty, saying what an aggregate is', async ({ page }) => {
  await page.goto(manage('/aggregates'))
  await expect(page.getByText('No aggregates yet')).toBeVisible()
  await expect(page.getByText(/one trophy for dancers from several age groups/)).toBeVisible()
})

test('create one, switch on a category, then one age group, and see it listed', async ({ page }) => {
  const id = await addAggregate(page, 'Premier Dancer of the Day')
  expect((await dbGet<{ name: string }>(data(`aggregates/${id}`)))?.name).toBe('Premier Dancer of the Day')

  await field(page, 'Trophy').fill('Quaich')
  await field(page, 'Trophy').press('Enter')
  await expectDb(data(`aggregates/${id}/trophy`), 'Quaich')

  // Nothing on yet: the list says so.
  await expect(page.getByText('No age groups yet').filter({ visible: true }).first()).toBeVisible()

  // A category switch turns all its age groups on, saving only age groups.
  const premier = premierGroups()
  await page.getByRole('switch', { name: 'All Premier' }).click()
  await expectDb(data(`aggregates/${id}/groupIds`), Object.fromEntries(premier.map((g) => [g.id, true])))
  expect(await dbGet(data(`aggregates/${id}/categoryId`))).toBeNull()
  await expect(page.getByText('6 dancers · All Premier').filter({ visible: true }).first()).toBeVisible()

  // One age group off: the category switch goes off with it.
  await page.getByRole('switch', { name: `Premier ${premier[0].name}`, exact: true }).click()
  await expectDb(data(`aggregates/${id}/groupIds/${premier[0].id}`), null)
  await expect(page.getByRole('switch', { name: 'All Premier' })).not.toBeChecked()
  await expect(page.getByText('4 dancers').filter({ visible: true }).first()).toBeVisible()

  // Every category has its own shortcut.
  await expect(page.getByRole('switch', { name: 'All Primary' })).toBeVisible()
})

test('enter its placings in Results, like an Overall, and see it entered', async ({ page }) => {
  const id = await addAggregate(page, 'Premier Dancer of the Day')
  const premier = premierGroups()
  await page.getByRole('switch', { name: 'All Premier' }).click()
  await expectDb(data(`aggregates/${id}/groupIds`), Object.fromEntries(premier.map((g) => [g.id, true])))

  await page.goto(manage('/results'))
  await expect(page.getByRole('heading', { name: 'Aggregates' })).toBeVisible()
  await page.getByRole('link', { name: /^Premier Dancer of the Day, not entered yet/ }).click()

  // Dancers from every Premier age group, each with theirs underneath.
  const first = comp.dancers.find((d) => d.groupId === premier[0].id)!
  const last = comp.dancers.find((d) => d.groupId === premier[2].id)!
  await expect(tap(page, first.number)).toContainText(`Premier ${premier[0].name}`)
  await tap(page, last.number).click()
  await tap(page, first.number).click()
  await expectDb(data(`results/${id}/overall`), [last.id, first.id])

  // Back on the list it counts as entered.
  await page.goto(manage('/results'))
  await expect(page.getByRole('link', { name: /^Premier Dancer of the Day, entered/ })).toBeVisible()

  // The spreadsheet lists it last, with the age group each winner entered.
  await page.getByRole('button', { name: 'More for results' }).click()
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('dialog', { name: 'More for results' }).getByRole('button', { name: 'Download all results' }).click(),
  ])
  const rows = (await readFile((await download.path())!, 'utf8')).replace(/^\uFEFF/, '').split('\n')
  expect(rows[0]).toBe('Category,Age group,Dance,Place,Number,First name,Last name,Location,Their age group')
  expect(rows.slice(-2).map((r) => [r.split(',')[1], r.split(',')[3], r.split(',')[4], r.split(',').at(-1)])).toEqual([
    ['Premier Dancer of the Day', '1', last.number, `Premier ${premier[2].name}`],
    ['Premier Dancer of the Day', '2', first.number, `Premier ${premier[0].name}`],
  ])
})

test('deleting one takes its placings, with Undo; deleting an age group takes it off the aggregate', async ({ page }) => {
  const id = await addAggregate(page, 'Premier Dancer of the Day')
  const premier = premierGroups()
  await page.getByRole('switch', { name: 'All Premier' }).click()
  await expectDb(data(`aggregates/${id}/groupIds`), Object.fromEntries(premier.map((g) => [g.id, true])))
  const winner = comp.dancers.find((d) => d.groupId === premier[1].id)!
  await page.goto(manage(`/results/${id}/overall`))
  await tap(page, winner.number).click()
  await expectDb(data(`results/${id}/overall`), [winner.id])

  // An age group deleted leaves the aggregate's list.
  await page.goto(manage(`/groups/${premier[2].id}`))
  await page.getByRole('button', { name: 'Delete age group' }).click()
  await confirmDialog(page).getByRole('button', { name: 'Delete', exact: true }).click()
  await expectDb(data(`groups/${premier[2].id}`), null)
  await expectDb(data(`aggregates/${id}/groupIds/${premier[2].id}`), null)
  expect(await dbGet(data(`aggregates/${id}/groupIds/${premier[1].id}`))).toBe(true)

  // The aggregate deleted: its placings go too, warned first, and come back with Undo.
  await page.goto(manage(`/aggregates/${id}`))
  await page.getByRole('button', { name: 'Delete aggregate' }).click()
  await expect(confirmDialog(page)).toContainText('Its placings will be deleted too.')
  await confirmDialog(page).getByRole('button', { name: 'Delete', exact: true }).click()
  await expectDb(data(`aggregates/${id}`), null)
  expect(await dbGet(data(`results/${id}`))).toBeNull()
  await toastUndo(page).click()
  await expectDb(data(`results/${id}/overall`), [winner.id])
  expect((await dbGet<{ name: string }>(data(`aggregates/${id}`)))?.name).toBe('Premier Dancer of the Day')
})
