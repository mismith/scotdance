import { expect, test, type Page } from '@playwright/test'
import { dbGet, dbRemove, dbSet, ensureUser, grantCompetition, grantSystemAdmin, signIn, uid } from './support/emulator'
import { removeCompetition } from './support/seed'
import { action, pastMatches, pickDay, question } from './support/submit'

// Known competitions (ADR 0009), through the real rules and functions: Add a
// competition's "Is it one of these?" (the governing bodies' lists, what's
// here already, and yours from last year), "Another competition that
// weekend?" with the two linked once approved, and System admin › Known
// competitions. The lists themselves are seeded: the real feeds are read by
// functions/src/knownCompetitions.ts (unit tested), never from tests.

type Submission = {
  competition: Record<string, unknown>
  contact: Record<string, unknown>
  organisations?: Record<string, boolean>
  linkedTo?: string
  linked?: string
  competitionId?: string
  approved?: string
}

const GOOGLE = /maps\.googleapis\.com|places\.googleapis\.com/
const main = (page: Page) => page.getByRole('main')
const back = (page: Page) => page.getByRole('button', { name: 'Back to the previous question' })

/** A Saturday some months off (auto-approval stops at 18), picked at random so tests don't share one. */
function aSaturday() {
  const d = new Date()
  d.setUTCHours(0, 0, 0, 0)
  d.setUTCDate(d.getUTCDate() + 70 + 7 * Math.floor(Math.random() * 40))
  d.setUTCDate(d.getUTCDate() + ((6 - d.getUTCDay() + 7) % 7))
  return d.toISOString().slice(0, 10)
}
const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10)
/** Digits, so a name passes the server's checks (a lowercase word wouldn't). */
const tag = () => String(Date.now() + Math.floor(Math.random() * 1000)).slice(-6)

const submissionsNamed = async (name: string) =>
  Object.entries((await dbGet<Record<string, Submission>>('competitions:submissions')) ?? {}).filter(([, s]) => s.competition?.name === name)
async function removeSubmissionsNamed(...names: string[]) {
  for (const name of names) {
    for (const [id, s] of await submissionsNamed(name)) {
      if (s.competitionId) await removeCompetition(s.competitionId)
      await dbRemove(`competitions:submissions/${id}`)
    }
  }
}

/** Signed in, past the intro, Canada and the day chosen, and on from the date. */
async function toDay(page: Page, email: string, day: string) {
  // Typing a venue searches Google Places: never from tests (it's billed).
  await page.route(GOOGLE, (r) => r.abort())
  await signIn(page, email)
  await page.goto('/competitions/add')
  await action(page).click()
  await expect(question(page, 1)).toBeVisible()
  await main(page).getByRole('radio', { name: /Canada/ }).click()
  await action(page).click()
  await pickDay(page, day)
  await action(page).click()
}

/** All good? and Send, once your name's in (a new account has none). */
async function sendIt(page: Page, you = 'Morag Test') {
  await expect(question(page, 8).or(question(page, 9))).toBeVisible()
  if (await question(page, 8).isVisible()) {
    await expect(action(page)).toHaveText('Back to review')
    await main(page).getByRole('textbox').fill(you)
    await action(page).click()
  }
  await expect(question(page, 9)).toBeVisible()
  await page.getByRole('checkbox', { name: /no guarantees/ }).check()
  await action(page).click()
  await expect(page.getByRole('heading', { name: 'Sent' })).toBeVisible()
}

