import { expect, test } from '@playwright/test'
import { as, account, callFunction } from './support/backend'
import { dbGet, dbRemove, dbSet, signIn, uid } from './support/emulator'
import { isoDay } from './support/seed'

// Linked competitions (ADR 0007): linking through the server, what the
// others take from the primary (and can't change themselves), one alert when
// the set goes live, and switching between them.

type Logged = { uid?: string; title?: string; body?: string; kind?: string; competitionId?: string }
const logFor = async (who: string) =>
  Object.values((await dbGet<Record<string, Logged>>('notifications:log')) ?? {}).filter((m) => m.uid === who)

const judge = (firstName: string, lastName: string) => ({ type: 'Judge', firstName, lastName, location: 'Halifax, NS' })

test.describe('the server', () => {
  test.skip(({ isMobile }) => isMobile, 'rules and functions: one layout is enough')
  test.describe.configure({ mode: 'serial' })

  const fri = uid('link-fri')
  const sat = uid('link-sat')
  const other = uid('link-other')
  const organiserEmail = `${uid('link-organiser')}@example.test`
  let organiser: Awaited<ReturnType<typeof account>>
  let stranger: Awaited<ReturnType<typeof account>>
  let linkId = ''

  test.beforeAll(async () => {
    organiser = await account(organiserEmail)
    stranger = await account(`${uid('link-stranger')}@example.test`)
    await dbSet(`competitions/${fri}`, {
      name: `Friday Open ${fri}`, date: isoDay(20), venue: 'Halifax Convention Centre', location: 'Halifax, NS',
      description: 'Two days of dancing.', listed: true, published: false,
    })
    await dbSet(`competitions/${sat}`, { name: `Saturday Classic ${sat}`, date: isoDay(21), venue: 'Riverside Arena', location: 'Halifax, NS', listed: true })
    await dbSet(`competitions/${other}`, { name: `Someone Else’s ${other}`, date: isoDay(21), listed: true })
    await dbSet(`competitions:data/${fri}/staff`, { j1: judge('Ailsa', 'Grant'), j2: judge('Morag', 'Fraser') })
    await dbSet(`competitions:data/${sat}/staff`, { x1: judge('Iain', 'Sutherland') })
    for (const id of [fri, sat]) {
      await dbSet(`users:permissions/${organiser.uid}/competitions/${id}`, true)
      await dbSet(`competitions:permissions/${id}/users/${organiser.uid}`, true)
    }
  })

  test.afterAll(async () => {
    for (const id of [fri, sat, other]) {
      await dbRemove(`competitions/${id}`)
      await dbRemove(`competitions:data/${id}`)
      await dbRemove(`competitionLinks:of/${id}`)
      await dbRemove(`competitionLinks:sync/${id}`)
    }
    if (linkId) await dbRemove(`competitionLinks/${linkId}`)
    for (const a of [organiser, stranger]) {
      await dbRemove(`users:permissions/${a.uid}`)
      await dbRemove(`users:favorites/${a.uid}`)
      await dbRemove(`users/${a.uid}/alerts`)
    }
  })

  test('linking needs you to manage both, and copies the primary into the other', async () => {
    expect((await callFunction('linkCompetitions', { action: 'link', competitionId: sat, withId: fri }, stranger)).error?.status).toBe('PERMISSION_DENIED')
    expect((await callFunction('linkCompetitions', { action: 'link', competitionId: other, withId: fri }, organiser)).error?.status).toBe('PERMISSION_DENIED')

    // A dry run says what it would replace, and changes nothing.
    const dry = await callFunction<{ targets: Array<{ parts: Array<{ part: string; replaces: boolean }> }> }>(
      'linkCompetitions', { action: 'link', competitionId: sat, withId: fri, dryRun: true }, organiser,
    )
    const replaces = Object.fromEntries(dry.result!.targets[0].parts.map((p) => [p.part, p.replaces]))
    expect(replaces).toMatchObject({ venue: true, staff: true, about: false })
    expect(await dbGet(`competitionLinks:of/${fri}`)).toBeNull()

    const res = await callFunction<{ linkId: string; joining: string; primary: string }>('linkCompetitions', { action: 'link', competitionId: sat, withId: fri }, organiser)
    expect(res.result).toMatchObject({ joining: sat, primary: fri })
    linkId = res.result!.linkId
    expect(await dbGet(`competitionLinks/${linkId}`)).toEqual({ primary: fri, competitions: { [fri]: true, [sat]: true } })
    expect(await dbGet(`competitions/${sat}/venue`)).toBe('Halifax Convention Centre')
    expect(await dbGet(`competitions/${sat}/description`)).toBe('Two days of dancing.')
    expect(Object.keys((await dbGet<Record<string, unknown>>(`competitions:data/${sat}/staff`)) ?? {}).sort()).toEqual(['j1', 'j2'])
  })

  test('anyone reads links; only the server writes them', async () => {
    expect((await as(null, 'GET', `competitionLinks/${linkId}/primary`)).data).toBe(fri)
    expect((await as(null, 'GET', `competitionLinks:sync/${sat}/venue`)).data).toBe(true)
    expect((await as(organiser, 'PUT', `competitionLinks/${linkId}/primary`, sat)).ok).toBe(false)
    expect((await as(organiser, 'PUT', `competitionLinks:sync/${sat}/venue`, null)).ok).toBe(false)
  })

  test('a synced part changes on the primary, and the server copies it over', async () => {
    // Not on the one taking it…
    expect((await as(organiser, 'PUT', `competitions/${sat}/venue`, 'Somewhere else')).ok).toBe(false)
    expect((await as(organiser, 'PUT', `competitions:data/${sat}/staff/x9`, judge('Heather', 'Lyall'))).ok).toBe(false)
    // …though what's its own (its name, and saving a synced value unchanged) still saves.
    expect((await as(organiser, 'PUT', `competitions/${sat}/name`, `Saturday Championship ${sat}`)).ok).toBe(true)
    expect((await as(organiser, 'PUT', `competitions/${sat}/venue`, 'Halifax Convention Centre')).ok).toBe(true)
    // On the primary, it goes to the others.
    expect((await as(organiser, 'PUT', `competitions/${fri}/venue`, 'The Forum')).ok).toBe(true)
    await expect.poll(() => dbGet(`competitions/${sat}/venue`), { timeout: 30_000 }).toBe('The Forum')
    expect((await as(organiser, 'PUT', `competitions:data/${fri}/staff/j3`, judge('Heather', 'Lyall'))).ok).toBe(true)
    await expect.poll(() => dbGet(`competitions:data/${sat}/staff/j3/lastName`), { timeout: 30_000 }).toBe('Lyall')
  })

  test('switching a part off makes it the competition’s own again', async () => {
    await callFunction('linkCompetitions', { action: 'sync', competitionId: sat, part: 'venue', on: false }, organiser)
    expect(await dbGet(`competitionLinks:sync/${sat}/venue`)).toBeNull()
    expect((await as(organiser, 'PUT', `competitions/${sat}/venue`, 'Riverside Arena')).ok).toBe(true)
    expect((await as(organiser, 'PUT', `competitions/${fri}/venue`, 'Halifax Convention Centre')).ok).toBe(true)
    await new Promise((r) => setTimeout(r, 3000))
    expect(await dbGet(`competitions/${sat}/venue`)).toBe('Riverside Arena')
  })

  test('the set going live is one alert for someone following both', async () => {
    test.setTimeout(90_000)
    await dbSet(`users/${organiser.uid}/alerts`, { enabled: true })
    for (const id of [fri, sat]) await dbSet(`users:favorites/${organiser.uid}/competitions/${id}`, true)
    for (const id of [fri, sat]) await expect.poll(() => dbGet(`competitions:followers/${id}/${organiser.uid}`)).toBe(true)
    // Publishing the primary publishes Saturday too (it takes Listed and published).
    expect((await as(organiser, 'PUT', `competitions/${fri}/published`, true)).ok).toBe(true)
    await expect.poll(() => dbGet(`competitions/${sat}/published`), { timeout: 30_000 }).toBe(true)
    await expect.poll(async () => (await logFor(organiser.uid)).map((m) => m.title), { timeout: 60_000 }).toEqual([
      expect.stringMatching(/^2 competitions are live, /),
    ])
    const [alert] = await logFor(organiser.uid)
    expect(alert).toMatchObject({ kind: 'published', competitionId: fri })
  })

  test('taking one out keeps what it has, and a link of one is no link', async () => {
    expect((await callFunction('linkCompetitions', { action: 'unlink', competitionId: sat }, stranger)).error?.status).toBe('PERMISSION_DENIED')
    await callFunction('linkCompetitions', { action: 'unlink', competitionId: sat }, organiser)
    expect(await dbGet(`competitionLinks/${linkId}`)).toBeNull()
    expect(await dbGet(`competitionLinks:of/${fri}`)).toBeNull()
    expect(await dbGet(`competitions:data/${sat}/staff/j1/firstName`)).toBe('Ailsa')
    // Its own again: staff saves.
    expect((await as(organiser, 'PUT', `competitions:data/${sat}/staff/x9`, judge('Heather', 'Lyall'))).ok).toBe(true)
  })
})

