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
