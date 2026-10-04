import { expect, test } from '@playwright/test'
import { dbSet, uid } from './support/emulator'
import { retry } from './support/retry'
import { removeCompetition, seedCompetition, type SeededCompetition } from './support/seed'

// The public Results pages read results exactly as the old app (and old
// apps still in use) stored them, legacy oddities included.

// One competition for the file (seeding fans out into many triggers).
test.describe.configure({ mode: 'default' })
// The emulator can answer 503 for a moment while triggers fan out.
const put = (path: string, value: unknown) => retry(() => dbSet(path, value))

let comp: SeededCompetition
let shapes: Awaited<ReturnType<typeof seedShapes>>

test.beforeAll(async () => {
  const id = uid('comp')
  comp = await retry(() => seedCompetition({ id, dancersPerGroup: 8, resultsForGroups: 0 }))
  shapes = await seedShapes()
})
test.afterAll(async () => {
  if (comp) await retry(() => removeCompetition(comp.id))
})

const groupEndingIn = (suffix: string) => comp.groups.find((g) => g.id.endsWith(`-grp-${suffix}`))!

async function seedShapes() {
  // Novice 9 & 10: has an Overall.
  const group = groupEndingIn('22')
  const ds = comp.dancers.filter((d) => d.groupId === group.id).map((d) => d.id)
  const [fling, sword, seann, reel] = comp.dances.map((d) => d.id)
  await put(`competitions:data/${comp.id}/results/${group.id}`, {
    callbacks: ds.slice(0, 7),
    // Championship, entered 6th up to 1st, with 2nd shared.
    [fling]: ['reverse:6', ds[5], ds[4], ds[3], ds[2], `${ds[1]}:tie`, ds[0]],
    // Championship switched on, nobody placed yet: not a result.
    [sword]: ['reverse:6'],
    [seann]: false,
    // A "?" stand-in, a dancer deleted since, and a legacy tie on 1st.
    [reel]: [`${ds[0]}:tie`, '1546578400210', `${ds[2]}:tie`, 'deleted-dancer'],
    overall: [ds[0]],
  })
  await put(`competitions:data/${comp.id}/points/${group.id}/${fling}`, { combined: [ds[6], '1546578400299'] })
  return { group, ds, fling, sword, seann, reel }
}

test('an age group shows every stored shape the old app wrote', async ({ page }) => {
  const { group, fling, sword, seann, reel } = shapes
  const named = (i: number) => comp.dancers.filter((d) => d.groupId === group.id)[i]
  await page.goto(`/competitions/${comp.id}/results/${group.id}`)

  const callbacks = page.locator('#dance-callbacks')
  await expect(callbacks.getByText('7 called back')).toBeVisible()
  // Results are still to come (the Sword isn't in), so callbacks lead, open.
  await expect(callbacks.getByRole('button', { name: /^Callbacks/ })).toHaveAttribute('aria-expanded', 'true')
  await callbacks.getByRole('button', { name: 'Show all 8 dancers' }).click()
  await expect(callbacks.getByRole('listitem')).toHaveCount(8)

  const f = page.locator(`#dance-${fling}`)
  const rosettes = f.getByRole('img', { name: /place/ })
  await expect(rosettes).toHaveCount(6)
  await expect(rosettes.nth(0)).toHaveAccessibleName(/(^|: )1st place$/)
  await expect(rosettes.nth(1)).toHaveAccessibleName(/(^|: )2nd place, tied$/)
  await expect(rosettes.nth(2)).toHaveAccessibleName(/(^|: )2nd place, tied$/)
  await expect(rosettes.nth(3)).toHaveAccessibleName(/(^|: )4th place$/)
  await expect(rosettes.nth(5)).toHaveAccessibleName(/(^|: )6th place$/)
  await expect(f.getByRole('listitem').first()).toContainText(named(0).firstName)
  // The "?" point isn't anyone to name.
  await expect(f.getByText('Championship points')).toBeVisible()
  await expect(f.getByText(`${named(6).number} ${named(6).firstName}`)).toBeVisible()

  const s = page.locator(`#dance-${sword}`)
  await expect(s.getByRole('img', { name: /place/ })).toHaveCount(0)
  await expect(s.getByText('No placings for this dance.')).toHaveCount(0)

  await expect(page.locator(`#dance-${seann}`).getByText('No placings for this dance.')).toBeVisible()

  const r = page.locator(`#dance-${reel}`)
  const reelRosettes = r.getByRole('img', { name: /place/ })
  await expect(reelRosettes).toHaveCount(4)
  await expect(reelRosettes.nth(0)).toHaveAccessibleName(/(^|: )1st place$/)
  await expect(reelRosettes.nth(1)).toHaveAccessibleName(/(^|: )2nd place, tied$/)
  await expect(r.getByText('Unknown dancer')).toHaveCount(2)

  await expect(page.locator('#dance-overall').getByRole('img', { name: /(^|: )1st place$/ })).toBeVisible()
})