test('a known competition fills in what it knows (its organisation too, not its website), and tapping it again puts things back', async ({ page }) => {
  test.setTimeout(120_000)
  const email = `${uid('known')}@example.test`
  await ensureUser(email)
  const day = aSaturday()
  const t = tag()
  const name = `E2E Fall Classic ${t}`
  const orgId = uid('known-org')
  const knownKey = `sdc:${day}:e2e-fall-classic-${t}`
  const hereId = uid('known-here')
  await dbSet(`organisations/${orgId}`, { name: `E2E Highland Dance Association ${t}`, shortName: `E2E${t}` })
  await dbSet(`knownCompetitions/${knownKey}`, {
    source: 'sdc',
    date: day,
    end: addDays(day, 1),
    name,
    venue: 'Bearspaw Christian School',
    address: '15001 69 Street NW',
    locality: 'Calgary',
    region: 'AB',
    country: 'CA',
    website: 'https://example.test/fall',
    organisations: { [orgId]: true },
    fetched: new Date().toISOString(),
  })
  // Also on that day, the next: one already here, and one in another country.
  await dbSet(`competitions/${hereId}`, { name: `E2E Already Here ${t}`, date: addDays(day, 1), location: 'Edmonton, AB', country: 'CA' })
  await dbSet(`knownCompetitions/scotdance-usa:${day}:e2e-${t}`, { source: 'scotdance-usa', date: day, name: `E2E Elsewhere ${t}`, country: 'US', fetched: new Date().toISOString() })
  try {
    await toDay(page, email, day)
    await expect(question(page, 3)).toBeVisible()
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Is it one of these?')
    await expect(action(page)).toHaveText('None of these')
    // Marked with the list it's from.
    await expect(main(page).getByRole('button', { name: new RegExp(name) })).toContainText('ScotDance Canada')
    await expect(main(page).getByText(`E2E Elsewhere ${t}`)).toHaveCount(0)

    // Already here: it says so, with a way to it.
    await main(page).getByRole('button', { name: new RegExp(`E2E Already Here ${t}`) }).click()
    const dialog = page.locator('dialog[open]')
    await expect(dialog.getByText('It’s already on ScotDance.app')).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Open it' })).toBeVisible()
    await dialog.getByRole('button', { name: 'It’s a different one' }).click()
    await expect(page.locator('dialog[open]')).toHaveCount(0)
    await expect(question(page, 3)).toBeVisible()

    // Picked: on to what's still needed (your name), then the last look, filled in.
    const row = main(page).getByRole('button', { name: new RegExp(name) })
    await row.click()
    await expect(question(page, 8)).toBeVisible()
    await main(page).getByRole('textbox').fill('Morag Test')
    await action(page).click()
    await expect(question(page, 9)).toBeVisible()
    for (const text of [name, `E2E Highland Dance Association ${t}`, 'Bearspaw Christian School', '15001 69 Street NW', 'Calgary, AB']) {
      await expect(main(page).locator('ul').getByText(text, { exact: true }).first()).toBeVisible()
    }
    await expect(main(page).getByText('example.test/fall')).toHaveCount(0)

    // Back to it: tapping it again puts back what was there before (not your name).
    for (const step of [8, 7, 6, 5, 4, 3]) {
      await back(page).click()
      await expect(question(page, step)).toBeVisible()
    }
    await expect(row).toHaveAttribute('aria-pressed', 'true')
    await expect(action(page)).toHaveText('Continue')
    await row.click()
    await expect(row).toHaveAttribute('aria-pressed', 'false')
    await expect(action(page)).toHaveText('None of these')
    await action(page).click()
    await expect(question(page, 4)).toBeVisible()
    await expect(main(page).getByRole('textbox')).toHaveValue('')

    // Picked again, and sent as it showed.
    await back(page).click()
    await expect(question(page, 3)).toBeVisible()
    await row.click()
    await sendIt(page)
    await expect.poll(async () => (await submissionsNamed(name)).length, { timeout: 30_000 }).toBe(1)
    const [[, sent]] = await submissionsNamed(name)
    expect(sent.competition).toMatchObject({
      name,
      date: day,
      venue: 'Bearspaw Christian School',
      address: '15001 69 Street NW',
      location: 'Calgary, AB',
      country: 'CA',
    })
    expect(sent.competition.links).toBeUndefined()
    expect(sent.organisations).toEqual({ [orgId]: true })
    expect(sent.contact).toMatchObject({ name: 'Morag Test', email })
  } finally {
    await removeSubmissionsNamed(name)
    await dbRemove(`knownCompetitions/${knownKey}`)
    await dbRemove(`knownCompetitions/scotdance-usa:${day}:e2e-${t}`)
    await removeCompetition(hereId)
    await dbRemove(`organisations/${orgId}`)
  }
})

