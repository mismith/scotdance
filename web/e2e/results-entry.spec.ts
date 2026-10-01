import { readFile } from 'node:fs/promises'
import { expect, test, type Page } from '@playwright/test'
import {
  dbGet,
  dbSet,
  ensureUser,
  grantCompetition,
  signIn,
  uid,
} from './support/emulator'
import { retry } from './support/retry'
import {
  removeCompetition,
  seedCompetition,
  type SeededCompetition,
} from './support/seed'
import { barMenuItem, confirmDialog, sectionMenuItem } from './support/manageData'

// Results entry in Manage, as an organiser (not a system admin, so the
// database rules are what let the writes through). It mirrors the old admin
// and must store exactly what the old app stored, since old apps still read
// it: results/{group}/{dance} = ["reverse:N"?, "id", "id:tie", …] | false.

// One competition for the file (seeding fans out into many triggers), and
// each test enters results for an age group of its own.
test.describe.configure({ mode: 'default' })
// The emulator can answer 503 for a moment while triggers fan out.
const put = (path: string, value: unknown) => retry(() => dbSet(path, value))

let comp: SeededCompetition
let email: string

test.beforeAll(async () => {
  const id = uid('comp')
  comp = await retry(() =>
    seedCompetition({ id, dancersPerGroup: 8, resultsForGroups: 0 }),
  )
  email = `${uid('org')}@example.test`
  const user = await ensureUser(email)
  await retry(() => grantCompetition(user, comp.id))
})
test.afterAll(async () => {
  if (comp) await retry(() => removeCompetition(comp.id))
})

// One age group per test: Beginner, Novice and Premier first (they have an
// Overall), then Primary.
const GROUPS = ['10', '11', '12', '20', '21', '22', '30', '31', '32', '00', '01']
let next = 0
function freshGroup() {
  const suffix = `-grp-${GROUPS[next++ % GROUPS.length]}`
  return comp.groups.find((g) => g.id.endsWith(suffix))!
}
const dancersOf = (groupId: string) => comp.dancers.filter((d) => d.groupId === groupId)
const stored = (path: string) => dbGet(`competitions:data/${comp.id}/${path}`)
const entry = (page: Page, groupId: string, danceId: string) =>
  page.goto(`/competitions/${comp.id}/manage/results/${groupId}/${danceId}`)
/** A dancer's row in the list to tap (its name starts with the number). */
const tap = (page: Page, number: string) =>
  page.getByRole('button', { name: new RegExp(`^${number}\\b`) }).first()

async function callBack(groupId: string, ids: string[]) {
  await put(`competitions:data/${comp.id}/results/${groupId}/callbacks`, ids)
}

test('callbacks, then placings with a tie, reach the public page live', async ({
  page,
  browser,
}) => {
  test.slow()
  const group = freshGroup()
  const ds = dancersOf(group.id)
  const fling = comp.dances[0]

  const viewer = await (await browser.newContext()).newPage()
  await viewer.goto(`/competitions/${comp.id}/results/${group.id}`)
  const section = viewer.locator(`#dance-${fling.id}`)
  await expect(section).toBeVisible()

  await signIn(page, email)
  await entry(page, group.id, 'callbacks')
  for (const d of ds.slice(0, 6)) await tap(page, d.number).click()
  await expect(page.getByText('Called back · 6')).toBeVisible()
  await expect
    .poll(() => stored(`results/${group.id}/callbacks`))
    .toEqual(ds.slice(0, 6).map((d) => d.id))

  await page.getByRole('link', { name: /^Next: Highland Fling/ }).click()
  await expect(page.getByRole('heading', { name: /Highland Fling/ })).toBeVisible()
  // Only dancers called back are offered.
  await expect(tap(page, ds[6].number)).toHaveCount(0)
  for (const d of ds.slice(0, 4)) await tap(page, d.number).click()
  // The third dancer shares second place.
  await page.getByRole('switch', { name: 'Tied with the dancer above' }).nth(1).click()
  await expect
    .poll(() => stored(`results/${group.id}/${fling.id}`))
    .toEqual([ds[0].id, ds[1].id, `${ds[2].id}:tie`, ds[3].id])

  // No reload on the public side.
  await expect(section.getByRole('img', { name: '1st place', exact: true })).toBeVisible()
  await expect(section.getByRole('img', { name: '2nd place, tied' })).toHaveCount(2)
  await expect(section.getByRole('img', { name: '4th place', exact: true })).toBeVisible()

  // Tap a placed dancer to take them out: the tie stays with who's left.
  await page
    .getByRole('button', { name: `Take out ${ds[1].firstName} ${ds[1].lastName}` })
    .click()
  await expect
    .poll(() => stored(`results/${group.id}/${fling.id}`))
    .toEqual([ds[0].id, ds[2].id, ds[3].id])
  await expect(section.getByRole('img', { name: '3rd place', exact: true })).toBeVisible()

  // Undo puts them back; redo takes them out again.
  await (await barMenuItem(page, /^Undo: Took out/)).click()
  await expect
    .poll(() => stored(`results/${group.id}/${fling.id}`))
    .toEqual([ds[0].id, ds[1].id, `${ds[2].id}:tie`, ds[3].id])
  await expect(page.getByText(/^Undone: Took out/)).toBeVisible()
  await page.keyboard.press('ControlOrMeta+Shift+z')
  await expect
    .poll(() => stored(`results/${group.id}/${fling.id}`))
    .toEqual([ds[0].id, ds[2].id, ds[3].id])
})

