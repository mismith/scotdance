import { expect, test, type Page } from '@playwright/test'
import { dbGet, dbRemove, ensureUser, signIn, uid } from './support/emulator'

// Submitting a competition, through the real database rules and Cloud
// Functions trigger: signed in only, an overview and then a step at a time,
// stored in the shape the approval function and System admin › Submissions
// read.

type Submission = {
  competition: Record<string, unknown>
  contact: Record<string, unknown>
  submitted: string
  submittedBy?: string
}
const submissionsNamed = async (name: string) =>
  Object.entries((await dbGet<Record<string, Submission>>('competitions:submissions')) ?? {}).filter(([, s]) => s.competition?.name === name)
const removeSubmissionsNamed = async (name: string) => Promise.all((await submissionsNamed(name)).map(([id]) => dbRemove(`competitions:submissions/${id}`)))

const GOOGLE = /maps\.googleapis\.com|places\.googleapis\.com/
const heading = (page: Page, step: number) => page.getByRole('heading', { name: new RegExp(`^Step ${step} of 4`) })
const next = (page: Page) => page.getByRole('button', { name: 'Next', exact: true }).click()
const stepper = (page: Page, label: string) => page.getByRole('navigation', { name: 'Steps' }).getByRole('button', { name: label })

async function signInOnSheet(page: Page, email: string) {
  await page.locator('dialog[open]').getByRole('textbox', { name: 'Email address' }).fill(email)
  const password = page.locator('dialog[open] input[name=password]')
  await password.fill('password')
  await password.press('Enter')
  await page.locator('dialog[open]').waitFor({ state: 'detached' })
}

/** Signed in, past the overview, on step 1. */
async function begin(page: Page, email: string) {
  // Typing a venue searches Google Places: never from tests (it's billed).
  await page.route(GOOGLE, (r) => r.abort())
  await signIn(page, email)
  await page.goto('/competitions/submit')
  await page.getByRole('button', { name: 'Start', exact: true }).click()
  await expect(heading(page, 1)).toBeVisible()
}

test('signed out: the overview and a way in, but no form and no venue search', async ({ page }) => {
  const requests: string[] = []
  page.on('request', (r) => requests.push(r.url()))
  await page.goto('/competitions/submit')
  await expect(page.getByRole('heading', { name: 'What you’ll need' })).toBeVisible()
  // What's needed later is tucked away until asked for.
  const onTheDay = page.getByRole('button', { name: 'On the day' })
  await expect(onTheDay).toHaveAttribute('aria-expanded', 'false')
  await expect(page.getByText('A laptop or tablet.')).toHaveCount(0)
  await onTheDay.click()
  await expect(page.getByText('A laptop or tablet.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Sign in to submit' })).toBeVisible()
  await expect(page.locator('main form')).toHaveCount(0)
  await expect(page.getByRole('main').getByRole('textbox')).toHaveCount(0)
  await expect(page.getByRole('main').getByRole('combobox')).toHaveCount(0)
  // Give anything lazy a moment to (not) load.
  await page.waitForTimeout(1500)
  expect(requests.filter((u) => GOOGLE.test(u))).toEqual([])
})

test('signing in from the overview goes straight to the first step, on the same page', async ({ page }) => {
  const email = `${uid('org')}@example.test`
  await ensureUser(email)
  await page.goto('/competitions/submit')
  await page.getByRole('button', { name: 'Sign in to submit' }).click()
  await signInOnSheet(page, email)
  await expect(heading(page, 1)).toBeVisible()
  await expect(page).toHaveURL(/\/competitions\/submit$/)
  await expect(page.getByRole('textbox', { name: 'Name (required)', exact: true })).toBeVisible()
})