test.describe('families and organisers', () => {
  test.describe.configure({ mode: 'serial' })
  const linkId = uid('link-ui')
  const ids = [uid('link-a'), uid('link-b'), uid('link-c')]
  const names = ['Pre-Premier Open', 'Premier Open', 'Junior Championship'].map((n, i) => `${n} ${ids[i]}`)
  const organiserEmail = `${uid('link-ui-organiser')}@example.test`
  let organiserUid = ''

  test.beforeAll(async () => {
    organiserUid = (await account(organiserEmail)).uid
    for (const [i, id] of ids.entries()) {
      await dbSet(`competitions/${id}`, { name: names[i], date: isoDay(30 + i), venue: i === 2 ? 'Riverside Arena' : 'Halifax Convention Centre', location: 'Halifax, NS', listed: true, published: true })
      await dbSet(`competitionLinks:of/${id}`, linkId)
      await dbSet(`users:permissions/${organiserUid}/competitions/${id}`, true)
      await dbSet(`competitions:permissions/${id}/users/${organiserUid}`, true)
    }
    await dbSet(`competitionLinks/${linkId}`, { primary: ids[0], competitions: Object.fromEntries(ids.map((id) => [id, true])) })
    await dbSet(`competitionLinks:sync/${ids[1]}`, { about: true, venue: true, staff: true })
    await dbSet(`competitionLinks:sync/${ids[2]}`, { about: true, staff: true })
  })

  test.afterAll(async () => {
    for (const id of ids) {
      await dbRemove(`competitions/${id}`)
      await dbRemove(`competitionLinks:of/${id}`)
      await dbRemove(`competitionLinks:sync/${id}`)
    }
    await dbRemove(`competitionLinks/${linkId}`)
    await dbRemove(`users:permissions/${organiserUid}`)
  })

  test('the title switches between them, keeping your tab', async ({ page }) => {
    await page.goto(`/competitions/${ids[1]}/schedule`)
    const title = page.getByRole('button', { name: /Switch competition/ })
    await title.click()
    const menu = page.locator('dialog[open]')
    await expect(menu.getByRole('heading', { name: /^3 competitions, / }).or(menu.getByText(/^3 competitions, /).first())).toBeVisible()
    await expect(menu.getByRole('radio', { name: new RegExp(names[1]) })).toHaveAttribute('aria-checked', 'true')
    await expect(menu.getByRole('radio', { name: new RegExp(names[2]) })).toContainText('Another venue: Riverside Arena')
    await menu.getByRole('radio', { name: new RegExp(names[2]) }).click()
    await expect(page).toHaveURL(new RegExp(`/competitions/${ids[2]}/schedule`))
  })

  test('Overview shows the ones either side', async ({ page }) => {
    await page.goto(`/competitions/${ids[1]}/info`)
    const section = page.locator('section', { has: page.getByRole('heading', { name: /^3 competitions, / }) })
    await expect(section.getByRole('link')).toHaveCount(2)
    await section.getByRole('link', { name: new RegExp(names[0]) }).click()
    await expect(page).toHaveURL(new RegExp(`/competitions/${ids[0]}/info`))
  })

  test('Manage says what each takes, and what’s synced can’t be changed there', async ({ page }) => {
    await signIn(page, organiserEmail)
    await page.goto(`/competitions/${ids[0]}/manage/details`)
    await expect(page.getByText('This one is the primary')).toBeVisible()
    await expect(page.getByText('Venue and address', { exact: false }).first()).toContainText('has its own')

    await page.goto(`/competitions/${ids[1]}/manage/details`)
    await expect(page.getByRole('note').getByText(/The parts marked Synced come from/)).toBeVisible()
    await expect(page.getByRole('textbox', { name: 'Description' })).toBeDisabled()
    await expect(page.getByRole('textbox', { name: 'Name' })).toBeEnabled()

    await page.goto(`/competitions/${ids[1]}/manage/staff`)
    await expect(page.getByText(/Synced from .*Pre-Premier Open/)).toBeVisible()
    await expect(page.getByRole('link', { name: /Add staff member|Add/ })).toHaveCount(0)
  })
})
