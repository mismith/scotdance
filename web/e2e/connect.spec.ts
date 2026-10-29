import { expect, test, type Page } from '@playwright/test'
import { dbGet, dbRemove, ensureUser, grantCompetition, signIn, uid } from './support/emulator'
import { seedEmptyCompetition } from './support/manageData'
import { retry } from './support/retry'
import { removeCompetition } from './support/seed'

// Organisers' other tools (ADR 0015): a tool's page loads ScotDance.app's
// /embed.js and calls ScotDance.send(); ScotDance.app's own sheet opens over
// it in an iframe, signs in, asks which competition, and drops the list in
// the organiser's inbox for Import dancers. The tool here is a stand-in page
// on another origin, as Splits is.

const TOOL = 'http://localhost:5299'
// The stand-in is faked by Playwright, so Chrome counts it as a public site
// and won't let it load scripts from localhost (Local Network Access). Real
// tools are public sites loading from scotdance.app, so it never applies.
test.use({ launchOptions: { args: ['--disable-features=LocalNetworkAccessChecks'] } })
const CSV = 'Beginner 7 Years & Under\n101,Ava,Ross,"Calgary, AB"\n102,Ben,Hall,"Banff, AB"\n'

const SEND = `ScotDance.send({ source: 'Splits', name: 'entries.csv', text: ${JSON.stringify(CSV)} })`
const SIGN_IN = `ScotDance.signIn({ audience: 'challenge' })`

async function openTool(page: Page, baseURL: string, call = SEND) {
  await page.route(`${TOOL}/**`, (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: `<!doctype html><title>Tool</title><button id="send">Send</button>
        <script src="${baseURL}/embed.js"></script>
        <script>
          document.getElementById('send').onclick = async () => {
            window.result = await ${call}
          }
        </script>`,
    }),
  )
  await page.goto(`${TOOL}/`)
  await page.getByRole('button', { name: 'Send' }).click()
}

const sheet = (page: Page) => page.frameLocator('iframe[title="ScotDance.app"]').locator('dialog[open]')
const result = (page: Page) => page.evaluate(() => (window as unknown as { result?: Record<string, unknown> }).result)

const made: string[] = []
test.afterAll(async () => {
  for (const id of made) await retry(() => removeCompetition(id))
})

async function organiser() {
  const competition = await seedEmptyCompetition()
  made.push(competition.id)
  const email = `${uid('org')}@example.test`
  const id = await ensureUser(email)
  await retry(() => grantCompetition(id, competition.id))
  return { competition, email, uid: id }
}

test('signs in, sends to the competition tapped, and opens its Import dancers, signed in', async ({ page, baseURL }) => {
  const { competition, email, uid: me } = await organiser()
  await openTool(page, baseURL!)

  const s = sheet(page)
  await expect(s.getByRole('heading', { name: 'Sign in to ScotDance.app' })).toBeVisible()
  await expect(s.getByText('2 dancers, from Splits')).toBeVisible()
  await s.getByRole('textbox', { name: 'Email address' }).fill(email)
  await s.getByLabel('Password', { exact: true }).fill('password')
  await s.getByLabel('Password', { exact: true }).press('Enter')

  await expect(s.getByRole('heading', { name: 'Which competition?' })).toBeVisible()
  const popupPromise = page.waitForEvent('popup')
  await s.getByRole('button', { name: new RegExp(competition.name) }).click()
  const popup = await popupPromise

  // In the organiser's own inbox, exactly the agreed fields
  const inbox = await dbGet<Record<string, Record<string, unknown>>>(`users:inbox/${me}`)
  const [key, item] = Object.entries(inbox ?? {})[0] ?? []
  expect(item).toMatchObject({ kind: 'dancers', source: 'Splits', name: 'entries.csv', text: CSV, competitionId: competition.id })
  expect(Object.keys(item!).sort()).toEqual(['competitionId', 'kind', 'name', 'sentAt', 'source', 'text'])

  // Its Import dancers opens with the list in the preview: already signed in,
  // since signing in over the tool signed in to ScotDance.app
  await expect(popup).toHaveURL(new RegExp(`/competitions/${competition.id}/manage/dancers/import\\?inbox=${key}$`))
  await expect(popup.getByText('Ava Ross')).toBeVisible({ timeout: 15_000 })
  await expect(popup.getByRole('button', { name: /Import 2 dancers/ })).toBeVisible()

  await expect(s.getByRole('heading', { name: `Sent to ${competition.name}` })).toBeVisible()
  await s.getByRole('button', { name: 'Done' }).click()
  await expect(page.locator('scotdance-connect')).toHaveCount(0)
  await expect.poll(() => result(page)).toMatchObject({ sent: true, competitionId: competition.id, competitionName: competition.name })

  await dbRemove(`users:inbox/${me}`)
})

