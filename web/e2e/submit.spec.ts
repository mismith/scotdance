import { expect, test, type Page } from '@playwright/test'
import { dbGet, dbRemove, ensureUser, signIn, uid } from './support/emulator'
import { retry } from './support/retry'
import { removeCompetition, seedCompetition } from './support/seed'
import { action, addCompetition, pickDay, question } from './support/submit'

// Adding a competition, through the real database rules and Cloud Functions
// trigger: signed in only, an intro and then one question at a time (ADR
// 0010), stored in the shape the approval function and System admin ›
// Submissions read. One with nothing in it to look at is approved as it
// arrives.

type Submission = {
  competition: Record<string, unknown>
  contact: Record<string, unknown>
  submitted: string
  submittedBy?: string
  receivedAt?: number
  autoApproved?: boolean
  approvedBy?: string
  competitionId?: string
}
const submissionsNamed = async (name: string) =>
  Object.entries(
    (await dbGet<Record<string, Submission>>('competitions:submissions')) ?? {},
  ).filter(([, s]) => s.competition?.name === name)
const removeSubmissionsNamed = async (name: string) =>
  Promise.all(
    (await submissionsNamed(name)).map(async ([id, s]) => {
      // (One approved as it arrived made a competition: that goes too.)
      if (s.competitionId) await removeCompetition(s.competitionId)
      await dbRemove(`competitions:submissions/${id}`)
    }),
  )
// Some months off, as a real one is (one whose date has passed waits for a look).
const SOON = new Date(Date.now() + 120 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

const GOOGLE = /maps\.googleapis\.com|places\.googleapis\.com/
const main = (page: Page) => page.getByRole('main')

async function signInOnSheet(page: Page, email: string) {
  await page
    .locator('dialog[open]')
    .getByRole('textbox', { name: 'Email address' })
    .fill(email)
  const password = page.locator('dialog[open] input[name=password]')
  await password.fill('password')
  await password.press('Enter')
  await page.locator('dialog[open]').waitFor({ state: 'detached' })
}

/** Signed in, past the intro, on the first question. */
async function begin(page: Page, email: string) {
  // Typing a venue searches Google Places: never from tests (it's billed).
  await page.route(GOOGLE, (r) => r.abort())
  await signIn(page, email)
  await page.goto('/competitions/add')
  await action(page).click()
  await expect(question(page, 1)).toBeVisible()
}

test('signed out: the intro and a way in, but no questions and no venue search', async ({
  page,
}) => {
  const requests: string[] = []
  page.on('request', (r) => requests.push(r.url()))
  await page.goto('/competitions/add')
  await expect(
    page.getByRole('heading', { name: 'Add your competition', level: 1 }),
  ).toBeVisible()
  await expect(main(page).getByText('Free, and about 2 minutes.')).toBeVisible()
  // What's needed later is in a sheet, until asked for.
  await expect(page.getByText('A laptop or tablet.')).toBeHidden()
  await main(page).getByRole('button', { name: 'What you’ll need' }).click()
  await expect(
    page.locator('dialog[open]').getByText('A laptop or tablet.'),
  ).toBeVisible()
  await page.locator('dialog[open]').getByRole('button', { name: 'Close' }).click()
  await expect(action(page)).toHaveText('Sign in to start')
  await expect(main(page).getByRole('textbox')).toHaveCount(0)
  await expect(main(page).getByRole('combobox')).toHaveCount(0)
  // No tab bar on a phone: the page's one button is at the foot.
  if (test.info().project.name === 'phone')
    await expect(page.getByRole('navigation', { name: 'App' })).toHaveCount(0)
  // Give anything lazy a moment to (not) load.
  await page.waitForTimeout(1500)
  expect(requests.filter((u) => GOOGLE.test(u))).toEqual([])
})

test('signing in from the intro goes straight to the first question, on the same page', async ({
  page,
}) => {
  const email = `${uid('org')}@example.test`
  await ensureUser(email)
  await page.goto('/competitions/add')
  await action(page).click()
  await signInOnSheet(page, email)
  await expect(question(page, 1)).toBeVisible()
  await expect(page).toHaveURL(/\/competitions\/add$/)
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    'Which country is it in?',
  )
})

