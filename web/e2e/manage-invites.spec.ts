import { expect, test, type Browser, type Page } from '@playwright/test'
import { dbGet, dbRemove, ensureUser, grantCompetition, grantSystemAdmin, signIn, uid } from './support/emulator'
import { removeCompetition, seedCompetition } from './support/seed'

// Inviting admins and submitting competitions, through the real database
// rules and Cloud Functions triggers (emails fail in the emulator, which
// mustn't leave anything half done).

test.skip(({ isMobile }) => isMobile, 'server flows: one layout is enough')

const OFFSET = Number(process.env.E2E_EMULATOR_PORT_OFFSET ?? 0)

async function signInOnSheet(page: Page, email: string) {
  await page.getByRole('textbox', { name: 'Email address' }).fill(email)
  await page.locator('input[name=password]').fill('password')
  await page.locator('input[name=password]').press('Enter')
  await page.locator('dialog[open]').waitFor({ state: 'detached' })
}

async function newPage(browser: Browser) {
  return (await browser.newContext()).newPage()
}

/** An organiser invites `email` from Manage › Admins; returns the invite's id once the server has it. */
async function invite(page: Page, competitionId: string, email: string) {
  await page.goto(`/competitions/${competitionId}/manage/admins`)
  await page.getByRole('textbox', { name: 'Invite someone' }).fill(email)
  await page.getByRole('button', { name: 'Send invite' }).click()
  await expect(page.getByText(`Invite sent to ${email}`)).toBeVisible()
  let id = ''
  await expect
    .poll(async () => {
      const all = (await dbGet<Record<string, { payload?: { email?: string }; createdBy?: string }>>(`competitions:data/${competitionId}/invites`)) ?? {}
      const found = Object.entries(all).find(([, i]) => i.payload?.email === email && i.createdBy)
      id = found?.[0] ?? ''
      return id
    })
    .not.toBe('')
  return id
}

test('an invited helper accepts from the emailed link, then loses access when removed', async ({ page, browser }) => {
  const comp = await seedCompetition({ dancersPerGroup: 1 })
  const orgEmail = `${uid('org')}@example.test`
  const orgId = await ensureUser(orgEmail)
  await grantCompetition(orgId, comp.id)
  const guestEmail = `${uid('guest')}@example.test`
  const guestId = await ensureUser(guestEmail)
  const guest = await newPage(browser)
  try {
    await signIn(page, orgEmail)
    const inviteId = await invite(page, comp.id, guestEmail)
    const row = page.getByRole('listitem').filter({ hasText: guestEmail })
    // Emails can't go out from the emulator: the organiser is told, and can copy the link.
    await expect(row.getByText('The email didn’t go out. Copy the link and send it yourself.')).toBeVisible()
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
    await row.getByRole('button', { name: 'Copy link' }).click()
    await expect(page.getByText(`Link copied. Send it to ${guestEmail} any way you like.`)).toBeVisible()
    expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(new RegExp(`/competitions/${comp.id}/invites/${inviteId}$`))

    // The link in the email is the old app's #/ form.
    await guest.goto(`/#/competitions/${comp.id}/invites/${inviteId}`)
    await expect(guest.getByText(`You’re invited to help manage ${comp.name}`)).toBeVisible()
    await guest.getByRole('button', { name: 'Sign in to accept' }).click()
    await signInOnSheet(guest, guestEmail)
    await guest.getByRole('button', { name: 'Accept' }).click()
    await expect(guest.getByText(`You can manage ${comp.name}`)).toBeVisible()
    expect(await dbGet(`users:permissions/${guestId}/competitions/${comp.id}`)).toBe(true)

    // The organiser sees them arrive.
    await expect(page.getByRole('listitem').filter({ hasText: guestEmail }).getByText(/^Accepted/)).toBeVisible()

    await guest.getByRole('link', { name: 'Start managing' }).click()
    await expect(guest.getByRole('heading', { name: comp.name })).toBeVisible()

    await page.getByRole('listitem').filter({ hasText: guestEmail }).getByRole('button', { name: 'Remove' }).click()
    await page.locator('dialog[open]').getByRole('button', { name: 'Remove' }).click()
    await expect(guest.getByText('You can’t manage this competition')).toBeVisible()
    await expect.poll(() => dbGet(`users:permissions/${guestId}/competitions/${comp.id}`)).toBeNull()
  } finally {
    await guest.context().close()
    await Promise.all([removeCompetition(comp.id), dbRemove(`users:permissions/${orgId}`), dbRemove(`users:permissions/${guestId}`)])
  }
})

test('a cancelled invite says so, and sending it again lets them in', async ({ page, browser }) => {
  const comp = await seedCompetition({ dancersPerGroup: 1 })
  const orgEmail = `${uid('org')}@example.test`
  const orgId = await ensureUser(orgEmail)
  await grantCompetition(orgId, comp.id)
  const guestEmail = `${uid('guest')}@example.test`
  const guestId = await ensureUser(guestEmail)
  const guest = await newPage(browser)
  try {
    await signIn(page, orgEmail)
    const inviteId = await invite(page, comp.id, guestEmail)
    const row = page.getByRole('listitem').filter({ hasText: guestEmail })
    await row.getByRole('button', { name: 'Cancel' }).click()
    await expect(row.getByText(/^Cancelled/)).toBeVisible()

    await signIn(guest, guestEmail)
    await guest.goto(`/competitions/${comp.id}/invites/${inviteId}`)
    await expect(guest.getByText('This invite was cancelled')).toBeVisible()

    await row.getByRole('button', { name: 'Send again' }).click()
    await expect(guest.getByRole('button', { name: 'Accept' })).toBeVisible()
    // The server resets the invite as it re-sends it; the email takes longer than that.
    await guest.waitForTimeout(3000)
    await guest.getByRole('button', { name: 'Accept' }).click()
    await expect(guest.getByText(`You can manage ${comp.name}`)).toBeVisible()
  } finally {
    await guest.context().close()
    await Promise.all([removeCompetition(comp.id), dbRemove(`users:permissions/${orgId}`), dbRemove(`users:permissions/${guestId}`)])
  }
})

