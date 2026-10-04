import { expect, test, type Page } from '@playwright/test'
import { dbGet, dbRemove, ensureUser, grantCompetition, grantSystemAdmin, signIn, uid } from './support/emulator'
import { removeCompetition, seedCompetition, type SeededCompetition } from './support/seed'
import { barMenuItem } from './support/manageData'

// Getting around Manage: Back one level at a time on phones, out to the
// competition on wide screens, deep links, old links, Undo and Redo.

const backButton = (page: Page) => page.getByRole('navigation').getByRole('button', { name: /^Back to / })

async function organiser(comp: SeededCompetition) {
  const email = `${uid('org')}@example.test`
  const id = await ensureUser(email)
  await grantCompetition(id, comp.id)
  return { email, id }
}

test('on a phone, Back climbs one level at a time, then leaves Manage for good', async ({ page }, info) => {
  test.skip(info.project.name !== 'phone', 'phone layout')
  const comp = await seedCompetition({ dancersPerGroup: 2 })
  const org = await organiser(comp)
  try {
    await signIn(page, org.email)
    await page.goto('/competitions')
    await page.goto(`/competitions/${comp.id}/info`)
    await page.getByRole('link', { name: 'Manage this competition' }).click()
    await page.getByRole('navigation', { name: 'Manage sections' }).getByRole('link', { name: /Dancers/ }).click()
    const dancer = comp.dancers[0]
    await page.getByRole('main').getByRole('link', { name: new RegExp(`${dancer.firstName} ${dancer.lastName}`) }).first().click()
    await expect(page).toHaveURL(new RegExp(`/manage/dancers/${dancer.id}$`))

    for (const [label, path] of [
      ['Dancers', '/manage/dancers'],
      ['Manage', '/manage'],
      [comp.name, '/info'],
    ]) {
      await expect(backButton(page)).toHaveAccessibleName(`Back to ${label}`)
      await backButton(page).click()
      await expect(page).toHaveURL(new RegExp(`/competitions/${comp.id}${path}$`))
    }
    // The browser's (and Android's) back now leaves, rather than walking
    // forward into Manage again.
    await page.goBack()
    await expect(page).toHaveURL(/\/competitions$/)
  } finally {
    await Promise.all([removeCompetition(comp.id), dbRemove(`users:permissions/${org.id}`)])
  }
})

test('on a phone, a schedule’s day is a tab, so Back goes up to Manage', async ({ page }, info) => {
  test.skip(info.project.name !== 'phone', 'phone layout')
  const comp = await seedCompetition({ dancersPerGroup: 1 })
  const org = await organiser(comp)
  try {
    await signIn(page, org.email)
    await page.goto(`/competitions/${comp.id}/manage/schedule/${comp.id}-day2`)
    await expect(backButton(page)).toHaveAccessibleName('Back to Manage')
  } finally {
    await Promise.all([removeCompetition(comp.id), dbRemove(`users:permissions/${org.id}`)])
  }
})

test('on a wide screen, Back leaves Manage for the competition', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'wide layout')
  const comp = await seedCompetition({ dancersPerGroup: 2 })
  const org = await organiser(comp)
  try {
    await signIn(page, org.email)
    await page.goto(`/competitions/${comp.id}/manage/dancers/${comp.dancers[0].id}`)
    await expect(backButton(page)).toHaveAccessibleName(`Back to ${comp.name}`)
    await page.getByRole('navigation', { name: 'Manage sections' }).first().getByRole('link', { name: /Platforms/ }).click()
    await backButton(page).click()
    await expect(page).toHaveURL(new RegExp(`/competitions/${comp.id}/info$`))
  } finally {
    await Promise.all([removeCompetition(comp.id), dbRemove(`users:permissions/${org.id}`)])
  }
})

test('a deep Manage link opens the item, and survives a reload', async ({ page }) => {
  const comp = await seedCompetition({ dancersPerGroup: 2 })
  const org = await organiser(comp)
  const dancer = comp.dancers[0]
  try {
    await signIn(page, org.email)
    await page.goto(`/competitions/${comp.id}/manage/dancers/${dancer.id}`)
    await expect(page.getByRole('textbox', { name: 'First name' })).toHaveValue(dancer.firstName)
    await page.reload()
    await expect(page.getByRole('textbox', { name: 'First name' })).toHaveValue(dancer.firstName)
  } finally {
    await Promise.all([removeCompetition(comp.id), dbRemove(`users:permissions/${org.id}`)])
  }
})

test('old admin links land in Manage and System admin', async ({ page }) => {
  const comp = await seedCompetition({ dancersPerGroup: 1 })
  try {
    await page.goto(`/competitions/${comp.id}/admin/dancers`)
    await expect(page).toHaveURL(new RegExp(`/competitions/${comp.id}/manage$`))
    await page.goto(`/#/competitions/${comp.id}/admin`)
    await expect(page).toHaveURL(new RegExp(`/competitions/${comp.id}/manage$`))
    await page.goto('/admin/info/versions')
    await expect(page).toHaveURL(/\/admin\/tools$/)
    await page.goto('/more')
    await expect(page).toHaveURL(/\/settings$/)
  } finally {
    await removeCompetition(comp.id)
  }
})

