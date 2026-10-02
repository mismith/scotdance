import { expect, test, type Locator, type Page } from '@playwright/test'
import { dbGet } from './support/emulator'
import { removeCompetition, seedCompetition, type SeededCompetition } from './support/seed'
import { retry } from './support/retry'
import { barMenuItem, collectErrors, confirmDialog, expectDb, isPhone, signInOrganiser, toastUndo } from './support/manageData'

// Manage › Dancers as an organiser (not a system admin), on desktop and phone:
// autosave, Escape, validation, adding, deleting with Undo, bulk changes,
// keyboard Undo/Redo, Back mid-edit, and offline.

type Dancer = { number?: string; firstName?: string; lastName?: string; location?: string; groupId?: string; categoryId?: string }

// One competition per worker (seeding fans out into many server triggers);
// each test works on its own dancers so they can share it.
let comp: SeededCompetition
test.beforeAll(async () => {
  comp = await retry(() => seedCompetition({ dancersPerGroup: 3 }))
})
test.afterAll(async () => {
  await retry(() => removeCompetition(comp.id))
})
test.beforeEach(async ({ page }) => {
  await signInOrganiser(page, comp.id)
})

/** A text box by its label (the Undo and Redo buttons' names mention fields too). */
const field = (scope: Page | Locator, label: string) => scope.getByRole('textbox', { name: new RegExp(`^${label}`) })
const dancerPath = (id: string) => `competitions:data/${comp.id}/dancers/${id}`
const manage = (path = '') => `/competitions/${comp.id}/manage${path}`

test('fields save on Enter, on leaving, and after a pause; Escape puts back the saved value', async ({ page }) => {
  const errors = collectErrors(page)
  const d = comp.dancers[0]
  await page.goto(manage(`/dancers/${d.id}`))

  const first = field(page, 'First name')
  await first.fill('Avah')
  await first.press('Enter')
  await expectDb(`${dancerPath(d.id)}/firstName`, 'Avah')
  await expect(page.getByRole('heading', { name: `Avah ${d.lastName}` })).toBeVisible()

  await field(page, 'Last name').fill('Reid-Smith')
  await field(page, 'Location').focus()
  await expectDb(`${dancerPath(d.id)}/lastName`, 'Reid-Smith')

  const location = field(page, 'Location')
  await location.fill('Banff, AB')
  await expectDb(`${dancerPath(d.id)}/location`, 'Banff, AB')

  await location.fill('Nowhere')
  await location.press('Escape')
  await expect(location).toHaveValue('Banff, AB')
  await page.waitForTimeout(1500)
  expect(await dbGet(`${dancerPath(d.id)}/location`)).toBe('Banff, AB')

  // Emptying an optional field clears it.
  await location.fill('')
  await location.press('Enter')
  await expectDb(`${dancerPath(d.id)}/location`, null)

  // Unicode and apostrophes round-trip.
  await field(page, 'Last name').fill('Ó Briain-O’Neill')
  await field(page, 'Last name').press('Enter')
  await expectDb(`${dancerPath(d.id)}/lastName`, 'Ó Briain-O’Neill')
  expect(errors).toEqual([])
})

test('an edit made just before going Back still saves, to that dancer', async ({ page }) => {
  const d = comp.dancers[1]
  await page.goto(manage())
  // (The Manage sections: in the sidebar on wide screens, whose Browse list has a Dancers too.)
  await page.getByRole('navigation', { name: 'Manage sections' }).getByRole('link', { name: /^Dancers/ }).click()
  await page.getByRole('link', { name: new RegExp(`^${d.number} `) }).click()
  await expect(field(page, 'First name')).toHaveValue(d.firstName)
  await field(page, 'First name').fill('Zed')
  // The browser's (or phone's) Back, before the pause that would save it.
  await page.goBack()
  await expectDb(`${dancerPath(d.id)}/firstName`, 'Zed')
  const all = await dbGet<Record<string, Dancer>>(`competitions:data/${comp.id}/dancers`)
  expect(Object.entries(all).filter(([, x]) => x.firstName === 'Zed').map(([id]) => id)).toEqual([d.id])
  // One change in the history, not two.
  await (await barMenuItem(page, `Undo: First name of ${d.firstName} ${d.lastName}`)).click()
  await expectDb(`${dancerPath(d.id)}/firstName`, d.firstName)
  await expect(await barMenuItem(page, 'Undo')).toBeDisabled()
  await page.keyboard.press('Escape')
})

