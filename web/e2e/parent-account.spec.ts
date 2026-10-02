import { expect, test } from '@playwright/test'
import { dbGet, dbSet, ensureUser, uid } from './support/emulator'
import { openAccount, sheet, signInFromSheet } from './support/parent'

// Your account: the record System admin finds you by, and deleting it all.

test('every account has a record with its email, mended if it’s missing or old', async ({ page }) => {
  const email = `${uid('parent')}@example.test`
  const id = await ensureUser(email)
  // An account from before v4 kept one, with an old address and a name.
  await dbSet(`users/${id}`, { email: 'old@example.test', displayName: 'Morag' })
  await page.goto('/')
  await page.getByRole('main').getByRole('button', { name: 'Sign in', exact: true }).click()
  await signInFromSheet(page, email)
  await expect.poll(() => dbGet(`users/${id}`)).toEqual({ email, displayName: 'Morag' })

  // A brand-new account gets one too.
  const fresh = `${uid('parent')}@example.test`
  await openAccount(page)
  await page.getByRole('button', { name: 'Sign out' }).click()
  await page.getByRole('main').getByRole('button', { name: 'Sign in', exact: true }).click()
  const s = sheet(page)
  await s.getByRole('button', { name: 'New here? Create an account' }).click()
  await s.getByRole('textbox', { name: 'Email address' }).fill(fresh)
  await s.locator('input[name=password]').fill('password1')
  await s.getByRole('button', { name: 'Create account' }).click()
  await expect(page.getByRole('heading', { name: 'How do you use ScotDance.app?' })).toBeVisible()
  const freshId = await ensureUser(fresh, 'password1')
  await expect.poll(() => dbGet(`users/${freshId}/email`)).toBe(fresh)
})

test('deleting your account removes your follows, colours and record', async ({ page }) => {
  const email = `${uid('parent')}@example.test`
  const id = await ensureUser(email)
  await dbSet(`users:favorites/${id}`, { dancers: { p1: 'Isla Ross' }, competitions: { c1: true } })
  await dbSet(`users:dancerColors/${id}`, { p1: 'dancer-3' })
  await page.goto('/')
  await page.getByRole('main').getByRole('button', { name: 'Sign in', exact: true }).click()
  await signInFromSheet(page, email)
  await expect.poll(() => dbGet(`users/${id}/email`)).toBe(email)

  await openAccount(page)
  await page.getByRole('button', { name: 'Delete account' }).click()
  const s = sheet(page)
  await expect(s.getByRole('heading', { name: 'Delete your account?' })).toBeVisible()
  // A wrong password stops it, kindly.
  await s.locator('input[autocomplete=current-password]').fill('nope')
  await s.getByRole('button', { name: 'Delete my account' }).click()
  await expect(s.getByRole('alert')).toHaveText('That password isn’t right. Check it and try again.')
  await s.locator('input[autocomplete=current-password]').fill('password')
  await s.getByRole('button', { name: 'Delete my account' }).click()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('main').getByRole('button', { name: 'Sign in', exact: true })).toBeVisible()

  expect(await dbGet(`users/${id}`)).toBeNull()
  expect(await dbGet(`users:favorites/${id}`)).toBeNull()
  expect(await dbGet(`users:dancerColors/${id}`)).toBeNull()
  // The sign-in is gone too: the same email makes a new account.
  expect(await ensureUser(email)).not.toBe(id)
})
