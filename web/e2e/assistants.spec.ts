import { createHash, randomBytes } from 'node:crypto'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { expect, test, type Page } from '@playwright/test'
import { dbGet, dbRemove, dbSet, ensureUser, grantCompetition, signIn, uid } from './support/emulator'
import { retry } from './support/retry'
import { removeCompetition, seedCompetition } from './support/seed'

// Connecting an AI assistant (ADR 0018): it sends the organiser to /connect-ai, they allow it, and it gets a code to
// trade for tokens. Account lists the connection and Disconnect ends it. The "assistant" here is a stand-in: a
// local page that publishes a client document, as Claude does, and catches the redirect.

// The functions emulator runs one worker (--inspect-functions: see .github/workflows/e2e.yml), so every request to a function, even
// a route that does nothing, waits behind whatever triggers other tests have set off. Measured under a full run, `mcp`'s
// well-known route (no database, no token) answered in 5 ms when quiet and took up to 51 s at the worst; it is not the tools' work.
// So these specs allow for the queue instead of the default 30 s.
test.describe.configure({ mode: 'serial', timeout: 180_000 })

let assistant: Server
let origin = ''
let landed: URL[] = []
let competitionId = ''
let competitionName = ''
const organiserEmail = `${uid('assist-org')}@example.test`
const stillEmail = `${uid('assist-none')}@example.test`
let organiserId = ''
let stillId = ''

test.beforeAll(async () => {
  assistant = createServer((req, res) => {
    const url = new URL(req.url ?? '/', origin)
    if (url.pathname === '/client.json') {
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ client_id: `${origin}/client.json`, client_name: 'E2E Assistant', redirect_uris: [`${origin}/callback`] }))
      return
    }
    if (url.pathname === '/callback') landed.push(url)
    res.setHeader('Content-Type', 'text/html')
    res.end('<!doctype html><title>Assistant</title><p>Back at the assistant.</p>')
  })
  await new Promise<void>((done) => assistant.listen(0, '127.0.0.1', done))
  origin = `http://127.0.0.1:${(assistant.address() as AddressInfo).port}`
  const comp = await seedCompetition({ dancersPerGroup: 2 })
  competitionId = comp.id
  competitionName = comp.name
  organiserId = await ensureUser(organiserEmail)
  await grantCompetition(organiserId, competitionId)
  stillId = await ensureUser(stillEmail)
})

test.afterAll(async () => {
  await new Promise((done) => assistant.close(done))
  await retry(() => removeCompetition(competitionId))
  for (const id of [organiserId, stillId]) {
    await dbRemove(`users:connections/${id}`)
    await dbRemove(`users:changes/${id}`)
    await dbRemove(`users:permissions/${id}`)
  }
})

test.beforeEach(() => {
  landed = []
})

/** The address an assistant sends people to: PKCE, the client document, and the one MCP address as the resource */
function authorizeUrl(baseURL: string, state = 'st-1') {
  const verifier = randomBytes(32).toString('base64url')
  const challenge = createHash('sha256').update(verifier).digest('base64url')
  const q = new URLSearchParams({
    response_type: 'code',
    client_id: `${origin}/client.json`,
    redirect_uri: `${origin}/callback`,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    state,
    resource: `${baseURL}/mcp`,
  })
  return `${baseURL}/oauth/authorize?${q}`
}

const assistantsSection = (page: Page) => page.locator('section').filter({ has: page.getByRole('heading', { name: 'AI assistants' }) })