test('already signed in to ScotDance.app, it goes straight to the competitions', async ({ page, baseURL }) => {
  const { competition, email } = await organiser()
  await signIn(page, email)
  await openTool(page, baseURL!)

  const s = sheet(page)
  await expect(s.getByRole('heading', { name: 'Which competition?' })).toBeVisible()
  await expect(s.getByRole('button', { name: new RegExp(competition.name) })).toBeVisible()
  await expect(s.getByText(`Signed in as ${email}.`)).toBeVisible()
})

test('with no competitions, says to add one first', async ({ page, baseURL }) => {
  const email = `${uid('org')}@example.test`
  await ensureUser(email)
  await signIn(page, email)
  await openTool(page, baseURL!)

  const s = sheet(page)
  await expect(s.getByText('No competitions to send to yet')).toBeVisible()
  await expect(s.getByRole('link', { name: 'Add a competition' })).toHaveAttribute('href', `${baseURL}/competitions/add`)
})

test('closing it sends nothing, and gives the page back', async ({ page, baseURL }) => {
  await openTool(page, baseURL!)
  const s = sheet(page)
  await expect(s.getByRole('heading', { name: 'Sign in to ScotDance.app' })).toBeVisible()
  await expect.poll(() => page.evaluate(() => document.documentElement.style.overflow)).toBe('hidden')

  await s.getByRole('button', { name: 'Close' }).click()
  await expect(page.locator('scotdance-connect')).toHaveCount(0)
  await expect.poll(() => result(page)).toEqual({ sent: false })
  expect(await page.evaluate(() => document.documentElement.style.overflow)).toBe('')
})

test('opened on its own, it points to the tools', async ({ page }) => {
  await page.goto('/connect.html')
  await expect(page.getByText('This opens from your organiser tools')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Go to ScotDance.app' })).toHaveAttribute('href', '/')
})


// Sign in with ScotDance.app, for a tool on another project (Challenge). The
// pass itself is unit-tested (functionsToolPass.test.ts); here the functions
// emulator isn't needed, so its answer is stood in for.
async function standInToolPass(page: Page) {
  const asked: unknown[] = []
  await page.route('**/toolPass', async (route) => {
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' }
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
    asked.push(route.request().postDataJSON())
    await route.fulfill({ headers: cors, contentType: 'application/json', body: JSON.stringify({ result: { pass: 'test-pass' } }) })
  })
  return asked
}

test('Sign in with ScotDance.app hands Challenge a pass, and only your name and email', async ({ page, baseURL }) => {
  const email = `${uid('dancer')}@example.test`
  const me = await ensureUser(email)
  const asked = await standInToolPass(page)
  await openTool(page, baseURL!, SIGN_IN)

  const s = sheet(page)
  await expect(s.getByRole('heading', { name: 'Sign in with ScotDance.app' })).toBeVisible()
  await expect(s.getByText('Challenge gets your name and email address, nothing else.')).toBeVisible()
  await s.getByRole('textbox', { name: 'Email address' }).fill(email)
  await s.getByLabel('Password', { exact: true }).fill('password')
  await s.getByLabel('Password', { exact: true }).press('Enter')

  // Signing in here is the yes: it carries on by itself
  await expect(page.locator('scotdance-connect')).toHaveCount(0)
  expect(asked).toEqual([{ data: { audience: 'challenge' } }])
  await expect.poll(() => result(page)).toEqual({ signedIn: true, pass: 'test-pass', uid: me, email, name: null })
})

test('already signed in, a tool learns who you are only when you tap Continue', async ({ page, baseURL }) => {
  const email = `${uid('dancer')}@example.test`
  await ensureUser(email)
  await signIn(page, email)
  const asked = await standInToolPass(page)
  await openTool(page, baseURL!, SIGN_IN)

  const s = sheet(page)
  await expect(s.getByRole('heading', { name: 'Continue to Challenge?' })).toBeVisible()
  expect(asked).toEqual([])
  await s.getByRole('button', { name: `Continue as ${email}` }).click()
  await expect(page.locator('scotdance-connect')).toHaveCount(0)
  await expect.poll(() => result(page)).toMatchObject({ signedIn: true, pass: 'test-pass', email })
})

test('closing Sign in with ScotDance.app tells the tool nothing', async ({ page, baseURL }) => {
  await openTool(page, baseURL!, SIGN_IN)
  await expect(sheet(page).getByRole('heading', { name: 'Sign in with ScotDance.app' })).toBeVisible()
  await sheet(page).getByRole('button', { name: 'Close' }).click()
  await expect.poll(() => result(page)).toEqual({ signedIn: false })
})