test('the results list counts what’s posted and flags "?" stand-ins', async ({ page }) => {
  const { group } = shapes
  await page.goto(`/competitions/${comp.id}/results`)
  const row = page.locator(`a[href$="/results/${group.id}"]`)
  // Fling, Seann (none placed), Reel and Overall are in; the Sword isn't.
  await expect(row.getByText('4 of 5')).toBeVisible()
  await expect(row.getByText('Some placings couldn’t be matched to a dancer')).toBeVisible()
  await row.click()
  await expect(page).toHaveURL(new RegExp(`/results/${group.id}$`))
})

test('a link to one dance scrolls to it', async ({ page }) => {
  const { group, reel } = shapes
  await page.goto(`/competitions/${comp.id}/results/${group.id}#dance-${reel}`)
  await expect(page.locator(`#dance-${reel}`)).toBeInViewport()
  await page.goto(`/competitions/${comp.id}/results/${group.id}#dance-overall`)
  await expect(page.locator('#dance-overall')).toBeInViewport()
})

test('old app links to one dance land on it', async ({ page }) => {
  const { group, reel } = shapes
  await page.goto(`/#/competitions/${comp.id}/results/${group.id}/${reel}`)
  await expect(page).toHaveURL(new RegExp(`/results/${group.id}#dance-${reel}$`))
  await expect(page.locator(`#dance-${reel}`)).toBeInViewport()
})

test('placings arrive live on competition day', async ({ page }) => {
  const group = groupEndingIn('32')
  const ds = comp.dancers.filter((d) => d.groupId === group.id)
  const fling = comp.dances[0].id
  await page.goto(`/competitions/${comp.id}/results`)
  await expect(page.getByText('Live', { exact: true })).toBeVisible()
  const row = page.locator(`a[href$="/results/${group.id}"]`)
  await expect(row.getByText(/of 5/)).toHaveCount(0)

  await put(`competitions:data/${comp.id}/results/${group.id}/${fling}`, [ds[3].id, ds[1].id])
  await expect(row.getByText('1 of 5')).toBeVisible()
  await row.click()
  await expect(page.locator(`#dance-${fling}`).getByRole('img', { name: /place/ })).toHaveCount(2)
  await put(`competitions:data/${comp.id}/results/${group.id}/${fling}`, [ds[3].id, `${ds[1].id}:tie`])
  await expect(page.locator(`#dance-${fling}`).getByRole('img', { name: '1st place, tied' })).toHaveCount(2)
})

test('an age group that isn’t there any more says so', async ({ page }) => {
  await page.goto(`/competitions/${comp.id}/results/not-a-group`)
  await expect(page.getByText('This age group isn’t listed any more.')).toBeVisible()
})

test('day two of a competition: dances still to come aren’t “never posted”', async ({ page }) => {
  // Started yesterday; Premier dances today (day two of the schedule).
  const id = uid('comp')
  const twoDay = await retry(() => seedCompetition({ id, startOffset: -1, dancersPerGroup: 2, resultsForGroups: 0 }))
  try {
    const premier = twoDay.groups.find((g) => g.id.endsWith('-grp-30'))!
    await page.goto(`/competitions/${twoDay.id}/results/${premier.id}`)
    await expect(page.getByText(/No results yet/).first()).toBeVisible()
    await expect(page.getByText('No result was posted for this dance.')).toHaveCount(0)
  } finally {
    await retry(() => removeCompetition(id))
  }
})

// Last in the file: it hides this competition's results.
test('a competition that hides its results says so', async ({ page }) => {
  await put(`competitions:data/${comp.id}/results`, false)
  await page.goto(`/competitions/${comp.id}/results`)
  await expect(page.getByText('No results here')).toBeVisible()
  await expect(page.getByText(/results posted/)).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Results', exact: true })).toHaveCount(0)
  await page.goto(`/competitions/${comp.id}/results/${shapes.group.id}`)
  await expect(page.getByText('No results here')).toBeVisible()
  await expect(page.getByText('No results yet.')).toHaveCount(0)
})