test('allowing an AI assistant sends it back with a code, and Account lists it until Disconnect', async ({ page, baseURL }) => {
  await signIn(page, organiserEmail)
  await page.goto(authorizeUrl(baseURL!))
  await expect(page).toHaveURL(/\/connect-ai\?request=/)
  // Its address is shown (ScotDance.app doesn't know it by name), with the warning
  await expect(page.getByText('Let 127.0.0.1 manage your competitions?')).toBeVisible()
  await expect(page.getByText('It calls itself “E2E Assistant”')).toBeVisible()
  await page.getByRole('button', { name: 'Allow' }).click()

  await page.waitForURL(`${origin}/callback**`)
  expect(landed).toHaveLength(1)
  expect(landed[0].searchParams.get('state')).toBe('st-1')
  expect(landed[0].searchParams.get('code')).toBeTruthy()
  expect(landed[0].searchParams.get('error')).toBeNull()

  await page.goto('/profile')
  const section = assistantsSection(page)
  await expect(section.getByText('E2E Assistant', { exact: true })).toBeVisible()
  await expect(section.getByText(/Connected today/)).toBeVisible()

  await section.getByRole('button', { name: 'Disconnect' }).click()
  await page.getByRole('button', { name: 'Disconnect E2E Assistant' }).click()
  await expect(section.getByText('E2E Assistant', { exact: true })).toHaveCount(0)
  expect(await dbGet(`users:connections/${organiserId}`)).toBeNull()
})

test('Not now sends the AI assistant back refused, and nothing is connected', async ({ page, baseURL }) => {
  await signIn(page, organiserEmail)
  await page.goto(authorizeUrl(baseURL!, 'st-no'))
  await page.getByRole('button', { name: 'Not now' }).click()
  await page.waitForURL(`${origin}/callback**`)
  expect(landed).toHaveLength(1)
  expect(landed[0].searchParams.get('error')).toBe('access_denied')
  expect(landed[0].searchParams.get('state')).toBe('st-no')
  expect(await dbGet(`users:connections/${organiserId}`)).toBeNull()
})

test('signed out: sign in on the page, then allow', async ({ page, baseURL }) => {
  await page.goto(authorizeUrl(baseURL!, 'st-out'))
  await expect(page.getByText('Connect your AI assistant', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Sign in', exact: true }).last().click()
  const sheet = page.locator('dialog[open]')
  await sheet.getByRole('textbox', { name: 'Email address' }).fill(organiserEmail)
  const password = sheet.locator('input[name=password]')
  await password.fill('password')
  await password.press('Enter')
  await sheet.waitFor({ state: 'detached' })
  await expect(page.getByText('Let 127.0.0.1 manage your competitions?')).toBeVisible()
  await page.getByRole('button', { name: 'Allow' }).click()
  await page.waitForURL(`${origin}/callback**`)
  expect(landed).toHaveLength(1)
  expect(landed[0].searchParams.get('state')).toBe('st-out')
  // (Ends it again, so the next tests start clean)
  await page.goto('/profile')
  await assistantsSection(page).getByRole('button', { name: 'Disconnect' }).click()
  await page.getByRole('button', { name: 'Disconnect E2E Assistant' }).click()
  await expect(assistantsSection(page).getByText('E2E Assistant', { exact: true })).toHaveCount(0)
})

test('a request that is unknown or has run out says so', async ({ page }) => {
  await signIn(page, organiserEmail)
  await page.goto('/connect-ai?request=notarealrequest123')
  await expect(page.getByText('That request has run out')).toBeVisible()
  await page.goto('/connect-ai')
  await expect(page.getByText('That request has run out')).toBeVisible()
})

test('the address sheet shows the address to paste', async ({ page }) => {
  await signIn(page, organiserEmail)
  await page.goto('/profile')
  await page.getByRole('button', { name: 'Connect an AI assistant' }).click()
  const sheet = page.locator('dialog[open]')
  await expect(sheet.getByText(/\/mcp$/)).toBeVisible()
  await sheet.getByRole('button', { name: 'Done' }).click()
})

test('someone who manages nothing has no AI assistants on Account, and has nothing to allow', async ({ page, baseURL }) => {
  await signIn(page, stillEmail)
  await page.goto('/profile')
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'AI assistants' })).toHaveCount(0)

  await page.goto(authorizeUrl(baseURL!, 'st-none'))
  await expect(page.getByText('You don’t manage anything yet')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Allow' })).toHaveCount(0)
  expect(await dbGet(`users:connections/${stillId}`)).toBeNull()

  // And the server holds if the page is skipped: asking to allow it directly is refused
  const request = new URL(page.url()).searchParams.get('request')
  const OFFSET = Number(process.env.E2E_EMULATOR_PORT_OFFSET ?? 0)
  const signedIn = await fetch(`http://127.0.0.1:${9099 + OFFSET}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: stillEmail, password: 'password', returnSecureToken: true }),
  }).then((r) => r.json() as Promise<{ idToken: string }>)
  const res = await fetch(`http://127.0.0.1:${5001 + OFFSET}/firebase-scotdance/us-central1/approveConnection`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${signedIn.idToken}` }, body: JSON.stringify({ data: { request } }),
  })
  expect((await res.json()).error?.status).toBe('PERMISSION_DENIED')
  expect(await dbGet(`users:connections/${stillId}`)).toBeNull()
})