test('yours from last year: the same again, a year on, without its registration number or links', async ({ page }) => {
  test.setTimeout(120_000)
  const email = `${uid('again')}@example.test`
  const me = await ensureUser(email)
  const day = aSaturday()
  // The same weekend a year before (a Saturday too).
  const lastYear = addDays(day, -364)
  const t = tag()
  const year = Number(lastYear.slice(0, 4))
  const mineId = uid('again-mine')
  const orgId = uid('again-org')
  const moved = `E2E Spring Fling ${day.slice(0, 4)} ${t}`
  await dbSet(`organisations/${orgId}`, { name: `E2E Glenmore Dancers ${t}` })
  await dbSet(`competitions/${mineId}`, {
    name: `E2E Spring Fling ${year} ${t}`,
    date: lastYear,
    venue: 'Glenmore Hall',
    address: '1 Main St',
    location: 'Calgary, AB',
    lat: 51.01,
    lng: -114.1,
    country: 'CA',
    region: 'AB',
    locality: 'Calgary',
    organisations: { [orgId]: true },
    links: { l1: { name: 'Program', url: 'https://example.test/program.pdf' } },
    sobhd: 'C-AB-CO-27-1234',
  })
  await grantCompetition(me, mineId)
  try {
    await toDay(page, email, day)
    await expect(question(page, 3)).toBeVisible()
    // As it'd be this year, which is what the question asks.
    const row = main(page).getByRole('button', { name: new RegExp(moved) })
    await expect(row).toContainText('Same as last year')
    await expect(main(page).getByText(`E2E Spring Fling ${year} ${t}`)).toHaveCount(0)
    await row.click()
    await expect(question(page, 8).or(question(page, 9))).toBeVisible()
    if (await question(page, 8).isVisible()) {
      await main(page).getByRole('textbox').fill('Morag Test')
      await action(page).click()
    }
    await expect(question(page, 9)).toBeVisible()
    for (const text of [moved, 'Glenmore Hall', 'Calgary, AB', `E2E Glenmore Dancers ${t}`]) {
      await expect(main(page).locator('ul').getByText(text, { exact: true }).first()).toBeVisible()
    }
    await expect(main(page).getByRole('button', { name: /^Registration/ })).toContainText('Not added')
    await sendIt(page)
    await expect.poll(async () => (await submissionsNamed(moved)).length, { timeout: 30_000 }).toBe(1)
    const [[, sent]] = await submissionsNamed(moved)
    expect(sent.competition).toMatchObject({
      name: moved,
      date: day,
      venue: 'Glenmore Hall',
      address: '1 Main St',
      location: 'Calgary, AB',
      lat: 51.01,
      lng: -114.1,
      country: 'CA',
      region: 'AB',
      locality: 'Calgary',
    })
    expect(sent.competition.sobhd).toBeUndefined()
    expect(sent.competition.links).toBeUndefined()
    expect(sent.organisations).toEqual({ [orgId]: true })
  } finally {
    await removeSubmissionsNamed(moved)
    await removeCompetition(mineId)
    await dbRemove(`users:permissions/${me}/competitions/${mineId}`)
    await dbRemove(`organisations/${orgId}`)
  }
})

test('another competition that weekend: the next day, as much carried over, and the two linked once approved', async ({ page }) => {
  // (Room for the server to approve both, cold.)
  test.setTimeout(180_000)
  const email = `${uid('weekend')}@example.test`
  const me = await ensureUser(email)
  const day = aSaturday()
  const t = tag()
  const [sat, sun] = [`E2E Saturday Games ${t}`, `E2E Sunday Games ${t}`]
  try {
    await toDay(page, email, day)
    await pastMatches(page)
    await main(page).getByRole('textbox').fill(sat)
    await action(page).click()
    await expect(question(page, 5)).toBeVisible()
    await action(page).click()
    await expect(question(page, 6)).toBeVisible()
    await main(page).getByLabel('Venue name', { exact: true }).fill('Glenmore Hall')
    await action(page).click()
    await main(page).getByRole('textbox', { name: 'Town or city' }).fill('Calgary, AB')
    await action(page).click()
    await expect(question(page, 7)).toBeVisible()
    await action(page).click()
    await expect(question(page, 8)).toBeVisible()
    await main(page).getByRole('textbox').fill('Morag Test')
    await action(page).click()
    await expect(question(page, 9)).toBeVisible()
    await sendIt(page)

    // Asked of every one sent, naming the next day.
    await expect(main(page).getByRole('heading', { name: 'Another competition that weekend?' })).toBeVisible()
    const sunday = new Date(`${addDays(day, 1)}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
    await main(page).getByRole('button', { name: `Add ${sunday}` }).click()
    await expect(question(page, 2)).toBeVisible()
    await expect(main(page).getByText(new Date(`${addDays(day, 1)}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }))).toBeVisible()
    await action(page).click()
    // (Saturday's, approved meanwhile, isn't offered back.)
    await expect(question(page, 3).or(question(page, 4))).toBeVisible()
    if (await question(page, 3).isVisible()) {
      await expect(main(page).getByText(sat, { exact: true })).toHaveCount(0)
      await action(page).click()
    }
    await expect(question(page, 4)).toBeVisible()
    await expect(main(page).getByRole('textbox')).toHaveValue('')
    await main(page).getByRole('textbox').fill(sun)
    await action(page).click()
    await expect(question(page, 5)).toBeVisible()
    await action(page).click()
    await expect(question(page, 6)).toBeVisible()
    await expect(main(page).getByRole('textbox', { name: 'Town or city' })).toHaveValue('Calgary, AB')
    await action(page).click()
    await expect(question(page, 7)).toBeVisible()
    await action(page).click()
    await expect(question(page, 8)).toBeVisible()
    await expect(main(page).getByRole('textbox')).toHaveValue('Morag Test')
    await action(page).click()
    await expect(question(page, 9)).toBeVisible()
    await expect(main(page).getByRole('button', { name: /^Linked with/ })).toContainText(sat)
    await sendIt(page)

    // Both approved as they arrived, and linked: Saturday's the main one.
    await expect
      .poll(
        async () => {
          const [[, first] = [], [, second] = []] = [...(await submissionsNamed(sat)), ...(await submissionsNamed(sun))]
          if (!first?.competitionId || !second?.competitionId) return 'approving'
          const [a, b] = await Promise.all([dbGet<string>(`competitionLinks:of/${first.competitionId}`), dbGet<string>(`competitionLinks:of/${second.competitionId}`)])
          if (!a || a !== b) return 'linking'
          return (await dbGet<{ primary: string }>(`competitionLinks/${a}`))?.primary === first.competitionId ? 'linked' : 'other primary'
        },
        { timeout: 90_000, intervals: [1000] },
      )
      .toBe('linked')
    const [[, second]] = await submissionsNamed(sun)
    const [[firstId]] = await submissionsNamed(sat)
    expect(second).toMatchObject({ linkedTo: firstId, linked: expect.any(String) })
  } finally {
    const linkIds = new Set<string>()
    for (const [, s] of [...(await submissionsNamed(sat)), ...(await submissionsNamed(sun))]) {
      if (s.competitionId) {
        const l = await dbGet<string | null>(`competitionLinks:of/${s.competitionId}`)
        if (l) linkIds.add(l)
      }
    }
    await removeSubmissionsNamed(sat, sun)
    for (const id of linkIds) await dbRemove(`competitionLinks/${id}`)
    await dbRemove(`users:permissions/${me}`)
  }
})