test('a question at a time, checked as it goes, and sent once however fast it’s tapped', async ({
  page,
}) => {
  // (Room for the server to approve it, cold.)
  test.setTimeout(120_000)
  const email = `${uid('org')}@example.test`
  const orgId = await ensureUser(email)
  const name = `E2E Submit ${uid('s').slice(-6)}`
  try {
    await begin(page, email)

    await main(page)
      .getByRole('radio', { name: /Canada/ })
      .click()
    await action(page).click()

    // A question that needs an answer says so, and stays.
    await expect(question(page, 2)).toBeVisible()
    await action(page).click()
    await expect(main(page).getByText('Pick a date to continue.')).toBeVisible()
    await expect(question(page, 2)).toBeVisible()
    await pickDay(page, SOON)
    await action(page).click()

    await expect(question(page, 3)).toBeVisible()
    await main(page).getByRole('textbox').fill(name)
    // Enter moves on, as Continue does.
    await main(page).getByRole('textbox').press('Enter')

    // Optional: Skip until something's chosen.
    await expect(question(page, 4)).toBeVisible()
    await expect(action(page)).toHaveText('Skip')
    await action(page).click()

    // Typed and not picked from the suggestions: it stays as the name, and
    // the town's still needed. (By label: a search box with a Maps key, a
    // plain one without, as in CI.)
    await expect(question(page, 5)).toBeVisible()
    await main(page).getByLabel('Venue name', { exact: true }).fill('Spruce Meadows')
    await action(page).click()
    await expect(main(page).getByText('Add the town or city to continue.')).toBeVisible()
    await main(page).getByRole('textbox', { name: 'Town or city' }).fill('Calgary, AB')
    await action(page).click()

    await expect(question(page, 6)).toBeVisible()
    await expect(main(page).getByText('From ScotDance Canada.')).toBeVisible()
    await expect(action(page)).toHaveText('Skip')
    await main(page).getByRole('textbox').fill('C-AB-CO-27-1234')
    await expect(action(page)).toHaveText('Continue')
    await action(page).click()

    await expect(question(page, 7)).toBeVisible()
    await expect(main(page).getByText('It’s never shown publicly.')).toBeVisible()
    await main(page).getByRole('textbox').fill('Morag Test')
    await action(page).click()

    // The last look shows it all before anything is sent.
    await expect(question(page, 8)).toBeVisible()
    for (const text of [
      'Canada',
      name,
      'C-AB-CO-27-1234',
      'Spruce Meadows',
      'Calgary, AB',
      'Morag Test',
      email,
    ]) {
      await expect(main(page).locator('ul').getByText(text).first()).toBeVisible()
    }
    await main(page)
      .getByRole('textbox', { name: 'Anything to ask or mention?' })
      .fill('Two days, same hall.')
    await expect(action(page)).toHaveText('Send')
    await action(page).click()
    await expect(main(page).getByText('Tick this to send it.')).toBeVisible()
    expect(await submissionsNamed(name)).toEqual([])

    await page.getByRole('checkbox', { name: /no guarantees/ }).check()
    await action(page).dblclick()
    await expect(page.getByRole('heading', { name: 'Sent' })).toBeVisible()

    // Once, in the shape approval reads (the server adds who sent it, and
    // when by its own clock, for the flood check). Nothing in it needs a
    // look, so it's approved as it arrives, and its competition made.
    await expect
      .poll(
        async () =>
          (await submissionsNamed(name)).map(([, s]) => [
            s.submittedBy,
            typeof s.competitionId,
          ]),
        { timeout: 60_000 },
      )
      .toEqual([[orgId, 'string']])
    await page.waitForTimeout(1000)
    const all = await submissionsNamed(name)
    expect(all).toHaveLength(1)
    const [[, sent]] = all
    expect(Object.keys(sent).sort()).toEqual([
      'approved',
      'approvedBy',
      'autoApproved',
      'competition',
      'competitionId',
      'contact',
      'origin',
      'receivedAt',
      'submitted',
      'submittedBy',
    ])
    // (origin: its emails are v4's, linking back to this site.)
    expect(sent).toMatchObject({
      autoApproved: true,
      approvedBy: 'auto',
      origin: new URL(page.url()).origin,
    })
    expect(await dbGet(`competitions/${sent.competitionId}/name`)).toBe(name)
    expect(sent.competition).toEqual({
      name,
      date: SOON,
      venue: 'Spruce Meadows',
      location: 'Calgary, AB',
      sobhd: 'C-AB-CO-27-1234',
      country: 'CA',
    })
    expect(sent.contact).toEqual({
      name: 'Morag Test',
      email,
      message: 'Two days, same hall.',
      disclaimer: true,
    })
    expect(Date.parse(sent.submitted)).toBeGreaterThan(Date.now() - 5 * 60_000)
    expect(sent.receivedAt).toBeGreaterThan(Date.now() - 5 * 60_000)
  } finally {
    await removeSubmissionsNamed(name)
  }
})

