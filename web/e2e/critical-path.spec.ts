import { expect, test } from '@playwright/test'
import { dbGet, ensureUser, grantCompetition, signIn, uid } from './support/emulator'
import { appTab, hasSidebar } from './support/nav'
import { removeCompetition, seedCompetition, type SeededCompetition } from './support/seed'

// The day in one test: an organiser posts a placing in Manage, and a parent
// following that dancer sees it on Home without reloading.

let comp: SeededCompetition

test.beforeEach(async () => {
  comp = await seedCompetition({ resultsForGroups: 0, dancersPerGroup: 2, uniqueNames: true })
})
test.afterEach(async () => {
  await removeCompetition(comp.id)
})

test('a placing entered in Manage reaches a following parent live', async ({ browser }) => {
  const group = comp.groups.find((g) => g.id.endsWith('-grp-12'))!
  const dancer = comp.dancers.find((d) => d.groupId === group.id)!
  const dance = comp.dances[0]

  const parentEmail = `${uid('parent')}@example.test`
  const organiserEmail = `${uid('organiser')}@example.test`
  await ensureUser(parentEmail)
  await grantCompetition(await ensureUser(organiserEmail), comp.id)

  // Follow keys on the dancer's profile, which the aggregator links back
  // to the competition's dancer record (dancerId) a moment after seeding.
  await expect
    .poll(() => dbGet(`competitions:data/${comp.id}/dancers/${dancer.id}/dancerId`), { timeout: 20_000 })
    .toBeTruthy()

  const parent = await (await browser.newContext()).newPage()
  await signIn(parent, parentEmail)
  await parent.goto(`/competitions/${comp.id}/dancers/${dancer.id}`)
  await parent.getByRole('button', { name: `Follow ${dancer.firstName}`, exact: false }).first().click()
  await expect(parent.getByRole('button', { name: /^Following/ }).first()).toBeVisible()
  // In-app, the way a parent gets there (a fresh load of '/' may resume
  // the last page instead).
  // (Wide screens have no bar to leave from: the sidebar's Home is always there.)
  if (!hasSidebar(parent)) await parent.getByRole('button', { name: /^Leave this competition/ }).click()
  await appTab(parent, 'Home').click()
  await expect(parent).toHaveURL(/\/$/)
  await expect(parent.getByText(`${dancer.firstName} ${dancer.lastName}`).first()).toBeVisible()

  const organiser = await (await browser.newContext()).newPage()
  await signIn(organiser, organiserEmail)
  const results = `/competitions/${comp.id}/manage/results/${group.id}`
  await organiser.goto(`${results}/callbacks`)
  await organiser.getByRole('button', { name: new RegExp(`^${dancer.number}\\b`) }).click()
  await expect(organiser.getByText(/Called back · 1|1 called back/).first()).toBeVisible()
  await organiser.goto(`${results}/${dance.id}`)
  await organiser.getByRole('button', { name: new RegExp(`^${dancer.number}\\b`) }).click()
  await expect
    .poll(() => dbGet<string[]>(`competitions:data/${comp.id}/results/${group.id}/${dance.id}`))
    .toEqual([dancer.id])

  // No reload on the parent's side: the placing arrives live.
  await expect(parent.getByRole('img', { name: '1st place' }).first()).toBeVisible({ timeout: 15_000 })
})
