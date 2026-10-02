import { expect, test, type Page } from '@playwright/test'
import { dbRemove, ensureUser, grantCompetition, grantSystemAdmin, signIn, uid } from './support/emulator'
import { removeCompetition, seedCompetition } from './support/seed'

// Who can open Manage and System admin, checked against the real database
// rules: signed out, a plain account, an organiser of one competition (not
// another), and a system admin.

/** Finish signing in on a sheet that's already open. */
async function signInOnSheet(page: Page, email: string) {
  await page.getByRole('textbox', { name: 'Email address' }).fill(email)
  await page.locator('input[name=password]').fill('password')
  await page.locator('input[name=password]').press('Enter')
  await page.locator('dialog[open]').waitFor({ state: 'detached' })
}

const backButton = (page: Page) => page.getByRole('navigation').getByRole('button', { name: /^Back to / })

/**
 * Resolves once the database has refused (or revoked) a read: nothing on
 * screen shows it, so watch Firebase's own traffic (a websocket, or long
 * polling when that's slow to open). Gives up waiting after 10 seconds.
 */
function refusal(page: Page) {
  return new Promise<void>((resolve) => {
    const seen = (text: string) => {
      if (text.includes('permission_denied') || text.includes('"a":"c"')) resolve()
    }
    page.on('websocket', (ws) => ws.on('framereceived', ({ payload }) => seen(String(payload))))
    page.on('response', (r) => {
      if (r.url().includes('.lp')) r.text().then(seen, () => {})
    })
    setTimeout(resolve, 10_000)
  })
}

test('signed out, Manage and System admin ask you to sign in', async ({ page }) => {
  const comp = await seedCompetition()
  try {
    await page.goto(`/competitions/${comp.id}/manage/dancers`)
    await expect(page.getByText('Sign in to manage this competition')).toBeVisible()
    // Nothing to climb back through: Back leaves for the competition.
    await expect(backButton(page)).toHaveAccessibleName(`Back to ${comp.name}`)

    await page.goto('/manage')
    await expect(page.getByText('Sign in to manage your competitions')).toBeVisible()

    await page.goto('/admin/users')
    await expect(page.getByText('Sign in to continue')).toBeVisible()
  } finally {
    await removeCompetition(comp.id)
  }
})

