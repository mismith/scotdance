import { expect, test } from '@playwright/test'
import { dbGet, dbRemove, dbSet, ensureUser, grantSystemAdmin, signIn, uid } from './support/emulator'
import { removeCompetition, seedCompetition } from './support/seed'

// System admin: Users (find someone, give and take away access), the
// submissions inbox, and the maintenance tools.

test.skip(({ isMobile }) => isMobile, 'one layout is enough here')

async function systemAdmin() {
  const email = `${uid('sys')}@example.test`
  const id = await ensureUser(email)
  await grantSystemAdmin(id)
  return { email, id }
}

test('Users: find someone by email, let them manage a competition, then stop', async ({ page }) => {
  const comp = await seedCompetition({ dancersPerGroup: 1 })
  const sys = await systemAdmin()
  const email = `${uid('person')}@example.test`
  const person = await ensureUser(email)
  // The record Users lists (as v3 wrote on sign-up).
  await dbSet(`users/${person}`, { email, displayName: 'Morag Ross' })
  try {
    await signIn(page, sys.email)
    await page.goto('/admin/users')
    await page.getByRole('searchbox', { name: 'Search users' }).fill(email.slice(0, 18))
    await page.getByRole('link', { name: /Morag Ross/ }).click()
    await expect(page).toHaveURL(new RegExp(`/admin/users/${person}$`))
    await expect(page.getByText('Competitions they manage')).toBeVisible()

    await page.getByRole('button', { name: 'Add a competition' }).click()
    await page.locator('dialog[open]').getByRole('searchbox', { name: 'Find a competition' }).fill(comp.name)
    await page.locator('dialog[open]').getByRole('button', { name: new RegExp(comp.name) }).click()
    await expect(page.getByText(`Can now manage ${comp.name}`)).toBeVisible()
    expect(await dbGet(`users:permissions/${person}/competitions/${comp.id}`)).toBe(true)
    expect(await dbGet(`competitions:permissions/${comp.id}/users/${person}`)).toBe(true)

    await page.getByRole('listitem').filter({ hasText: comp.name }).getByRole('button', { name: 'Remove' }).click()
    await expect(page.getByText(`No longer manages ${comp.name}`)).toBeVisible()
    expect(await dbGet(`users:permissions/${person}`)).toBeNull()
    expect(await dbGet(`competitions:permissions/${comp.id}/users/${person}`)).toBeNull()

    // Renaming shows straight away in the list, which is only read once.
    const name = page.getByRole('textbox', { name: 'Name' })
    await name.fill('Morag Ross-Fraser')
    await name.press('Enter')
    await expect(page.getByRole('link', { name: /Morag Ross-Fraser/ })).toBeVisible()
  } finally {
    await Promise.all([removeCompetition(comp.id), dbRemove(`users/${person}`), dbRemove(`users:permissions/${person}`), dbRemove(`users:permissions/${sys.id}`)])
  }
})

test('Submissions: tidy one up, or delete it', async ({ page }) => {
  const sys = await systemAdmin()
  const id = uid('sub')
  await dbSet(`competitions:submissions/${id}`, {
    competition: { name: `E2E Submission ${id.slice(-5)}`, date: '2027-06-05', location: 'Calgary' },
    contact: { name: 'Morag Test', email: 'morag@example.test', message: 'First one!' },
    submitted: new Date().toISOString(),
  })
  try {
    await signIn(page, sys.email)
    await page.goto(`/admin/submissions/${id}`)
    await expect(page.getByRole('heading', { name: `E2E Submission ${id.slice(-5)}` })).toBeVisible()
    await expect(page.getByText('First one!')).toBeVisible()

    const location = page.getByRole('textbox', { name: 'Town or city' })
    await location.fill('Calgary, AB')
    await location.press('Enter')
    await expect.poll(() => dbGet(`competitions:submissions/${id}/competition/location`)).toBe('Calgary, AB')

    await page.getByRole('button', { name: 'Delete' }).click()
    await page.locator('dialog[open]').getByRole('button', { name: 'Delete' }).click()
    // Beside the others it says so; if it was the only one, the inbox is empty.
    await expect(page.getByText(/^(This submission isn’t here any more|No submissions)$/)).toBeVisible()
    expect(await dbGet(`competitions:submissions/${id}`)).toBeNull()
  } finally {
    await Promise.all([dbRemove(`competitions:submissions/${id}`), dbRemove(`users:permissions/${sys.id}`)])
  }
})