test('Back keeps what was typed, and a change from the last look comes straight back', async ({
  page,
}) => {
  const email = `${uid('org')}@example.test`
  await ensureUser(email)
  await begin(page, email)
  await main(page)
    .getByRole('radio', { name: /Canada/ })
    .click()
  await action(page).click()
  await pickDay(page, '2027-06-05')
  await action(page).click()
  await expect(question(page, 3)).toBeVisible()
  await main(page).getByRole('textbox').fill('Jumping Games')
  await page.getByRole('button', { name: 'Back to the previous question' }).click()
  await expect(question(page, 2)).toBeVisible()
  await expect(main(page).getByText('Saturday, June 5, 2027')).toBeVisible()
  await action(page).click()
  await expect(question(page, 3)).toBeVisible()
  await expect(main(page).getByRole('textbox')).toHaveValue('Jumping Games')
  await action(page).click()
  await expect(question(page, 4)).toBeVisible()
  await action(page).click()
  await expect(question(page, 5)).toBeVisible()
  await main(page).getByLabel('Venue name', { exact: true }).fill('Glenmore Hall')
  await action(page).click()
  await main(page).getByRole('textbox', { name: 'Town or city' }).fill('Calgary, AB')
  await action(page).click()
  await expect(question(page, 6)).toBeVisible()
  await action(page).click()
  await expect(question(page, 7)).toBeVisible()
  await main(page).getByRole('textbox').fill('Morag Test')
  await action(page).click()
  await expect(question(page, 8)).toBeVisible()

  await main(page).getByRole('button', { name: /^Name/ }).click()
  await expect(question(page, 3)).toBeVisible()
  await expect(action(page)).toHaveText('Back to review')
  await main(page).getByRole('textbox').fill('Jumping Games 2027')
  await action(page).click()
  await expect(question(page, 8)).toBeVisible()
  await expect(main(page).getByText('Jumping Games 2027')).toBeVisible()
})

test('another country, from a search that Enter doesn’t skip past', async ({ page }) => {
  const email = `${uid('org')}@example.test`
  await ensureUser(email)
  await begin(page, email)
  await main(page).getByRole('button', { name: 'Another country' }).click()
  const sheet = page.locator('dialog[open]')
  await sheet.getByRole('searchbox').fill('Irel')
  await sheet.getByRole('searchbox').press('Enter')
  await expect(sheet).toBeVisible()
  await expect(question(page, 1)).toBeVisible()
  await sheet.getByRole('button', { name: 'Ireland', exact: true }).click()
  await expect(page.locator('dialog[open]')).toHaveCount(0)
  await expect(main(page).getByRole('radio', { name: /Ireland/ })).toHaveAttribute(
    'aria-checked',
    'true',
  )
})

