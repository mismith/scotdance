import { expect, test } from '@playwright/test'
import { ensureUser, grantCompetition, signIn, uid } from './support/emulator'
import { removeCompetition, seedCompetition } from './support/seed'

test('a seeded competition shows on its info page', async ({ page }) => {
  const comp = await seedCompetition()
  try {
    await page.goto(`/competitions/${comp.id}/info`)
    await expect(page.getByRole('heading', { level: 1, name: comp.name })).toBeVisible()
  } finally {
    await removeCompetition(comp.id)
  }
})

test('an organiser can sign in and open Manage', async ({ page }) => {
  const comp = await seedCompetition()
  const email = `${uid('org')}@example.test`
  const id = await ensureUser(email)
  await grantCompetition(id, comp.id)
  try {
    await signIn(page, email)
    await page.goto(`/competitions/${comp.id}/manage`)
    await expect(page.getByRole('heading', { name: comp.name }).first()).toBeVisible()
  } finally {
    await removeCompetition(comp.id)
  }
})