test('checks what’s typed: required fields and dancer numbers', async ({ page }) => {
  const [d, sameGroup, , otherGroup] = comp.dancers.slice(6)
  await page.goto(manage(`/dancers/${d.id}`))

  const first = field(page, 'First name')
  await first.fill('   ')
  await first.press('Enter')
  await expect(page.getByText('First name can’t be empty.')).toBeVisible()
  await first.press('Escape')
  await expect(first).toHaveValue(d.firstName)
  await expect(page.getByText('First name can’t be empty.')).toBeHidden()

  const number = field(page, 'Number')
  for (const bad of ['abc', '-5', '12.5', '#7']) {
    await number.fill(bad)
    await number.press('Enter')
    await expect(page.getByText('Use digits, like 101 or 101A.')).toBeVisible()
  }
  await number.fill(sameGroup.number)
  await number.press('Enter')
  await expect(page.getByText(`${sameGroup.number} is already ${sameGroup.firstName} ${sameGroup.lastName} in this age group.`)).toBeVisible()
  await page.waitForTimeout(1200)
  expect(await dbGet(`${dancerPath(d.id)}/number`)).toBe(d.number)

  // The same number in another age group is fine (one dancer, two entries).
  await number.fill(otherGroup.number)
  await number.press('Enter')
  await expectDb(`${dancerPath(d.id)}/number`, otherGroup.number)
  await number.fill('101A')
  await number.press('Enter')
  await expectDb(`${dancerPath(d.id)}/number`, '101A')

  // Very long names save and wrap rather than push the page sideways.
  const long = 'Bartholomew-Alexander '.repeat(8).trim()
  await field(page, 'Last name').fill(long)
  await field(page, 'Last name').press('Enter')
  await expectDb(`${dancerPath(d.id)}/lastName`, long)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test('adds dancers one after another, suggesting the next number and keeping the age group', async ({ page }) => {
  const group = comp.groups[2]
  const label = `${comp.categories[group.categoryId]} ${group.name}`
  await page.goto(manage('/dancers'))
  await page.getByRole('link', { name: 'Add dancer' }).click()
  const form = page.locator('form')

  await form.getByRole('button', { name: 'Add dancer' }).click()
  await expect(form.getByText('Number can’t be empty.')).toBeVisible()
  await expect(form.getByText('Age group can’t be empty.')).toBeVisible()
  await expect(form.getByText('First name can’t be empty.')).toBeVisible()
  await expect(field(form, 'Number')).toBeFocused()

  await field(form, 'Number').fill('500')
  // Each error goes once its field is changed.
  await expect(form.getByText('Number can’t be empty.')).toBeHidden()
  await expect(form.getByText('First name can’t be empty.')).toBeVisible()
  await form.getByRole('combobox', { name: /^Age group/ }).selectOption({ label })
  await field(form, 'First name').fill('Kirsty')
  await field(form, 'Last name').fill('Mackenzie')
  await form.getByRole('button', { name: 'Add and add another' }).click()
  await expect(page.getByRole('status').getByText('Added Kirsty Mackenzie')).toBeVisible()
  await expect(field(form, 'Number')).toHaveValue('501')
  await expect(form.getByRole('combobox', { name: /^Age group/ })).toHaveValue(group.id)
  await expect(field(form, 'First name')).toHaveValue('')

  await field(form, 'First name').fill('Morag')
  await form.getByRole('button', { name: 'Add dancer' }).click()
  await expect(page.getByRole('heading', { name: 'Morag' })).toBeVisible()

  const all = Object.values(await dbGet<Record<string, Dancer>>(`competitions:data/${comp.id}/dancers`))
  const added = all.filter((x) => x.number === '500' || x.number === '501').map(({ number, firstName, lastName, groupId, categoryId }) => ({ number, firstName, lastName, groupId, categoryId }))
  expect(added.sort((a, b) => a.number!.localeCompare(b.number!))).toEqual([
    { number: '500', firstName: 'Kirsty', lastName: 'Mackenzie', groupId: group.id, categoryId: group.categoryId },
    { number: '501', firstName: 'Morag', lastName: undefined, groupId: group.id, categoryId: group.categoryId },
  ])
})

test('deleting a dancer asks first, takes their number out of the draws, and can be undone', async ({ page }) => {
  const d = comp.dancers[4]
  const drawsPath = `competitions:data/${comp.id}/draws/${d.groupId}`
  const drawsBefore = await dbGet<Record<string, string[]>>(drawsPath)
  expect(Object.values(drawsBefore).some((list) => list.includes(d.number))).toBe(true)

  await page.goto(manage(`/dancers/${d.id}`))
  await page.getByRole('button', { name: 'Delete dancer' }).click()
  await expect(confirmDialog(page)).toContainText(`Delete ${d.firstName} ${d.lastName}?`)
  await expect(confirmDialog(page)).toContainText('They have results entered')
  await confirmDialog(page).getByRole('button', { name: 'Cancel' }).click()
  expect(await dbGet(dancerPath(d.id))).not.toBeNull()

  await page.getByRole('button', { name: 'Delete dancer' }).click()
  await confirmDialog(page).getByRole('button', { name: 'Delete', exact: true }).click()
  await expectDb(dancerPath(d.id), null)
  await expect(page).toHaveURL(manage('/dancers'))
  const drawsAfter = await dbGet<Record<string, string[]>>(drawsPath)
  expect(Object.values(drawsAfter).some((list) => list.includes(d.number))).toBe(false)

  await toastUndo(page).click()
  await expect.poll(() => dbGet<Dancer>(dancerPath(d.id)).then((x) => x?.firstName)).toBe(d.firstName)
  expect(await dbGet(drawsPath)).toEqual(drawsBefore)
})

test('select several to set their age group or delete them, with Undo', async ({ page }) => {
  const [a, b] = comp.dancers.slice(15)
  const target = comp.groups[8]
  await page.goto(manage('/dancers'))
  await page.getByRole('button', { name: 'Select', exact: true }).click()
  await page.getByRole('checkbox', { name: new RegExp(`^${a.number} `) }).click()
  await page.getByRole('checkbox', { name: new RegExp(`^${b.number} `) }).click()
  await expect(page.getByText('2 selected')).toBeVisible()
  await page.getByRole('button', { name: 'Set age group' }).click()
  await page.locator('dialog[open]').getByRole('button', { name: `${comp.categories[target.categoryId]} ${target.name}` }).click()
  for (const x of [a, b]) {
    await expectDb(`${dancerPath(x.id)}/groupId`, target.id)
    expect(await dbGet(`${dancerPath(x.id)}/categoryId`)).toBe(target.categoryId)
  }
  await toastUndo(page).click()
  for (const x of [a, b]) await expectDb(`${dancerPath(x.id)}/groupId`, x.groupId)

  // With toasts still up, the bar's buttons stay reachable (toasts sit above it).
  await page.getByRole('button', { name: 'Select', exact: true }).click()
  await page.getByRole('checkbox', { name: new RegExp(`^${a.number} `) }).click()
  await page.getByRole('checkbox', { name: new RegExp(`^${b.number} `) }).click()
  await page.getByRole('button', { name: 'Delete 2' }).click()
  await expect(confirmDialog(page)).toContainText('Delete 2 dancers?')
  await confirmDialog(page).getByRole('button', { name: 'Delete', exact: true }).click()
  await expectDb(dancerPath(a.id), null)
  await expectDb(dancerPath(b.id), null)
})

test('Cmd/Ctrl+Z undoes and Shift+Cmd/Ctrl+Z redoes; Undo in the bar too', async ({ page }, info) => {
  const d = comp.dancers[18]
  await page.goto(manage(`/dancers/${d.id}`))
  await field(page, 'First name').fill('Avah')
  await field(page, 'First name').press('Enter')
  await expectDb(`${dancerPath(d.id)}/firstName`, 'Avah')

  if (!isPhone(info)) {
    // In a field, the keys undo typing; elsewhere they undo the change.
    await page.getByRole('heading', { name: /Avah/ }).click()
    await page.keyboard.press('ControlOrMeta+z')
    await expectDb(`${dancerPath(d.id)}/firstName`, d.firstName)
    await expect(field(page, 'First name')).toHaveValue(d.firstName)
    await page.keyboard.press('ControlOrMeta+Shift+z')
    await expectDb(`${dancerPath(d.id)}/firstName`, 'Avah')
  }
  await (await barMenuItem(page, `Undo: First name of ${d.firstName} ${d.lastName}`)).click()
  await expectDb(`${dancerPath(d.id)}/firstName`, d.firstName)
  await expect(page.getByRole('status').getByText(`Undone: First name of ${d.firstName} ${d.lastName}`).last()).toBeVisible()
})

test('two quick Cmd/Ctrl+Z presses undo two changes', async ({ page }, info) => {
  test.skip(isPhone(info), 'keyboard shortcuts')
  const d = comp.dancers[15]
  await page.goto(manage(`/dancers/${d.id}`))
  await field(page, 'First name').fill('Avah')
  await field(page, 'First name').press('Enter')
  await expectDb(`${dancerPath(d.id)}/firstName`, 'Avah')
  await field(page, 'Last name').fill('Reid')
  await field(page, 'Last name').press('Enter')
  await expectDb(`${dancerPath(d.id)}/lastName`, 'Reid')
  // The second press comes while the first is still saving: it waits its turn.
  await page.getByRole('heading', { name: /Avah/ }).click()
  await page.keyboard.press('ControlOrMeta+z')
  await page.keyboard.press('ControlOrMeta+z')
  await expectDb(`${dancerPath(d.id)}/lastName`, d.lastName)
  await expectDb(`${dancerPath(d.id)}/firstName`, d.firstName)
})

test('undoing a change someone else has changed since asks first', async ({ page }) => {
  const d = comp.dancers[21]
  await page.goto(manage(`/dancers/${d.id}`))
  await field(page, 'First name').fill('Avah')
  await field(page, 'First name').press('Enter')
  await expectDb(`${dancerPath(d.id)}/firstName`, 'Avah')
  // Another admin, elsewhere.
  const { dbSet } = await import('./support/emulator')
  await dbSet(`${dancerPath(d.id)}/firstName`, 'Ava-Lee')
  await expect(field(page, 'First name')).toHaveValue('Ava-Lee')
  await (await barMenuItem(page, /^Undo:/)).click()
  await expect(confirmDialog(page)).toContainText('Undo anyway?')
  await confirmDialog(page).getByRole('button', { name: 'Cancel' }).click()
  await page.waitForTimeout(500)
  expect(await dbGet(`${dancerPath(d.id)}/firstName`)).toBe('Ava-Lee')
  await (await barMenuItem(page, /^Undo:/)).click()
  await confirmDialog(page).getByRole('button', { name: 'Undo anyway' }).click()
  await expectDb(`${dancerPath(d.id)}/firstName`, d.firstName)
})

test('undoing a newly added dancer doesn’t ask, even after the server links their profile', async ({ page }) => {
  test.slow()
  await page.goto(manage('/dancers/new'))
  const form = page.locator('form')
  await field(form, 'Number').fill('777')
  await form.getByRole('combobox', { name: /^Age group/ }).selectOption({ index: 1 })
  await field(form, 'First name').fill('Zoe')
  await form.getByRole('button', { name: 'Add dancer' }).click()
  await expect(page.getByRole('heading', { name: 'Zoe' })).toBeVisible()
  const find = async () => Object.entries(await dbGet<Record<string, Dancer & { dancerId?: string }>>(`competitions:data/${comp.id}/dancers`)).find(([, x]) => x.number === '777')
  // The aggregator adds a link to the dancer's profile (when functions run).
  await expect.poll(async () => (await find())?.[1].dancerId ?? 'none', { timeout: 8000 }).not.toBe('none').catch(() => {})
  await (await barMenuItem(page, 'Undo: Added Zoe')).click()
  await expect.poll(find).toBeUndefined()
  await expect(confirmDialog(page)).toHaveCount(0)
})

test('offline: fields lock and say so; back online they save again', async ({ page, context }) => {
  const d = comp.dancers[24]
  await page.goto(manage(`/dancers/${d.id}`))
  await expect(field(page, 'First name')).toBeEnabled()
  await context.setOffline(true)
  await expect(page.getByRole('status').filter({ hasText: 'Offline' })).toBeVisible({ timeout: 15000 })
  await expect(field(page, 'First name')).toBeDisabled()
  await expect(page.getByRole('combobox', { name: /^Age group/ })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Delete dancer' })).toBeDisabled()
  await context.setOffline(false)
  await expect(field(page, 'First name')).toBeEnabled({ timeout: 20000 })
  await field(page, 'First name').fill('Back')
  await field(page, 'First name').press('Enter')
  await expectDb(`${dancerPath(d.id)}/firstName`, 'Back')
})

test('phone: Back climbs one level at a time', async ({ page }, info) => {
  test.skip(!isPhone(info), 'phones only')
  const d = comp.dancers[27]
  await page.goto(manage())
  await page.getByRole('link', { name: /^Dancers/ }).click()
  await page.getByRole('link', { name: new RegExp(`^${d.number} `) }).click()
  await expect(field(page, 'First name')).toBeVisible()
  await page.getByRole('button', { name: 'Back to Dancers' }).click()
  await expect(page.getByRole('heading', { name: /^Dancers/ })).toBeVisible()
  await expect(field(page, 'First name')).toHaveCount(0)
  await page.getByRole('button', { name: 'Back to Manage' }).click()
  await expect(page).toHaveURL(manage())
  await page.getByRole('button', { name: `Back to ${comp.name}` }).click()
  await expect(page).toHaveURL(`/competitions/${comp.id}/info`)
})