test('Championship can be switched on before anyone is placed', async ({
  page,
  browser,
}) => {
  test.slow()
  const group = freshGroup()
  const ds = dancersOf(group.id)
  const sword = comp.dances[1]
  await callBack(
    group.id,
    ds.map((d) => d.id),
  )

  const viewer = await (await browser.newContext()).newPage()
  await viewer.goto(`/competitions/${comp.id}/results`)
  const row = viewer.locator(`a[href$="/results/${group.id}"]`)
  await expect(row).toBeVisible()

  await signIn(page, email)
  await entry(page, group.id, sword.id)
  const championship = page.getByRole('switch', { name: 'Championship' })
  await championship.click()
  await page.getByRole('button', { name: /^6th/ }).click()
  // Stored as the old admin stored it, and the switch stays on.
  await expect
    .poll(() => stored(`results/${group.id}/${sword.id}`))
    .toEqual(['reverse:6'])
  await expect(championship).toHaveAttribute('aria-checked', 'true')
  await expect(page.getByText('Entering from 6th place')).toBeVisible()
  // A championship start alone isn't a posted result.
  await expect(row.getByText(/of \d+$/)).toHaveCount(0)

  // Announced from 6th up to 1st.
  const announced = ds.slice(0, 6).reverse()
  for (const d of announced) await tap(page, d.number).click()
  await expect
    .poll(() => stored(`results/${group.id}/${sword.id}`))
    .toEqual(['reverse:6', ...announced.map((d) => d.id)])
  // The placed list shows 1st at the top.
  const placed = page.getByRole('button', { name: /^Take out / })
  await expect(placed.first()).toHaveAccessibleName(
    `Take out ${ds[0].firstName} ${ds[0].lastName}`,
  )

  // Tie 1st and 2nd: the switch on the second row.
  await page.getByRole('switch', { name: 'Tied with the dancer above' }).first().click()
  await expect
    .poll(() => stored(`results/${group.id}/${sword.id}`))
    .toEqual(['reverse:6', ...announced.slice(0, 5).map((d) => d.id), `${ds[0].id}:tie`])

  const group6 = viewer.locator(`#dance-${sword.id}`)
  await viewer.goto(`/competitions/${comp.id}/results/${group.id}`)
  await expect(group6.getByRole('img', { name: '1st place, tied' })).toHaveCount(2)
  await expect(group6.getByRole('img', { name: '3rd place', exact: true })).toBeVisible()

  // Taking everyone out keeps Championship on.
  for (const d of announced)
    await page
      .getByRole('button', { name: `Take out ${d.firstName} ${d.lastName}` })
      .click()
  await expect
    .poll(() => stored(`results/${group.id}/${sword.id}`))
    .toEqual(['reverse:6'])
  await expect(championship).toHaveAttribute('aria-checked', 'true')

  // Off again: nothing stored.
  await championship.click()
  await expect.poll(() => stored(`results/${group.id}/${sword.id}`)).toBeNull()
  await expect(championship).toHaveAttribute('aria-checked', 'false')
})

