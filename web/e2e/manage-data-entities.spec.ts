import { expect, test, type Locator, type Page } from '@playwright/test'
import { dbGet } from './support/emulator'
import { removeCompetition, seedCompetition, type SeededCompetition } from './support/seed'
import { retry } from './support/retry'
import { barMenuItem, collectErrors, confirmDialog, expectDb, isPhone, navigate, signInOrganiser, toastUndo } from './support/manageData'

// Manage › Categories, Age groups, Dances, Platforms and Staff (judges, pipers,
// sponsors), as an organiser: adding (by hand and from the common ones),
// editing, reordering, deleting with what it affects, and the public pages
// still working after each kind of delete.

let comp: SeededCompetition
test.beforeEach(async ({ page }) => {
  comp = await retry(() => seedCompetition({ dancersPerGroup: 1, resultsForGroups: 3 }))
  await signInOrganiser(page, comp.id)
})
test.afterEach(async () => {
  await retry(() => removeCompetition(comp.id))
})

const data = (path: string) => `competitions:data/${comp.id}/${path}`
const manage = (path = '') => `/competitions/${comp.id}/manage${path}`
const field = (scope: Page | Locator, label: string) => scope.getByRole('textbox', { name: new RegExp(`^${label}`) })
const select = (scope: Page | Locator, label: string) => scope.getByRole('combobox', { name: new RegExp(`^${label}`) })
const row = (page: Page, name: string) => page.getByRole('link', { name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`) })

async function deleteOpenItem(page: Page, what: string, expectText?: string) {
  const at = page.url()
  await page.getByRole('button', { name: `Delete ${what}` }).click()
  if (expectText) await expect(confirmDialog(page)).toContainText(expectText)
  await confirmDialog(page).getByRole('button', { name: 'Delete', exact: true }).click()
  // Back on the list once it's gone.
  await page.waitForURL((u) => u.toString() !== at)
}

test('categories: add common ones once, rename, reorder, delete (age groups keep going)', async ({ page }, info) => {
  await page.goto(manage('/categories'))
  await page.getByRole('button', { name: 'Add common categories' }).click()
  const sheet = page.locator('dialog[open]')
  // The seeded ones are already there.
  await expect(sheet.getByRole('checkbox', { name: /^Primary/ })).toBeDisabled()
  await sheet.getByRole('checkbox', { name: 'Intermediate' }).click()
  await sheet.getByRole('checkbox', { name: 'Restricted Premier' }).click()
  // A quick double tap adds them once.
  await sheet.getByRole('button', { name: 'Add 2' }).dblclick()
  await expect(page.getByRole('status').getByText('Added 2 categories')).toBeVisible()
  await page.waitForTimeout(500)
  const cats = Object.values(await dbGet<Record<string, { name: string; _order: number }>>(data('categories')))
  expect(cats.map((c) => [c.name, c._order]).sort((a, b) => Number(a[1]) - Number(b[1]))).toEqual([
    ['Primary', 0],
    ['Beginner', 1],
    ['Novice', 2],
    ['Premier', 3],
    ['Intermediate', 4],
    ['Restricted Premier', 5],
  ])

  const [premierId] = Object.entries(comp.categories).find(([, n]) => n === 'Premier')!
  await row(page, 'Premier').first().click()
  await field(page, 'Name').fill('Premier Open')
  await field(page, 'Name').press('Enter')
  await expectDb(data(`categories/${premierId}/name`), 'Premier Open')

  if (!isPhone(info)) {
    // Drag Restricted Premier to the top.
    await page.goto(manage('/categories'))
    await page.getByLabel('Move Restricted Premier').dragTo(page.getByLabel('Move Primary'), { targetPosition: { x: 10, y: 2 } })
    await expect.poll(async () => {
      const all = await dbGet<Record<string, { name: string; _order: number }>>(data('categories'))
      return Object.values(all).sort((a, b) => a._order - b._order).map((c) => c.name)[0]
    }).toBe('Restricted Premier')
  }

  // Deleting a category in use: its age groups stay, asking for another.
  await page.goto(manage(`/categories/${premierId}`))
  await deleteOpenItem(page, 'category', '3 age groups use it and will need another category.')
  await expectDb(data(`categories/${premierId}`), null)
  const premierGroup = comp.groups.find((g) => g.categoryId === premierId)!
  await page.goto(manage(`/groups/${premierGroup.id}`))
  await expect(page.getByText('This no longer exists. Choose another.')).toBeVisible()
})

test('age groups: add one, choose its dances, copy dances from another, delete with its results', async ({ page }) => {
  const [cat] = Object.entries(comp.categories).find(([, n]) => n === 'Novice')!
  await page.goto(manage('/groups/new'))
  const form = page.locator('form')
  await select(form, 'Category').selectOption({ label: 'Novice' })
  await field(form, 'Age range').fill('14 & Under 16 Years')
  await form.getByRole('button', { name: 'Add age group' }).click()
  await expect(page.getByRole('heading', { name: 'Novice 14 & Under 16 Years' })).toBeVisible()
  const groups = await dbGet<Record<string, { name: string; categoryId: string; _order: number }>>(data('groups'))
  const [newId, added] = Object.entries(groups).find(([, g]) => g.name === '14 & Under 16 Years')!
  expect(added).toEqual({ name: '14 & Under 16 Years', categoryId: cat, _order: comp.groups.length })

  // A trophy and its sponsor (one of the people added as sponsors).
  await field(page, 'Trophy').fill('Adeline Duncan Memorial')
  await field(page, 'Trophy').press('Enter')
  await expectDb(data(`groups/${newId}/trophy`), 'Adeline Duncan Memorial')
  await select(page, 'Trophy sponsor').selectOption({ label: 'Calgary Highland Society' })
  await expectDb(data(`groups/${newId}/sponsor`), `${comp.id}-sponsor`)

  // Dances: none yet; switch one on, then copy another group's set.
  const fling = comp.dances[0]
  await page.getByRole('switch', { name: 'Highland Fling (4)' }).click()
  await expectDb(data(`dances/${fling.id}/groupIds/${newId}`), true)
  await page.getByRole('switch', { name: 'Highland Fling (4)' }).click()
  await expectDb(data(`dances/${fling.id}/groupIds/${newId}`), null)
  await page.getByRole('combobox', { name: 'Same dances as another age group' }).selectOption({ label: `${comp.categories[comp.groups[0].categoryId]} ${comp.groups[0].name}` })
  for (const d of comp.dances) await expectDb(data(`dances/${d.id}/groupIds/${newId}`), true)
  await toastUndo(page).click()
  for (const d of comp.dances) await expectDb(data(`dances/${d.id}/groupIds/${newId}`), null)

  // Delete a group with dancers, draws, results and a place in the schedule.
  const g = comp.groups[0]
  const scheduleBefore = await dbGet(data('schedule'))
  expect(JSON.stringify(scheduleBefore)).toContain(`"${g.id}"`)
  expect(await dbGet(data(`results/${g.id}`))).not.toBeNull()
  await page.goto(manage(`/groups/${g.id}`))
  await page.getByRole('button', { name: 'Delete age group' }).click()
  await expect(confirmDialog(page)).toContainText('Its results and draws will be deleted too.')
  await expect(confirmDialog(page)).toContainText('Also removes it from the schedule.')
  await confirmDialog(page).getByRole('button', { name: 'Delete', exact: true }).click()
  await expectDb(data(`groups/${g.id}`), null)
  expect(await dbGet(data(`results/${g.id}`))).toBeNull()
  expect(await dbGet(data(`draws/${g.id}`))).toBeNull()
  for (const d of comp.dances) expect(await dbGet(data(`dances/${d.id}/groupIds/${g.id}`))).toBeNull()
  const scheduleAfter = JSON.stringify(await dbGet(data('schedule')))
  expect(scheduleAfter).not.toContain(`"${g.id}"`)
  // The other age groups keep their places.
  expect(scheduleAfter).toContain(`"${comp.groups[1].id}"`)
  // Its dancers stay, flagged.
  await navigate(page, manage('/dancers'))
  await expect(page.getByText('Missing age group').first()).toBeVisible()
  // Undo puts it all back.
  await (await barMenuItem(page, /^Undo: Deleted/)).click()
  await expect.poll(() => dbGet(data(`groups/${g.id}/name`))).toBe(g.name)
  expect(await dbGet(data(`results/${g.id}`))).not.toBeNull()
  expect(await dbGet(data('schedule'))).toEqual(scheduleBefore)
})

test('dances: add common ones, choose who dances it, delete with its results', async ({ page }) => {
  await page.goto(manage('/dances'))
  await page.getByRole('button', { name: 'Add common dances' }).click()
  const sheet = page.locator('dialog[open]')
  await sheet.getByRole('checkbox', { name: 'Scottish Lilt (4)' }).click()
  await sheet.getByRole('button', { name: 'Add 1' }).click()
  await expect(page.getByRole('status').getByText('Added 1 dance')).toBeVisible()
  const dances = await dbGet<Record<string, { name: string; shortName?: string; steps?: string }>>(data('dances'))
  const [liltId, lilt] = Object.entries(dances).find(([, d]) => d.name === 'Scottish Lilt')!
  expect(lilt).toMatchObject({ name: 'Scottish Lilt', shortName: 'Lilt', steps: '4' })

  await page.goto(manage(`/dances/${liltId}`))
  const g = comp.groups[4]
  await page.getByRole('switch', { name: `${comp.categories[g.categoryId]} ${g.name}` }).click()
  await expectDb(data(`dances/${liltId}/groupIds/${g.id}`), true)
  await field(page, 'Steps').fill('6')
  await field(page, 'Steps').press('Enter')
  await expectDb(data(`dances/${liltId}/steps`), '6')
  await expect(page.getByRole('heading', { name: 'Scottish Lilt (6)' })).toBeVisible()

  const fling = comp.dances[0]
  const scheduleBefore = await dbGet(data('schedule'))
  expect(JSON.stringify(scheduleBefore)).toContain(`"danceId":"${fling.id}"`)
  await page.goto(manage(`/dances/${fling.id}`))
  await page.getByRole('button', { name: 'Delete dance' }).click()
  await expect(confirmDialog(page)).toContainText('Its results will be deleted too.')
  await expect(confirmDialog(page)).toContainText('Also removes it from the schedule.')
  await confirmDialog(page).getByRole('button', { name: 'Delete', exact: true }).click()
  await expectDb(data(`dances/${fling.id}`), null)
  for (const grp of comp.groups.slice(0, 3)) {
    expect(await dbGet(data(`results/${grp.id}/${fling.id}`))).toBeNull()
    expect(await dbGet(data(`draws/${grp.id}/${fling.id}`))).toBeNull()
  }
  const scheduleAfter = JSON.stringify(await dbGet(data('schedule')))
  expect(scheduleAfter).not.toContain(fling.id)
  expect(scheduleAfter).toContain(`"danceId":"${comp.dances[1].id}"`)
  await (await barMenuItem(page, /^Undo: Deleted/)).click()
  await expect.poll(() => dbGet(data('schedule'))).toEqual(scheduleBefore)
})

test('platforms and judges: deleting takes them out of the schedule', async ({ page }) => {
  const scheduleHas = async (id: string) => JSON.stringify(await dbGet(data('schedule'))).includes(`"${id}"`)
  expect(await scheduleHas(comp.platforms[1])).toBe(true)
  await page.goto(manage(`/platforms/${comp.platforms[1]}`))
  await deleteOpenItem(page, 'platform', 'The schedule puts age groups on it')
  await expectDb(data(`platforms/${comp.platforms[1]}`), null)
  expect(await scheduleHas(comp.platforms[1])).toBe(false)

  const judge = comp.judges[0]
  expect(await scheduleHas(judge)).toBe(true)
  await page.goto(manage(`/staff/${judge}`))
  await deleteOpenItem(page, 'staff member', 'judging in')
  await expectDb(data(`staff/${judge}`), null)
  expect(await scheduleHas(judge)).toBe(false)
})

test('staff: add a judge with a role, website and photo', async ({ page }) => {
  await page.goto(manage('/staff/new'))
  const form = page.locator('form')
  await form.getByRole('button', { name: 'Add staff member' }).click()
  await expect(form.getByText('Role can’t be empty.')).toBeVisible()
  await select(form, 'Role').selectOption('Judge')
  await field(form, 'First name').fill('Seònaid')
  await field(form, 'Last name').fill('MacNeil')
  await field(form, 'Website').fill('example.com/seonaid')
  await form.getByRole('button', { name: 'Add staff member' }).click()
  await expect(page.getByRole('heading', { name: 'Seònaid MacNeil' })).toBeVisible()
  const staff = await dbGet<Record<string, Record<string, unknown>>>(data('staff'))
  const [id, judge] = Object.entries(staff).find(([, s]) => s.firstName === 'Seònaid')!
  expect(judge).toMatchObject({ type: 'Judge', firstName: 'Seònaid', lastName: 'MacNeil', website: 'example.com/seonaid', _order: 5 })

  // A big photo is shrunk on the device to fit the storage rules (under 244 KB).
  const png = await page.evaluate(async () => {
    const c = document.createElement('canvas')
    c.width = 2400
    c.height = 1800
    const ctx = c.getContext('2d')!
    for (let i = 0; i < 4000; i += 1) {
      ctx.fillStyle = `hsl(${i % 360} 70% ${30 + (i % 50)}%)`
      ctx.fillRect(Math.random() * 2400, Math.random() * 1800, 40, 40)
    }
    const blob: Blob = await new Promise((r) => c.toBlob((b) => r(b!), 'image/png'))
    return Array.from(new Uint8Array(await blob.arrayBuffer()))
  })
  expect(png.length).toBeGreaterThan(244 * 1024)
  await page.locator('input[type=file][accept="image/*"]').setInputFiles({ name: 'Seonaid Photo.png', mimeType: 'image/png', buffer: Buffer.from(png) })
  await expect.poll(() => dbGet<string>(data(`staff/${id}/image`)), { timeout: 20000 }).toMatch(/^http.*seonaid-photo/)
  await expect(page.getByRole('button', { name: 'Replace' })).toBeVisible()
  await page.getByRole('button', { name: 'Remove' }).click()
  await expectDb(data(`staff/${id}/image`), null)
})

test('after deleting one of everything, the public pages still work', async ({ page }) => {
  // Six deletes and ten page loads: more than the default 30 s on a busy machine.
  test.slow()
  const errors = collectErrors(page)
  const g = comp.groups[1]
  const dancer = comp.dancers.find((d) => d.groupId === comp.groups[0].id)!
  const cat = comp.groups[2].categoryId
  // Delete a dancer with results, a group in the schedule, a category in use,
  // a dance in the schedule, a platform and a judge: all through Manage.
  await page.goto(manage(`/dancers/${dancer.id}`))
  await deleteOpenItem(page, 'dancer')
  await expectDb(data(`dancers/${dancer.id}`), null)
  await page.goto(manage(`/groups/${g.id}`))
  await deleteOpenItem(page, 'age group')
  await expectDb(data(`groups/${g.id}`), null)
  await page.goto(manage(`/categories/${cat}`))
  await deleteOpenItem(page, 'category')
  await expectDb(data(`categories/${cat}`), null)
  await page.goto(manage(`/dances/${comp.dances[1].id}`))
  await deleteOpenItem(page, 'dance')
  await expectDb(data(`dances/${comp.dances[1].id}`), null)
  await page.goto(manage(`/platforms/${comp.platforms[0]}`))
  await deleteOpenItem(page, 'platform')
  await page.goto(manage(`/staff/${comp.judges[1]}`))
  await deleteOpenItem(page, 'staff member')
  await expectDb(data(`staff/${comp.judges[1]}`), null)
  expect(errors).toEqual([])

  const pub = `/competitions/${comp.id}`
  const pages = [
    `${pub}/info`,
    `${pub}/dancers`,
    `${pub}/dancers/${comp.dancers.find((d) => d.groupId === g.id)!.id}`,
    `${pub}/schedule`,
    `${pub}/schedule/${comp.id}-day1/${comp.id}-b1/${comp.id}-e1`,
    `${pub}/schedule/${comp.id}-day1/${comp.id}-b2/${comp.id}-e3`,
    `${pub}/results`,
    `${pub}/results/${comp.groups[0].id}`,
    `${pub}/results/${g.id}`,
    `${pub}/results/${comp.groups[2].id}`,
  ]
  for (const url of pages) {
    await page.goto(url)
    await page.waitForLoadState('networkidle').catch(() => {})
    await expect(page.locator('main').first()).toBeVisible()
    await page.waitForTimeout(400)
    expect(errors, url).toEqual([])
  }
})

test('phone: Back after adding or deleting skips the add form and the deleted item', async ({ page }, info) => {
  test.skip(!isPhone(info), 'phones only')
  await page.goto(manage())
  await page.getByRole('link', { name: /^Platforms/ }).click()
  await page.getByRole('link', { name: 'Add platform' }).click()
  await field(page, 'Name').fill('Stage')
  await page.locator('form').getByRole('button', { name: 'Add platform' }).click()
  await expect(page.getByRole('heading', { name: 'Stage' })).toBeVisible()
  await page.goBack()
  await expect(page).toHaveURL(manage('/platforms'))

  await row(page, 'Platform A').click()
  await page.getByRole('button', { name: 'Delete platform' }).click()
  await confirmDialog(page).getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(page).toHaveURL(manage('/platforms'))
  await page.goBack()
  await expect(page).toHaveURL(manage())
})
