import { expect, test, type Page } from '@playwright/test'
import { dbGet, dbSet, ensureUser, signIn, uid } from './support/emulator'
import { removeCompetition, seedCompetition, type SeededCompetition } from './support/seed'
import { retry } from './support/retry'
import { collectErrors, expectDb, signInOrganiser, toastUndo } from './support/manageData'

// Teams (ADR 0012): an entry danced by several people (a duet, a trio or a
// group). Families see it with its dancers, and its dancers' profiles and
// follows take it in; organisers add one on the dancer form and import them.

type Json = Record<string, unknown>
let comp: SeededCompetition
let tag: string
const group = () => `${comp.id}-grp-duet`
const team = () => `${comp.id}-team-1`
const path = (p: string) => `competitions:data/${comp.id}/${p}`
// Names nobody else's tests share (profiles merge by name across
// competitions), spelled like names: letters only, as the team reader expects.
const fresh = (first: string) => ({ firstName: first, lastName: `Duet${tag}` })

test.beforeAll(async () => {
  tag = uid('t').slice(-5).replace(/\d/g, (d) => 'abcdefghij'[Number(d)])
  comp = await retry(() => seedCompetition({ dancersPerGroup: 3, uniqueNames: true, resultsForGroups: 0 }))
  const solo = comp.dancers[0]
  await dbSet(path(`categories/${comp.id}-cat-cho`), { name: 'Choreography', _order: 9 })
  await dbSet(path(`groups/${group()}`), { name: 'Duet', categoryId: `${comp.id}-cat-cho`, teams: true, _order: 9 })
  await dbSet(path(`dances/${comp.id}-dance-cho`), { name: 'Choreography', groupIds: { [group()]: true }, _order: 9 })
  await dbSet(path(`dancers/${team()}`), {
    team: true,
    number: '401',
    title: 'Celtic Sisters',
    studio: 'Thistle School of Dance',
    groupId: group(),
    categoryId: `${comp.id}-cat-cho`,
    firstName: 'Celtic Sisters',
    lastName: 'Thistle School of Dance',
    members: {
      a: { firstName: solo.firstName, lastName: solo.lastName, _order: 0 },
      b: { ...fresh('Wren'), _order: 1 },
    },
  })
  await dbSet(path(`results/${group()}/${comp.id}-dance-cho`), [team()])
  // The server links each dancer to their profile.
  await expect.poll(async () => (await dbGet<Json | null>(path(`dancers/${team()}/members`))) ?? {}, { timeout: 20_000 }).toMatchObject({
    a: { dancerId: expect.any(String) },
    b: { dancerId: expect.any(String) },
  })
})
test.afterAll(async () => {
  await retry(() => removeCompetition(comp.id))
})

const competition = (page: Page, p = '') => page.goto(`/competitions/${comp.id}${p}`)

