import { expect, test } from '@playwright/test'
import { dbGet, dbSet, ensureUser, signIn, uid } from './support/emulator'
import { openAccount } from './support/parent'

test('legacy answers stay untouched and Manage follows permissions on desktop and phone', async ({ page }, testInfo) => {
  const email = `${uid('retired-roles')}@example.test`
  const id = await ensureUser(email)
  const roles = { organizer: true, teacher: true }
  const answeredAt = 1700000000000
  await dbSet(`users/${id}`, { email, roles, rolesAnsweredAt: answeredAt })
  await page.addInitScript(() => localStorage.setItem('roles:pending', 'true'))
  await signIn(page, email)
  await page.goto('/')
  await expect(page.getByText('How do you use ScotDance.app?', { exact: true })).toHaveCount(0)
  const phone = testInfo.project.name === 'phone'
  if (phone) await page.getByRole('button', { name: 'More', exact: true }).click()
  const manage = phone ? page.getByRole('button', { name: 'Manage', exact: true }) : page.getByRole('link', { name: 'Manage', exact: true })
  await expect(manage).toHaveCount(0)
  await dbSet(`users:permissions/${id}`, { organisations: { 'test-org': true } })
  await expect(manage).toBeVisible()
  await dbSet(`users:permissions/${id}`, {})
  await expect(manage).toHaveCount(0)
  if (phone) await page.keyboard.press('Escape')
  await openAccount(page)
  await expect(page.getByText('How you use ScotDance.app', { exact: true })).toHaveCount(0)
  expect(await dbGet(`users/${id}/roles`)).toEqual(roles)
  expect(await dbGet(`users/${id}/rolesAnsweredAt`)).toBe(answeredAt)
})

test('compact Home rows follow dancer count, ignoring saved teacher answers', async ({ page }) => {
  const email = `${uid('retired-teacher')}@example.test`
  const id = await ensureUser(email)
  await dbSet(`users/${id}`, { email, roles: { teacher: true }, rolesAnsweredAt: 1700000000000 })
  const dancers = Object.fromEntries(Array.from({ length: 7 }, (_, i) => [uid(`person-${i}`), `Example Dancer ${i}`]))
  for (const [key, name] of Object.entries(dancers)) await dbSet(`dancers/${key}`, { name })
  const six = Object.fromEntries(Object.entries(dancers).slice(0, 6))
  await dbSet(`users:favorites/${id}/dancers`, six)
  await signIn(page, email)
  await page.goto('/')
  const first = page.getByRole('main').getByRole('link').filter({ hasText: 'Example Dancer 0' })
  await expect(first).toBeVisible()
  const compactFirst = page.locator('main li').filter({ has: page.getByRole('link').filter({ hasText: 'Example Dancer 0' }) })
  await expect(compactFirst).toHaveCount(0)
  await dbSet(`users:favorites/${id}/dancers`, dancers)
  await expect(compactFirst).toHaveCount(1)
  await dbSet(`users:favorites/${id}/dancers`, six)
  await expect(compactFirst).toHaveCount(0)
})