test('a "?" stand-in can be placed and then fixed', async ({ page }, info) => {
  const group = freshGroup()
  const ds = dancersOf(group.id)
  const fling = comp.dances[0]
  await callBack(
    group.id,
    ds.slice(0, 4).map((d) => d.id),
  )
  await put(`competitions:data/${comp.id}/points/${group.id}/${fling.id}/combined`, [
    ds[3].id,
  ])

  await signIn(page, email)
  await entry(page, group.id, fling.id)
  await tap(page, ds[0].number).click()
  await page.getByRole('button', { name: /^\? Dancer/ }).click()
  await tap(page, ds[2].number).click()
  await expect
    .poll(
      async () =>
        ((await stored(`results/${group.id}/${fling.id}`)) as string[] | null)?.length,
    )
    .toBe(3)
  const [first, standIn, third] = (await stored(
    `results/${group.id}/${fling.id}`,
  )) as string[]
  expect([first, third]).toEqual([ds[0].id, ds[2].id])
  expect(standIn).toMatch(/^\d+$/)
  // The sidebar (on wide screens) flags it until it's fixed.
  const flag = page.getByRole('link', { name: /1 result needs fixing/ })
  if (info.project.name === 'desktop') await expect(flag).toBeVisible()

  // Choose who it was: they take the stand-in's place.
  await page.getByRole('button', { name: 'Choose' }).click()
  // Not someone placed already, nor the dancer with a point.
  const choices = page.getByRole('dialog').getByRole('button', { name: /^\d+ / })
  await expect(choices).toHaveCount(1)
  await page.getByRole('searchbox').fill(ds[1].number)
  await page
    .getByRole('dialog')
    .getByRole('button', { name: new RegExp(`^${ds[1].number}\\b`) })
    .click()
  await expect
    .poll(() => stored(`results/${group.id}/${fling.id}`))
    .toEqual([ds[0].id, ds[1].id, ds[2].id])
  if (info.project.name === 'desktop') await expect(flag).toHaveCount(0)
})

test('championship points: give, take away, and never to a placed dancer', async ({
  page,
}) => {
  const group = freshGroup()
  const ds = dancersOf(group.id)
  const fling = comp.dances[0]
  await callBack(
    group.id,
    ds.map((d) => d.id),
  )
  await put(`competitions:data/${comp.id}/results/${group.id}/${fling.id}`, [
    ds[0].id,
    ds[1].id,
  ])

  await signIn(page, email)
  await entry(page, group.id, fling.id)
  await page.getByRole('tab', { name: /Points/ }).click()
  await expect(tap(page, ds[0].number)).toBeDisabled()
  await tap(page, ds[5].number).click()
  await tap(page, ds[6].number).click()
  await expect
    .poll(() => stored(`points/${group.id}/${fling.id}`))
    .toEqual({ combined: [ds[5].id, ds[6].id] })
  await page.getByRole('button', { name: `Take the point from ${ds[5].number}` }).click()
  await expect
    .poll(() => stored(`points/${group.id}/${fling.id}`))
    .toEqual({ combined: [ds[6].id] })

  // Back on Placings, a pointed dancer can't be placed.
  await page.getByRole('tab', { name: 'Placings' }).click()
  await expect(tap(page, ds[6].number)).toBeDisabled()
})

test('"No dancers placed", and the next dance carries on', async ({ page, browser }) => {
  const group = freshGroup()
  const reel = comp.dances[3]
  await callBack(
    group.id,
    dancersOf(group.id).map((d) => d.id),
  )

  await signIn(page, email)
  await entry(page, group.id, reel.id)
  await page.getByRole('switch', { name: 'No dancers placed' }).click()
  await expect.poll(() => stored(`results/${group.id}/${reel.id}`)).toBe(false)
  await page.getByRole('link', { name: 'Next: Overall' }).click()
  await expect(page.getByRole('heading', { name: 'Overall' })).toBeVisible()

  const viewer = await (await browser.newContext()).newPage()
  await viewer.goto(`/competitions/${comp.id}/results/${group.id}`)
  await expect(
    viewer.locator(`#dance-${reel.id}`).getByText('No placings for this dance.'),
  ).toBeVisible()
})