test('Add another starts on the date, at the same venue, with you', async ({ page }) => {
  const email = `${uid('org')}@example.test`
  await ensureUser(email)
  const name = `E2E Submit ${uid('s').slice(-6)}`
  try {
    await begin(page, email)
    await addCompetition(page, {
      name,
      date: '2027-06-05',
      town: 'Calgary, AB',
      you: 'Morag Test',
    })

    await page.getByRole('button', { name: 'Add another' }).click()
    await expect(question(page, 2)).toBeVisible()
    await pickDay(page, '2027-06-06')
    await action(page).click()
    await expect(question(page, 3)).toBeVisible()
    await expect(main(page).getByRole('textbox')).toHaveValue('')
    await main(page).getByRole('textbox').fill(`${name} day 2`)
    await action(page).click()
    await expect(question(page, 4)).toBeVisible()
    await action(page).click()
    await expect(question(page, 5)).toBeVisible()
    await expect(main(page).getByRole('textbox', { name: 'Town or city' })).toHaveValue(
      'Calgary, AB',
    )
    await action(page).click()
    await expect(question(page, 6)).toBeVisible()
    await action(page).click()
    await expect(question(page, 7)).toBeVisible()
    await expect(main(page).getByRole('textbox')).toHaveValue('Morag Test')
  } finally {
    await removeSubmissionsNamed(name)
  }
})

test('the answers so far outlast a reload, offered on the intro, until started over', async ({
  page,
}) => {
  const email = `${uid('org')}@example.test`
  await ensureUser(email)
  await begin(page, email)
  await main(page)
    .getByRole('radio', { name: /Canada/ })
    .click()
  await action(page).click()
  await pickDay(page, '2027-06-05')
  await action(page).click()
  await expect(question(page, 3)).toBeVisible()
  await main(page).getByRole('textbox').fill('Half-finished Games')
  await action(page).click()
  await expect(question(page, 4)).toBeVisible()

  await page.reload()
  await expect(action(page)).toHaveText('Pick up where you left off')
  await action(page).click()
  await expect(question(page, 4)).toBeVisible()
  await page.getByRole('button', { name: 'Back to the previous question' }).click()
  await expect(question(page, 3)).toBeVisible()
  await expect(main(page).getByRole('textbox')).toHaveValue('Half-finished Games')

  await page.reload()
  await main(page).getByRole('button', { name: 'Start over' }).click()
  await expect(question(page, 1)).toBeVisible()
  // Nothing saved now: back to a plain Start.
  await page.reload()
  await expect(action(page)).toHaveText('Start')
})

test('the old address still gets there', async ({ page }) => {
  await page.goto('/competitions/submit')
  await expect(page).toHaveURL(/\/competitions\/add$/)
  await expect(page.getByRole('heading', { name: 'Add your competition', level: 1 })).toBeVisible()
})

test('Home has a way in, below every competition', async ({ page }) => {
  // One coming up, so Home lists competitions.
  const comp = await retry(() =>
    seedCompetition({
      id: uid('wayin'),
      startOffset: 5,
      dancersPerGroup: 1,
      resultsForGroups: 0,
    }),
  )
  try {
    await page.goto('/')
    await expect(
      page.getByRole('main').getByRole('link', { name: 'See all competitions' }),
    ).toBeVisible()
    await page
      .getByRole('main')
      .getByRole('link', { name: 'Add it to ScotDance.app' })
      .click()
    await expect(page).toHaveURL(/\/competitions\/add$/)
    await expect(
      page.getByRole('heading', { name: 'Add your competition', level: 1 }),
    ).toBeVisible()
  } finally {
    await retry(() => removeCompetition(comp.id))
  }
})