test('Tools: rebuilding the published list and search reports back', async ({ page }) => {
  test.setTimeout(120_000)
  const sys = await systemAdmin()
  try {
    await signIn(page, sys.email)
    await page.goto('/admin/tools')
    for (const [label, result] of [
      ['Published and listed competitions lists', /^Done: \d+ published, \d+ listed\.$/],
      ['Competitions search', /^Done: \d+ indexed\.$/],
    ] as const) {
      const row = page.getByRole('listitem').filter({ hasText: label })
      await row.getByRole('button', { name: 'Rebuild' }).click()
      await expect(row.getByText(result)).toBeVisible({ timeout: 90_000 })
    }
    // Dancer search starts from empty (the old apps' search too), so it asks first.
    const dancers = page.getByRole('listitem').filter({ hasText: 'Dancers search' })
    await dancers.getByRole('button', { name: 'Rebuild' }).click()
    const ask = page.getByRole('dialog').filter({ hasText: 'Rebuild dancer search?' })
    await expect(ask).toContainText('empty here and in the old apps')
    await ask.getByRole('button', { name: 'Cancel' }).click()
    await expect(ask).toHaveCount(0)
    await expect(dancers.getByText(/^Done/)).toHaveCount(0)
  } finally {
    await dbRemove(`users:permissions/${sys.id}`)
  }
})

test('Submissions: waiting ones first, approved ones folded away, ⌘Enter to approve', async ({ page }) => {
  const sys = await systemAdmin()
  const [waiting, done] = [uid('sub'), uid('sub')]
  await dbSet(`competitions:submissions/${waiting}`, {
    competition: { name: `E2E Waiting ${waiting.slice(-5)}`, date: '2027-06-05', location: 'Calgary, AB' },
    contact: { name: 'Morag Test', email: 'morag@example.test' },
    submitted: new Date().toISOString(),
  })
  await dbSet(`competitions:submissions/${done}`, {
    competition: { name: `E2E Approved ${done.slice(-5)}`, date: '2027-06-12', location: 'Banff, AB' },
    contact: { name: 'Isla Test', email: 'isla@example.test' },
    submitted: new Date(Date.now() - 86_400_000).toISOString(),
    approved: new Date().toISOString(),
  })
  try {
    await signIn(page, sys.email)
    await page.goto(`/admin/submissions/${waiting}`)
    await expect(page.getByRole('heading', { name: `E2E Waiting ${waiting.slice(-5)}` })).toBeVisible()
    await expect(page.getByRole('link', { name: new RegExp(`E2E Waiting ${waiting.slice(-5)}`) })).toBeVisible()
    const fold = page.getByRole('button', { name: /^Approved/ })
    await expect(fold).toHaveAttribute('aria-expanded', 'false')
    await expect(page.getByRole('link', { name: new RegExp(`E2E Approved ${done.slice(-5)}`) })).toHaveCount(0)
    await fold.click()
    await expect(page.getByRole('link', { name: new RegExp(`E2E Approved ${done.slice(-5)}`) })).toBeVisible()

    // The keyboard asks to approve the open one (Cancel leaves it waiting).
    await page.goto(`/admin/submissions/${waiting}`)
    await expect(page.getByRole('button', { name: 'Approve', exact: true })).toBeVisible()
    await page.keyboard.press('ControlOrMeta+Enter')
    await expect(page.locator('dialog[open]')).toContainText(`Approve E2E Waiting ${waiting.slice(-5)}?`)
    await page.locator('dialog[open]').getByRole('button', { name: 'Cancel' }).click()
    expect(await dbGet(`competitions:submissions/${waiting}/approved`)).toBeNull()
  } finally {
    await Promise.all([dbRemove(`competitions:submissions/${waiting}`), dbRemove(`competitions:submissions/${done}`), dbRemove(`users:permissions/${sys.id}`)])
  }
})