test('fast taps keep their order; a double tap takes the dancer back out', async ({
  page,
}) => {
  const group = freshGroup()
  const ds = dancersOf(group.id)
  const fling = comp.dances[0]
  await callBack(
    group.id,
    ds.map((d) => d.id),
  )

  await signIn(page, email)
  await entry(page, group.id, fling.id)
  await expect(tap(page, ds[7].number)).toBeEnabled()
  for (const d of [...ds].reverse()) await tap(page, d.number).click({ delay: 0 })
  await expect
    .poll(() => stored(`results/${group.id}/${fling.id}`))
    .toEqual([...ds].reverse().map((d) => d.id))

  await page
    .getByRole('button', { name: `Take out ${ds[0].firstName} ${ds[0].lastName}` })
    .click()
  await tap(page, ds[0].number).dblclick()
  await expect
    .poll(() => stored(`results/${group.id}/${fling.id}`))
    .toEqual(
      [...ds]
        .reverse()
        .slice(0, 7)
        .map((d) => d.id),
    )
})

test('a second device builds on the first one’s placings', async ({ page, browser }) => {
  test.slow()
  const group = freshGroup()
  const ds = dancersOf(group.id)
  const fling = comp.dances[0]
  await callBack(
    group.id,
    ds.map((d) => d.id),
  )

  await signIn(page, email)
  await entry(page, group.id, fling.id)
  const other = await (await browser.newContext()).newPage()
  await signIn(other, email)
  await entry(other, group.id, fling.id)

  await tap(page, ds[0].number).click()
  await expect(
    other.getByRole('button', { name: `Take out ${ds[0].firstName} ${ds[0].lastName}` }),
  ).toBeVisible()
  await tap(other, ds[1].number).click()
  await expect(
    page.getByRole('button', { name: `Take out ${ds[1].firstName} ${ds[1].lastName}` }),
  ).toBeVisible()
  await expect
    .poll(() => stored(`results/${group.id}/${fling.id}`))
    .toEqual([ds[0].id, ds[1].id])
})

test('offline: entry is disabled, and comes back', async ({ page, context }) => {
  const group = freshGroup()
  const ds = dancersOf(group.id)
  await signIn(page, email)
  await entry(page, group.id, 'callbacks')
  await expect(tap(page, ds[0].number)).toBeEnabled()
  await context.setOffline(true)
  await expect(tap(page, ds[0].number)).toBeDisabled()
  await expect(page.getByText('Offline').first()).toBeVisible()
  await context.setOffline(false)
  await expect(tap(page, ds[0].number)).toBeEnabled({ timeout: 15_000 })
  await tap(page, ds[0].number).click()
  await expect.poll(() => stored(`results/${group.id}/callbacks`)).toEqual([ds[0].id])
})

test('age groups with no dancers, or nobody called back, explain what to do', async ({
  page,
}) => {
  const group = freshGroup()
  await put(`competitions:data/${comp.id}/groups/${comp.id}-grp-empty`, {
    name: 'Empty',
    categoryId: group.categoryId,
    _order: 99,
  })
  await signIn(page, email)
  await entry(page, `${comp.id}-grp-empty`, 'callbacks')
  await expect(page.getByText('No dancers found')).toBeVisible()
  await entry(page, group.id, comp.dances[0].id)
  await expect(page.getByText('No dancers to place')).toBeVisible()
  await page.getByRole('link', { name: 'Enter callbacks ›' }).click()
  await expect(page.getByRole('heading', { name: 'Callbacks' })).toBeVisible()
})

test('an old link to a dance that isn’t in the age group enters nothing', async ({
  page,
}) => {
  const group = comp.groups[0]
  await signIn(page, email)
  await entry(page, group.id, 'not-a-dance')
  await expect(
    page.getByText('This dance isn’t in this age group any more'),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: /^\? Dancer/ })).toHaveCount(0)
})

test('drag a placed dancer to the top: they lose the tie they had', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'desktop', 'Mouse drag')
  const group = freshGroup()
  const ds = dancersOf(group.id)
  const fling = comp.dances[0]
  await callBack(
    group.id,
    ds.map((d) => d.id),
  )
  // 2nd and 3rd tied.
  await put(`competitions:data/${comp.id}/results/${group.id}/${fling.id}`, [
    ds[0].id,
    ds[1].id,
    `${ds[2].id}:tie`,
  ])

  await signIn(page, email)
  await entry(page, group.id, fling.id)
  const rows = page
    .getByRole('listitem')
    .filter({ has: page.getByRole('button', { name: /^Take out / }) })
  await expect(rows).toHaveCount(3)
  await rows.nth(2).locator('[data-handle]').dragTo(rows.nth(0))
  await expect
    .poll(() => stored(`results/${group.id}/${fling.id}`))
    .toEqual([ds[2].id, ds[0].id, ds[1].id])
})