test('a step at a time, checked as it goes, and sent once however fast it’s tapped', async ({ page }) => {
  const email = `${uid('org')}@example.test`
  const orgId = await ensureUser(email)
  const name = `E2E Submit ${uid('s').slice(-6)}`
  try {
    await begin(page, email)

    // Each step checks its own required fields before moving on.
    await next(page)
    await expect(page.getByText('Add the competition’s name.')).toBeVisible()
    await expect(page.getByText('Add the date.')).toBeVisible()
    await expect(heading(page, 1)).toBeVisible()
    await page.getByRole('textbox', { name: 'Name (required)', exact: true }).fill(name)
    await page.locator('input[type=date]').fill('2027-06-05')
    await page.getByRole('button', { name: 'Add a description' }).click()
    await page.getByRole('textbox', { name: 'Description' }).fill('Outdoors. Bring a chair.')
    await page.getByRole('button', { name: 'Add registration number' }).click()
    await page.getByRole('textbox', { name: 'Registration number' }).fill('C-AB-CO-27-1234')
    await next(page)

    await expect(heading(page, 2)).toBeVisible()
    await next(page)
    await expect(page.getByText('Add the town or city.')).toBeVisible()
    await expect(heading(page, 2)).toBeVisible()
    // Typed and not picked from the suggestions: it stays as the name.
    await page.getByRole('combobox', { name: 'Venue name' }).fill('Spruce Meadows')
    await page.getByRole('textbox', { name: 'Town or city (required)' }).fill('Calgary, AB')

    // Back and Next keep what was typed.
    await page.getByRole('button', { name: 'Back', exact: true }).click()
    await expect(heading(page, 1)).toBeVisible()
    await expect(page.getByRole('textbox', { name: 'Name (required)', exact: true })).toHaveValue(name)
    await expect(page.getByRole('textbox', { name: 'Description' })).toHaveValue('Outdoors. Bring a chair.')
    await next(page)
    await expect(page.getByRole('combobox', { name: 'Venue name' })).toHaveValue('Spruce Meadows')
    await expect(page.getByRole('textbox', { name: 'Town or city (required)' })).toHaveValue('Calgary, AB')
    await next(page)

    await expect(heading(page, 3)).toBeVisible()
    await expect(page.getByText('None of it is shown publicly.')).toBeVisible()
    await expect(page.getByRole('main').getByText(email)).toBeVisible()
    await page.getByRole('textbox', { name: 'Your name (required)' }).fill('Morag Test')
    await page.getByRole('button', { name: 'Add a message' }).click()
    await page.getByRole('textbox', { name: 'Message' }).fill('Two days, same hall.')
    await next(page)

    // The review shows it all before anything is sent.
    await expect(heading(page, 4)).toBeVisible()
    const review = page.locator('main dl')
    for (const text of [name, 'C-AB-CO-27-1234', 'Outdoors. Bring a chair.', 'Spruce Meadows', 'Calgary, AB', 'Morag Test', email, 'Two days, same hall.']) {
      await expect(review.getByText(text).first()).toBeVisible()
    }
    await page.getByRole('button', { name: 'Submit', exact: true }).click()
    await expect(page.getByText('Tick this to continue.')).toBeVisible()
    expect(await submissionsNamed(name)).toEqual([])

    await page.getByRole('checkbox', { name: /run by a volunteer/ }).check()
    await page.getByRole('button', { name: 'Submit', exact: true }).dblclick()
    await expect(page.getByRole('heading', { name: 'Submitted' })).toBeVisible()

    // Once, in the shape approval reads (the server adds who sent it).
    await expect.poll(async () => (await submissionsNamed(name)).map(([, s]) => s.submittedBy)).toEqual([orgId])
    await page.waitForTimeout(1000)
    const all = await submissionsNamed(name)
    expect(all).toHaveLength(1)
    const [[, sent]] = all
    expect(Object.keys(sent).sort()).toEqual(['competition', 'contact', 'submitted', 'submittedBy'])
    expect(sent.competition).toEqual({
      name,
      date: '2027-06-05',
      venue: 'Spruce Meadows',
      location: 'Calgary, AB',
      sobhd: 'C-AB-CO-27-1234',
      description: 'Outdoors. Bring a chair.',
    })
    expect(sent.contact).toEqual({ name: 'Morag Test', email, message: 'Two days, same hall.', disclaimer: true })
    expect(Date.parse(sent.submitted)).toBeGreaterThan(Date.now() - 5 * 60_000)
  } finally {
    await removeSubmissionsNamed(name)
  }
})