test('a team is listed with its dancers, found by any of their names, and has its own page', async ({ page }) => {
  const errors = collectErrors(page)
  await competition(page, '/dancers')
  const row = page.getByRole('link', { name: /Celtic Sisters/ })
  await expect(row).toContainText(`Wren Duet${tag}`)
  await page.getByRole('searchbox').fill(`Wren Duet${tag}`)
  await expect(page.getByRole('link', { name: /Celtic Sisters/ })).toBeVisible()

  await page.getByRole('link', { name: /Celtic Sisters/ }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Celtic Sisters' })).toBeVisible()
  await expect(page.getByText(/^2 dancers/)).toBeVisible()
  await expect(page.getByText(/Choreography Duet · Thistle School of Dance/)).toBeVisible()
  const dancers = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Dancers' }) })
  await expect(dancers.getByRole('link', { name: new RegExp(`Wren Duet${tag}`) })).toBeVisible()
  // The one also dancing a solo here says so, and opens that entry.
  const solo = comp.dancers[0]
  await expect(dancers.getByRole('link', { name: new RegExp(`${solo.firstName} ${solo.lastName}.*Also dancing`) })).toBeVisible()
  expect(errors).toEqual([])
})

test('a dancer’s page lists their team among their entries', async ({ page }) => {
  const solo = comp.dancers[0]
  await competition(page, `/dancers/${solo.id}`)
  await expect(page.getByRole('heading', { level: 1, name: `${solo.firstName} ${solo.lastName}` })).toBeVisible()
  await expect(page.getByText('Celtic Sisters · Choreography Duet')).toBeVisible()
})

test('favouriting one of its dancers takes in the team', async ({ page }) => {
  const email = `${uid('fan')}@example.test`
  await ensureUser(email)
  await signIn(page, email)
  await competition(page, `/dancers/${team()}`)
  const wren = `Wren Duet${tag}`
  await page.getByRole('button', { name: `Favourite ${wren}`, pressed: false }).click()
  await expect(page.getByRole('button', { name: `Favourite ${wren}`, pressed: true })).toBeVisible()
  // On the competition's list, the team wears Wren's colour and shows under Only my dancers.
  await competition(page, '/dancers')
  await page.getByRole('switch', { name: 'Only my dancers' }).click()
  await expect(page.getByRole('link', { name: /Celtic Sisters/ })).toBeVisible()
  await expect(page.getByRole('link', { name: new RegExp(comp.dancers[1].firstName) })).toHaveCount(0)
})

test('an organiser adds a duet on the dancer form: a name offered, another dancer, then a routine', async ({ page }) => {
  const errors = collectErrors(page)
  await signInOrganiser(page, comp.id)
  await page.goto(`/competitions/${comp.id}/manage/dancers`)
  await page.getByRole('link', { name: 'Add dancer' }).click()
  const form = page.locator('form')
  await form.getByRole('textbox', { name: /^Number/ }).fill('402')
  await form.getByRole('combobox', { name: /^Age group/ }).selectOption(group())
  // Someone dancing here already: their name offered as it's typed.
  const solo = comp.dancers[1]
  await form.getByRole('combobox', { name: 'First name', exact: true }).pressSequentially(solo.firstName.slice(0, 3))
  await form.getByRole('option', { name: new RegExp(`^${solo.firstName} ${solo.lastName}\\s*${solo.number}\\b`) }).click()
  await expect(form.getByRole('combobox', { name: 'Last name', exact: true })).toHaveValue(solo.lastName)
  await expect(page.getByRole('heading', { name: 'Add dancer' })).toBeVisible()
  await form.getByRole('button', { name: 'Add another dancer' }).click()
  const newcomer = fresh('Skye')
  await form.getByRole('combobox', { name: 'First name, dancer 2' }).fill(newcomer.firstName)
  await form.getByRole('combobox', { name: 'Last name, dancer 2' }).fill(newcomer.lastName)
  // Two dancers: a duet.
  await expect(page.getByRole('heading', { name: 'Add duet' })).toBeVisible()
  await form.getByRole('button', { name: 'Add a routine' }).click()
  await form.getByRole('textbox', { name: /^Routine/ }).fill('Silver Sails')
  await form.getByRole('button', { name: 'Add duet', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Silver Sails' })).toBeVisible()

  const added = await retry(async () => {
    const all = (await dbGet<Record<string, Json>>(path('dancers'))) ?? {}
    const found = Object.entries(all).find(([, d]) => d.title === 'Silver Sails')
    if (!found) throw new Error('not saved yet')
    return found
  })
  expect(added[1]).toMatchObject({ team: true, number: '402', groupId: group(), firstName: 'Silver Sails' })
  await expect.poll(async () => Object.values((await dbGet<Record<string, Json>>(path(`dancers/${added[0]}/members`))) ?? {}).filter((m) => m.dancerId).length, { timeout: 20_000 }).toBe(2)

  // Taking a dancer off leaves one dancing on their own, and can be undone.
  await page.getByRole('button', { name: `Take ${newcomer.firstName} ${newcomer.lastName} off` }).click()
  await expect.poll(() => dbGet(path(`dancers/${added[0]}/team`))).toBeNull()
  await toastUndo(page).click()
  await expect.poll(async () => Object.keys((await dbGet<Json>(path(`dancers/${added[0]}/members`))) ?? {}).length).toBe(2)
  expect(errors).toEqual([])
})

test('another dancer makes a saved dancer a duet', async ({ page }) => {
  await signInOrganiser(page, comp.id)
  const d = comp.dancers[2]
  await page.goto(`/competitions/${comp.id}/manage/dancers/${d.id}`)
  await page.getByRole('button', { name: 'Add another dancer' }).click()
  const partner = fresh('Ailsa')
  await page.getByRole('combobox', { name: 'First name, dancer 2' }).fill(partner.firstName)
  await page.getByRole('combobox', { name: 'Last name, dancer 2' }).fill(partner.lastName)
  await page.getByRole('combobox', { name: 'Last name, dancer 2' }).press('Enter')
  await expectDb(path(`dancers/${d.id}/team`), true)
  await expect.poll(async () => Object.values((await dbGet<Record<string, Json>>(path(`dancers/${d.id}/members`))) ?? {}).map((m) => m.firstName)).toEqual([d.firstName, partner.firstName])
  await expect(page.getByRole('button', { name: 'Delete duet' })).toBeVisible()
})

test('an import makes one entry of rows sharing a number', async ({ page }) => {
  await signInOrganiser(page, comp.id)
  await page.goto(`/competitions/${comp.id}/manage/dancers/import`)
  const a = fresh('Isla')
  const b = fresh('Mairi')
  await page.getByRole('button', { name: 'Paste' }).click()
  await page.getByPlaceholder(/^Number/).fill(
    [
      'Number\tFirst name\tLast name\tLocation\tStudio\tCategory\tAge group',
      `403\t${a.firstName}\t${a.lastName}\tON\tThistle School of Dance\tChoreography\tDuet`,
      `403\t${b.firstName}\t${b.lastName}\tON\tThistle School of Dance\tChoreography\tDuet`,
    ].join('\n'),
  )
  await page.getByRole('button', { name: 'Use these cells' }).click()
  await expect(page.getByText(`${a.firstName} ${a.lastName} & ${b.firstName} ${b.lastName}`)).toBeVisible()
  await page.getByRole('button', { name: /^Import 1 entry$/ }).click()
  await expect.poll(async () => {
    const all = (await dbGet<Record<string, Json>>(path('dancers'))) ?? {}
    return Object.values(all).find((d) => d.number === '403')
  }).toMatchObject({ team: true, studio: 'Thistle School of Dance', location: 'ON', groupId: group() })
})