test('the results spreadsheet has every placing and championship point', async ({
  page,
}) => {
  const group = freshGroup()
  const ds = dancersOf(group.id)
  const fling = comp.dances[0]
  await put(`competitions:data/${comp.id}/results/${group.id}/${fling.id}`, [
    'reverse:3',
    ds[2].id,
    `${ds[1].id}:tie`,
    ds[0].id,
  ])
  await put(`competitions:data/${comp.id}/points/${group.id}/${fling.id}/combined`, [
    ds[5].id,
  ])

  await signIn(page, email)
  await page.goto(`/competitions/${comp.id}/manage/results`)
  // Rarely needed, so in the ⋯ menu.
  await page.getByRole('button', { name: 'More for results' }).click()
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download all results' }).click(),
  ])
  const rows = (await readFile((await download.path())!, 'utf8'))
    .replace(/^﻿/, '')
    .split('\n')
  expect(rows[0]).toBe(
    'Category,Age group,Dance,Place,Number,First name,Last name,Location',
  )
  const mine = rows.filter((r) =>
    r.startsWith(`${comp.categories[group.categoryId]},${group.name},${fling.name} (4),`),
  )
  expect(mine.map((r) => r.split(',').slice(3, 6))).toEqual([
    ['2', ds[2].number, ds[2].firstName],
    ['2', ds[1].number, ds[1].firstName],
    ['1', ds[0].number, ds[0].firstName],
    ['Point', ds[5].number, ds[5].firstName],
  ])
})

test('Primary age groups have no championship points to enter', async ({ page }) => {
  const primary = comp.groups.find((g) => g.categoryId.endsWith('-cat-pri'))!
  const beginner = comp.groups.find((g) => g.categoryId.endsWith('-cat-beg'))!
  const fling = comp.dances[0]
  const points = `competitions:data/${comp.id}/points/${primary.id}`
  const before = await stored(`points/${primary.id}`)
  await put(points, null)
  try {
    await signIn(page, email)
    await entry(page, beginner.id, fling.id)
    await expect(page.getByRole('tab', { name: /Points/ })).toBeVisible()
    await entry(page, primary.id, fling.id)
    await expect(page.getByRole('heading', { name: /Highland Fling/ })).toBeVisible()
    await expect(page.getByRole('tablist')).toHaveCount(0)
    // Points an older app stored anyway still show, so they can be taken away.
    await put(`${points}/${fling.id}/combined`, [dancersOf(primary.id)[0].id])
    await expect(page.getByRole('tab', { name: /Points/ })).toBeVisible()
  } finally {
    await put(points, before)
  }
})

test('hiding the Results tab asks first, can be undone, and Show brings it back', async ({
  page,
}) => {
  const before = await stored('results')
  await signIn(page, email)
  await page.goto(`/competitions/${comp.id}/manage/results`)
  // Tucked away in the ⋯ menu, as it deletes what's entered.
  const hide = () => sectionMenuItem(page, 'More for results', 'Hide the Results tab')
  await (await hide()).click()
  const dialog = confirmDialog(page)
  await expect(dialog).toContainText('Hide the Results tab?')
  await dialog.getByRole('button', { name: 'Cancel' }).click()
  await expect(page.getByText('Results are hidden')).toBeHidden()
  expect(await stored('results')).toEqual(before)

  await (await hide()).click()
  await dialog.getByRole('button', { name: /^Hide results$/ }).click()
  await expect(page.getByText('Results are hidden')).toBeVisible()
  await expect.poll(() => stored('results')).toBe(false)
  await page
    .getByRole('status')
    .getByRole('button', { name: 'Undo', exact: true })
    .last()
    .click()
  await expect.poll(() => stored('results')).toEqual(before)

  await (await hide()).click()
  await dialog.getByRole('button', { name: /^Hide results$/ }).click()
  await page.getByRole('button', { name: 'Show the Results tab' }).click()
  await expect(await hide()).toBeEnabled()
  await expect.poll(() => stored('results')).toBeNull()
  await put(`competitions:data/${comp.id}/results`, before)
})