test('Account shows what an AI assistant changed: newest first, undone marked, names, show more, and an empty state', async ({ page, baseURL }) => {
  await signIn(page, organiserEmail)
  await page.goto(authorizeUrl(baseURL!, 'st-log'))
  await page.getByRole('button', { name: 'Allow' }).click()
  await page.waitForURL(`${origin}/callback**`)
  const connection = Object.keys((await dbGet<Record<string, unknown>>(`users:connections/${organiserId}`)) ?? {})[0]
  await page.goto('/profile')
  const section = assistantsSection(page)
  const open = () => section.getByRole('button', { name: 'What E2E Assistant changed' }).click()

  // Nothing yet
  await open()
  const sheet = page.locator('dialog[open]')
  await expect(sheet.getByText('Nothing changed yet')).toBeVisible()
  await sheet.getByRole('button', { name: 'Close' }).click()
  await sheet.waitFor({ state: 'detached' })

  // 23 changes: the sheet shows the latest 20, and the rest on Show more
  const now = Date.now()
  for (let i = 0; i < 23; i++) {
    await dbSet(`users:changes/${organiserId}/${connection}/c${String(i).padStart(2, '0')}`, {
      at: now - i * 60_000, scope: 'competitions', scopeId: competitionId, summary: `Change number ${i}`, ...(i === 1 ? { undone: now } : {}),
    })
  }
  await dbSet(`users:changes/${organiserId}/${connection}/gone`, { at: now - 5 * 60_000 + 1, scope: 'organisations', scopeId: 'nothing-here', summary: 'Changed location' })
  await open()
  await expect(sheet.getByText('Change number 0', { exact: true })).toBeVisible()
  const summaries = sheet.locator('li > span:first-child')
  await expect(summaries).toHaveCount(20)
  await expect(summaries.nth(0)).toHaveText('Change number 0')
  await expect(summaries.nth(1)).toHaveText('Change number 1')
  await expect(sheet.getByText('Undone', { exact: false }).first()).toBeVisible()
  await expect(sheet.getByText('An organisation that is gone')).toBeVisible()
  await expect(sheet.getByText(competitionName).first()).toBeVisible()
  await expect(sheet.getByRole('button', { name: 'Undo' })).toHaveCount(0)
  await sheet.getByRole('button', { name: 'Show more' }).click()
  await expect(summaries).toHaveCount(24)
  await expect(sheet.getByRole('button', { name: 'Show more' })).toHaveCount(0)
  await sheet.getByRole('button', { name: 'Close' }).click()
  await sheet.waitFor({ state: 'detached' })

  await dbRemove(`users:changes/${organiserId}`)
  await section.getByRole('button', { name: 'Disconnect' }).click()
  await page.getByRole('button', { name: 'Disconnect E2E Assistant' }).click()
  await expect(section.getByText('E2E Assistant', { exact: true })).toHaveCount(0)
})