test('Undo and Redo put a change back and forward again', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'Redo shows on wide screens')
  const comp = await seedCompetition({ dancersPerGroup: 1 })
  const org = await organiser(comp)
  try {
    await signIn(page, org.email)
    await page.goto(`/competitions/${comp.id}/manage/details`)
    // By label: a search box with a Maps key, a plain one without (as in CI).
    const venue = page.getByLabel('Venue name', { exact: true })
    await venue.fill('Corn Exchange')
    await venue.press('Enter')
    await expect.poll(() => dbGet(`competitions/${comp.id}/venue`)).toBe('Corn Exchange')
    // The ⋯ button says so, in words, for a moment (and screen readers hear it).
    await expect(page.getByRole('button', { name: 'Undo and redo' })).toContainText('Saved')
    await expect(page.getByRole('status').filter({ hasText: 'Saved' })).toBeAttached()

    await (await barMenuItem(page, /^Undo/)).click()
    await expect.poll(() => dbGet(`competitions/${comp.id}/venue`)).toBe('Spruce Meadows')
    await expect(venue).toHaveValue('Spruce Meadows')

    // The keyboard too, when not typing in a field.
    await page.getByRole('heading', { name: 'Details' }).click()
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+Shift+z' : 'Control+y')
    await expect.poll(() => dbGet(`competitions/${comp.id}/venue`)).toBe('Corn Exchange')
    // Nothing left to redo (the menu closed after Undo; open it to look).
    await expect(await barMenuItem(page, /^Redo/)).toBeDisabled()
    await page.keyboard.press('Escape')
  } finally {
    await Promise.all([removeCompetition(comp.id), dbRemove(`users:permissions/${org.id}`)])
  }
})

test('Manage competitions is up to date after creating and deleting one', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'one layout is enough')
  const email = `${uid('sys')}@example.test`
  const id = await ensureUser(email)
  await grantSystemAdmin(id)
  const name = `E2E New ${uid('c').slice(-6)}`
  const listed = () => page.getByRole('main').getByRole('link', { name: new RegExp(name) })
  let created: string | null = null
  try {
    await signIn(page, email)
    await page.goto('/manage')
    await expect(page.getByRole('heading', { name: 'Coming up' })).toBeVisible()
    await page.getByRole('button', { name: 'New competition' }).click()
    const sheet = page.locator('dialog[open]')
    await sheet.getByRole('textbox', { name: 'Name' }).fill(name)
    await sheet.locator('input[type=date]').fill('2027-05-01')
    await sheet.getByRole('button', { name: 'Create' }).click()
    await expect(page).toHaveURL(/\/manage\/details$/)
    created = page.url().split('/competitions/')[1].split('/')[0]

    // In-app, so the list would come from what was read before.
    await page.goBack()
    await expect(listed()).toBeVisible()

    await listed().click()
    await page.getByRole('navigation', { name: 'Manage sections' }).first().getByRole('link', { name: /Details/ }).click()
    await page.getByRole('button', { name: 'Delete competition' }).click()
    await page.locator('dialog[open]').getByRole('button', { name: 'Delete competition' }).click()
    await expect(page).toHaveURL(/\/manage$/)
    await expect(page.getByRole('heading', { name: 'Coming up' })).toBeVisible()
    await expect(listed()).toHaveCount(0)
    created = null
  } finally {
    if (created) await removeCompetition(created)
    await dbRemove(`users:permissions/${id}`)
  }
})

test('on competition day, Manage leads straight to results: two taps from the list', async ({ page }) => {
  // Seeded for today, with results for the first two age groups' dances.
  const comp = await seedCompetition({ dancersPerGroup: 2 })
  const org = await organiser(comp)
  try {
    await signIn(page, org.email)
    await page.goto('/manage')
    await page.getByRole('link', { name: 'Enter results' }).first().click()
    await expect(page).toHaveURL(new RegExp(`/competitions/${comp.id}/manage/results$`))

    // On the Overview, the line under the name carries on where entry left off:
    // the schedule's first age group with nothing in yet (Primary 7 & 8 has
    // results; the next on its platform's list is Beginner).
    await page.goto(`/competitions/${comp.id}/manage`)
    const carryOn = page.getByRole('main').getByRole('link', { name: /^Enter results Carry on/ })
    await expect(carryOn).toContainText('Carry on:')
    await carryOn.click()
    await expect(page).toHaveURL(new RegExp(`/manage/results/${comp.id}-grp-`))
  } finally {
    await Promise.all([removeCompetition(comp.id), dbRemove(`users:permissions/${org.id}`)])
  }
})

test('setting up, the first unfinished step says it’s next, with its button', async ({ page }, info) => {
  const comp = await seedCompetition({ dancersPerGroup: 1, startOffset: 30 })
  await dbRemove(`competitions:data/${comp.id}/staff`)
  const org = await organiser(comp)
  try {
    await signIn(page, org.email)
    await page.goto(`/competitions/${comp.id}/manage`)
    const nav = page.getByRole('navigation', { name: 'Manage sections' }).first()
    await expect(nav.getByRole('link', { name: /Staff\s*Next/ })).toBeVisible()
    if (info.project.name === 'phone') {
      await page.getByRole('main').getByRole('link', { name: 'Add a judge' }).click()
    } else {
      // Wide, the steps are in the sidebar: the Overview has Up next instead.
      await expect(page.getByRole('heading', { name: 'Up next' })).toBeVisible()
      await expect(page.getByRole('heading', { name: 'Step by step' })).toHaveCount(0)
      await page.getByRole('main').getByRole('link', { name: 'Add a judge' }).click()
    }
    await expect(page).toHaveURL(new RegExp(`/manage/staff/new$`))
  } finally {
    await Promise.all([removeCompetition(comp.id), dbRemove(`users:permissions/${org.id}`)])
  }
})