test('an organiser manages their own competition, and only that', async ({ page }) => {
  const [mine, other] = await Promise.all([seedCompetition(), seedCompetition()])
  const email = `${uid('org')}@example.test`
  const id = await ensureUser(email)
  await grantCompetition(id, mine.id)
  try {
    await signIn(page, email)

    await page.goto('/manage')
    await expect(page.getByRole('main').getByRole('link', { name: new RegExp(mine.name) })).toBeVisible()
    await expect(page.getByRole('main').getByText(other.name)).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Submit a competition' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'System admin' })).toHaveCount(0)

    // The pencil into Manage shows on their competition only.
    await page.goto(`/competitions/${mine.id}/info`)
    await expect(page.getByRole('link', { name: 'Manage this competition' })).toBeVisible()
    await page.goto(`/competitions/${other.id}/info`)
    await expect(page.getByRole('heading', { name: other.name })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Manage this competition' })).toHaveCount(0)

    await page.goto(`/competitions/${mine.id}/manage/dancers`)
    await expect(page.getByRole('heading', { name: /^Dancers/ })).toBeVisible()
    await expect(page.getByText(`${mine.dancers[0].firstName} ${mine.dancers[0].lastName}`).first()).toBeVisible()

    await page.goto(`/competitions/${other.id}/manage/details`)
    await expect(page.getByText('You can’t manage this competition')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Back to the competition' })).toBeVisible()

    await page.goto('/admin/submissions')
    await expect(page.getByText('For system admins only')).toBeVisible()
  } finally {
    await Promise.all([removeCompetition(mine.id), removeCompetition(other.id), dbRemove(`users:permissions/${id}`)])
  }
})

test('a system admin manages any competition, and a missing one says so', async ({ page }) => {
  const comp = await seedCompetition({ published: false })
  const email = `${uid('sys')}@example.test`
  const id = await ensureUser(email)
  await grantSystemAdmin(id)
  try {
    await signIn(page, email)
    await page.goto(`/competitions/${comp.id}/manage`)
    await expect(page.getByRole('heading', { name: comp.name })).toBeVisible()

    await page.goto(`/competitions/${uid('missing')}/manage`)
    await expect(page.getByText('Competition not found')).toBeVisible()

    await page.goto('/admin')
    for (const name of ['Submissions', 'Users', 'Tools']) await expect(page.getByRole('main').getByRole('link', { name: new RegExp(name) })).toBeVisible()
  } finally {
    await Promise.all([removeCompetition(comp.id), dbRemove(`users:permissions/${id}`)])
  }
})

test('signing in on a private competition’s Manage page loads it', async ({ page }) => {
  // Firebase refuses the signed-out read and never retries it by itself.
  const comp = await seedCompetition({ published: false })
  const email = `${uid('org')}@example.test`
  const id = await ensureUser(email)
  await grantCompetition(id, comp.id)
  const dancer = `${comp.dancers[0].firstName} ${comp.dancers[0].lastName}`
  try {
    const refused = refusal(page)
    await page.goto(`/competitions/${comp.id}/manage/dancers`)
    await expect(page.getByText('Sign in to manage this competition')).toBeVisible()
    await refused
    await page.getByRole('main').getByRole('button', { name: 'Sign in' }).click()
    await signInOnSheet(page, email)
    await expect(page.getByRole('heading', { name: `Dancers ${comp.dancers.length}` })).toBeVisible()
    await expect(page.getByText(dancer).first()).toBeVisible()

    // Signing out and back in from the account menu, too.
    const revoked = refusal(page)
    await page.getByRole('button', { name: /^Signed in as/ }).click()
    await page.getByRole('button', { name: 'Sign out' }).click()
    await expect(page.getByText('Sign in to manage this competition')).toBeVisible()
    await revoked
    await page.getByRole('main').getByRole('button', { name: 'Sign in' }).click()
    await signInOnSheet(page, email)
    await expect(page.getByText(dancer).first()).toBeVisible()
  } finally {
    await Promise.all([removeCompetition(comp.id), dbRemove(`users:permissions/${id}`)])
  }
})

test('access given while the page is open applies straight away', async ({ page }) => {
  const comp = await seedCompetition({ published: false })
  const email = `${uid('org')}@example.test`
  const id = await ensureUser(email)
  try {
    await signIn(page, email)
    await page.goto(`/competitions/${comp.id}/manage/dancers`)
    await expect(page.getByText('You can’t manage this competition')).toBeVisible()
    await grantCompetition(id, comp.id)
    await expect(page.getByText(`${comp.dancers[0].firstName} ${comp.dancers[0].lastName}`).first()).toBeVisible()
  } finally {
    await Promise.all([removeCompetition(comp.id), dbRemove(`users:permissions/${id}`)])
  }
})

test('Manage competitions and System admin sit together: last in More, and in the account menu', async ({ page }) => {
  const email = `${uid('admin')}@example.test`
  const id = await ensureUser(email)
  await grantSystemAdmin(id)
  await signIn(page, email)

  await page.goto('/')
  await page.getByRole('button', { name: /^Signed in as / }).click()
  const account = page.getByRole('dialog', { name: 'Your account' })
  await expect(account.getByRole('button', { name: 'Manage competitions' })).toBeVisible()
  await expect(account.getByRole('button', { name: 'System admin' })).toBeVisible()
  await page.keyboard.press('Escape')

  await page.getByRole('navigation', { name: 'App' }).getByRole('button', { name: 'More' }).click()
  const more = page.getByRole('dialog', { name: 'More' }).getByRole('button')
  await expect(more.nth(-2)).toHaveText('Manage competitions')
  await expect(more.nth(-1)).toHaveText('System admin')
  await page.keyboard.press('Escape')

  // Settings doesn't repeat them; About comes before the questions.
  await page.goto('/settings')
  await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible()
  await expect(page.getByRole('main').getByRole('link', { name: 'Manage competitions' })).toHaveCount(0)
  const help = page.getByRole('main').getByRole('link')
  await expect(help.nth(0)).toHaveText('About ScotDance')
  await expect(help.nth(1)).toHaveText('Questions and answers')
})

test('a plain account sees neither in More', async ({ page }) => {
  const email = `${uid('parent')}@example.test`
  await ensureUser(email)
  await signIn(page, email)
  await page.goto('/')
  await page.getByRole('navigation', { name: 'App' }).getByRole('button', { name: 'More' }).click()
  const menu = page.getByRole('dialog', { name: 'More' })
  await expect(menu.getByRole('button', { name: 'About ScotDance' })).toBeVisible()
  await expect(menu.getByRole('button', { name: /Manage competitions|System admin/ })).toHaveCount(0)
})