test('the stepper goes back freely, and forward only as far as the steps on the way are done', async ({ page }) => {
  const email = `${uid('org')}@example.test`
  await ensureUser(email)
  await begin(page, email)
  await expect(stepper(page, 'Step 1: Details')).toHaveAttribute('aria-current', 'step')

  await stepper(page, 'Step 4: Review').click()
  await expect(heading(page, 1)).toBeVisible()
  await expect(page.getByText('Add the competition’s name.')).toBeVisible()

  await page.getByRole('textbox', { name: 'Name (required)', exact: true }).fill('Jumping Games')
  await page.locator('input[type=date]').fill('2027-06-05')
  await stepper(page, 'Step 4: Review').click()
  await expect(heading(page, 2)).toBeVisible()
  await expect(page.getByText('Add the town or city.')).toBeVisible()
  await expect(stepper(page, 'Step 2: Venue')).toHaveAttribute('aria-current', 'step')

  await page.getByRole('textbox', { name: 'Town or city (required)' }).fill('Calgary, AB')
  await stepper(page, 'Step 4: Review').click()
  await expect(heading(page, 3)).toBeVisible()
  await expect(page.getByText('Add your name.')).toBeVisible()

  await page.getByRole('textbox', { name: 'Your name (required)' }).fill('Morag Test')
  await stepper(page, 'Step 4: Review').click()
  await expect(heading(page, 4)).toBeVisible()

  await stepper(page, 'Step 1: Details').click()
  await expect(heading(page, 1)).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Name (required)', exact: true })).toHaveValue('Jumping Games')
})

test('Submit another starts afresh, at the same venue', async ({ page }) => {
  const email = `${uid('org')}@example.test`
  await ensureUser(email)
  const name = `E2E Submit ${uid('s').slice(-6)}`
  try {
    await begin(page, email)
    await page.getByRole('textbox', { name: 'Name (required)', exact: true }).fill(name)
    await page.locator('input[type=date]').fill('2027-06-05')
    await next(page)
    await page.getByRole('textbox', { name: 'Town or city (required)' }).fill('Calgary, AB')
    await next(page)
    await page.getByRole('textbox', { name: 'Your name (required)' }).fill('Morag Test')
    await next(page)
    await page.getByRole('checkbox', { name: /run by a volunteer/ }).check()
    await page.getByRole('button', { name: 'Submit', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Submitted' })).toBeVisible()

    await page.getByRole('button', { name: 'Submit another' }).click()
    await expect(heading(page, 1)).toBeVisible()
    await expect(page.getByRole('textbox', { name: 'Name (required)', exact: true })).toHaveValue('')
    await expect(page.locator('input[type=date]')).toHaveValue('')
    await page.getByRole('textbox', { name: 'Name (required)', exact: true }).fill(`${name} day 2`)
    await page.locator('input[type=date]').fill('2027-06-06')
    await next(page)
    await expect(page.getByRole('textbox', { name: 'Town or city (required)' })).toHaveValue('Calgary, AB')
    await next(page)
    await expect(page.getByRole('textbox', { name: 'Your name (required)' })).toHaveValue('Morag Test')
  } finally {
    await removeSubmissionsNamed(name)
  }
})

test('the answers so far outlast a reload, skipping the overview, until started over', async ({ page }) => {
  const email = `${uid('org')}@example.test`
  await ensureUser(email)
  await begin(page, email)
  await page.getByRole('textbox', { name: 'Name (required)', exact: true }).fill('Half-finished Games')
  await page.locator('input[type=date]').fill('2027-06-05')
  await next(page)
  await expect(heading(page, 2)).toBeVisible()

  await page.reload()
  await expect(page.getByText('Picked up where you left off.')).toBeVisible()
  await expect(heading(page, 2)).toBeVisible()
  await page.getByRole('button', { name: 'Back', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'Name (required)', exact: true })).toHaveValue('Half-finished Games')

  await page.reload()
  await page.getByRole('button', { name: 'Start over' }).click()
  await expect(heading(page, 1)).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Name (required)', exact: true })).toHaveValue('')
  // Nothing saved now: back to the overview.
  await page.reload()
  await expect(page.getByRole('button', { name: 'Start', exact: true })).toBeVisible()
  await expect(page.getByText('Picked up where you left off.')).toHaveCount(0)
})

test('Home has a way in, below every competition', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('main').getByRole('link', { name: 'See all competitions' })).toBeVisible()
  await page.getByRole('main').getByRole('link', { name: 'Add it to ScotDance.app' }).click()
  await expect(page).toHaveURL(/\/competitions\/submit$/)
  await expect(page.getByRole('heading', { name: 'Submit a competition', level: 1 })).toBeVisible()
})