test('System admin › Known competitions: how each source’s last read went, and Refresh', async ({ page }) => {
  const email = `${uid('known-admin')}@example.test`
  const me = await ensureUser(email)
  await grantSystemAdmin(me)
  const before = await dbGet('knownCompetitions:runs')
  const at = new Date(Date.now() - 86_400_000).toISOString()
  const earlier = new Date(Date.now() - 30 * 86_400_000).toISOString()
  // (A reply as the callable would give, rather than reading the real feeds from a test.)
  const calls: string[] = []
  await page.route(/\/refreshKnownCompetitions$/, async (route) => {
    const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
    calls.push(route.request().postData() ?? '')
    await new Promise((r) => setTimeout(r, 500))
    return route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify({ result: { sdc: { count: 50 } } }) })
  })
  try {
    await dbSet('knownCompetitions:runs', {
      sdc: { at, ok: at, count: 50, from: ['https://scotdance.ca/wp-content/uploads/2026/10/2026-SDC-Event-List.xlsx'] },
      'scotdance-usa': { at, ok: earlier, count: 39, error: 'calendar.google.com answered 503' },
    })
    await signIn(page, email)
    await page.goto('/admin')
    await main(page).getByRole('link', { name: /Known competitions/ }).click()
    await expect(page).toHaveURL(/\/admin\/known-competitions$/)
    await expect(main(page).getByRole('heading', { name: 'Known competitions', level: 1 })).toBeVisible()
    const rows = main(page).locator('li')
    await expect(rows.filter({ hasText: 'ScotDance Canada' })).toContainText('Found 50 competitions')
    await expect(rows.filter({ hasText: 'ScotDance Canada' }).getByRole('link', { name: 'scotdance.ca' })).toBeVisible()
    await expect(rows.filter({ hasText: 'ScotDance USA' })).toContainText('calendar.google.com answered 503')
    await expect(rows.filter({ hasText: 'ScotDance USA' })).toContainText('Still offering 39 competitions')
    await expect(rows.filter({ hasText: 'RSOBHD' })).toContainText('Not read yet')

    const refresh = main(page).getByRole('button', { name: 'Refresh' })
    await refresh.click()
    await expect.poll(() => calls.length).toBe(1)
    await expect(refresh).toBeEnabled()
    await expect(main(page).getByRole('alert')).toHaveCount(0)
  } finally {
    await dbSet('knownCompetitions:runs', before)
    await dbRemove(`users:permissions/${me}`)
  }
})