test('an invite only works once', async ({ page, browser }) => {
  const comp = await seedCompetition({ dancersPerGroup: 1 })
  const orgEmail = `${uid('org')}@example.test`
  const orgId = await ensureUser(orgEmail)
  await grantCompetition(orgId, comp.id)
  const firstEmail = `${uid('first')}@example.test`
  const secondEmail = `${uid('second')}@example.test`
  const firstId = await ensureUser(firstEmail)
  const secondId = await ensureUser(secondEmail)
  const second = await newPage(browser)
  try {
    await signIn(page, orgEmail)
    const inviteId = await invite(page, comp.id, firstEmail)

    // The old app's accept: an update on the invite as the invitee (REST, with their token).
    const token = (email: string) =>
      fetch(`http://127.0.0.1:${9099 + OFFSET}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: 'password', returnSecureToken: true }),
      }).then(async (r) => ((await r.json()) as { idToken: string }).idToken)
    const accept = async (email: string) =>
      fetch(`http://127.0.0.1:${9009 + OFFSET}/development/competitions:data/${comp.id}/invites/${inviteId}.json?ns=scotdance&auth=${await token(email)}`, {
        method: 'PATCH',
        body: JSON.stringify({ accepted: new Date().toISOString() }),
      })
    expect((await accept(firstEmail)).ok).toBe(true)
    await expect.poll(() => dbGet(`users:permissions/${firstId}/competitions/${comp.id}`)).toBe(true)
    // Nobody else can take it over.
    expect((await accept(secondEmail)).ok).toBe(false)

    await signIn(second, secondEmail)
    await second.goto(`/competitions/${comp.id}/invites/${inviteId}`)
    await expect(second.getByText('This invite was already used')).toBeVisible()
    expect(await dbGet(`users:permissions/${secondId}`)).toBeNull()
  } finally {
    await second.context().close()
    await Promise.all([
      removeCompetition(comp.id),
      dbRemove(`users:permissions/${orgId}`),
      dbRemove(`users:permissions/${firstId}`),
      dbRemove(`users:permissions/${secondId}`),
    ])
  }
})

test('a submitted competition, once approved, is the organiser’s to manage', async ({ page, browser }) => {
  const orgEmail = `${uid('org')}@example.test`
  const orgId = await ensureUser(orgEmail)
  const sysEmail = `${uid('sys')}@example.test`
  const sysId = await ensureUser(sysEmail)
  await grantSystemAdmin(sysId)
  const name = `E2E Submitted ${uid('s').slice(-6)}`
  const admin = await newPage(browser)
  let submissionId: string | undefined
  let competitionId: string | undefined
  try {
    // Signed in first, then a step at a time (submit.spec.ts covers the steps).
    await page.goto('/competitions/submit')
    await page.getByRole('button', { name: 'Sign in to submit' }).click()
    await signInOnSheet(page, orgEmail)
    const next = () => page.getByRole('button', { name: 'Next', exact: true }).click()
    await page.getByRole('textbox', { name: 'Name (required)', exact: true }).fill(name)
    await page.locator('input[type=date]').fill('2027-03-14')
    await next()
    await expect(page.getByRole('heading', { name: /^Step 2 of 4/ })).toBeVisible()
    await page.getByRole('textbox', { name: 'Town or city (required)' }).fill('Calgary, AB')
    await next()
    await page.getByRole('textbox', { name: 'Your name (required)' }).fill('Morag Test')
    await next()
    await page.getByRole('checkbox', { name: /run by a volunteer/ }).check()
    await page.getByRole('button', { name: 'Submit', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Submitted' })).toBeVisible()

    type Submission = { competition?: { name?: string }; submittedBy?: string; competitionId?: string }
    const mine = async () => Object.entries((await dbGet<Record<string, Submission>>('competitions:submissions')) ?? {}).filter(([, s]) => s.competition?.name === name)
    await expect.poll(async () => (await mine()).map(([, s]) => s.submittedBy)).toEqual([orgId])
    submissionId = (await mine())[0][0]

    await signIn(admin, sysEmail)
    await admin.goto(`/admin/submissions/${submissionId}`)
    await admin.getByRole('button', { name: 'Approve' }).click()
    await admin.locator('dialog[open]').getByRole('button', { name: 'Approve' }).click()
    await expect(admin.getByRole('link', { name: 'Manage it' })).toBeVisible()
    competitionId = (await dbGet<Submission>(`competitions:submissions/${submissionId}`)).competitionId

    await page.goto('/manage')
    await page.getByRole('main').getByRole('link', { name: new RegExp(name) }).click()
    await expect(page.getByRole('heading', { name })).toBeVisible()
    await expect(page.getByText('Private: only admins can see this competition.')).toBeVisible()
  } finally {
    await admin.context().close()
    if (competitionId) await removeCompetition(competitionId)
    if (submissionId) await dbRemove(`competitions:submissions/${submissionId}`)
    await Promise.all([dbRemove(`users:permissions/${orgId}`), dbRemove(`users:permissions/${sysId}`)])
  }
})
