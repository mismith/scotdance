import { expect, test } from '@playwright/test'
import { dbGet, dbRemove, dbSet, ensureUser, grantSystemAdmin, signIn, uid } from './support/emulator'
import { removeCompetition, seedCompetition } from './support/seed'

// System admin: Users (find someone, give and take away access), the
// submissions inbox, and the maintenance tools.

test.skip(({ isMobile }) => isMobile, 'one layout is enough here')

async function systemAdmin() {
  const email = `${uid('sys')}@example.test`
  const id = await ensureUser(email)
  await grantSystemAdmin(id)
  return { email, id }
}

test('Users: find someone by email, let them manage a competition, then stop', async ({ page }) => {
  const comp = await seedCompetition({ dancersPerGroup: 1 })
  const sys = await systemAdmin()
  const email = `${uid('person')}@example.test`
  const person = await ensureUser(email)
  // The record Users lists (as v3 wrote on sign-up).
  await dbSet(`users/${person}`, { email, displayName: 'Morag Ross' })
  try {
    await signIn(page, sys.email)
    await page.goto('/admin/users')
    await page.getByRole('searchbox', { name: 'Search users' }).fill(email.slice(0, 18))
    await page.getByRole('link', { name: /Morag Ross/ }).click()
    await expect(page).toHaveURL(new RegExp(`/admin/users/${person}$`))
    await expect(page.getByText('Competitions they manage')).toBeVisible()

    await page.getByRole('button', { name: 'Add a competition' }).click()
    await page.locator('dialog[open]').getByRole('searchbox', { name: 'Find a competition' }).fill(comp.name)
    await page.locator('dialog[open]').getByRole('button', { name: new RegExp(comp.name) }).click()
    await expect(page.getByText(`Can now manage ${comp.name}`)).toBeVisible()
    expect(await dbGet(`users:permissions/${person}/competitions/${comp.id}`)).toBe(true)
    expect(await dbGet(`competitions:permissions/${comp.id}/users/${person}`)).toBe(true)

    await page.getByRole('listitem').filter({ hasText: comp.name }).getByRole('button', { name: 'Remove' }).click()
    await expect(page.getByText(`No longer manages ${comp.name}`)).toBeVisible()
    expect(await dbGet(`users:permissions/${person}`)).toBeNull()
    expect(await dbGet(`competitions:permissions/${comp.id}/users/${person}`)).toBeNull()

    // Renaming shows straight away in the list, which is only read once.
    const name = page.getByRole('textbox', { name: 'Name' })
    await name.fill('Morag Ross-Fraser')
    await name.press('Enter')
    await expect(page.getByRole('link', { name: /Morag Ross-Fraser/ })).toBeVisible()
  } finally {
    await Promise.all([removeCompetition(comp.id), dbRemove(`users/${person}`), dbRemove(`users:permissions/${person}`), dbRemove(`users:permissions/${sys.id}`)])
  }
})

test('Submissions: tidy one up, reject it quietly (and undo that), then delete it', async ({ page }) => {
  const sys = await systemAdmin()
  const id = uid('sub')
  const name = `E2E Submission ${id.slice(-5)}`
  await dbSet(`competitions:submissions/${id}`, {
    competition: { name, date: '2027-06-05', location: 'Calgary' },
    contact: { name: 'Morag Test', email: 'morag@example.test', message: 'First one!' },
    submitted: new Date().toISOString(),
  })
  try {
    await signIn(page, sys.email)
    await page.goto(`/admin/submissions/${id}`)
    await expect(page.getByRole('heading', { name })).toBeVisible()
    await expect(page.getByText('First one!')).toBeVisible()

    const location = page.getByRole('textbox', { name: 'Town or city' })
    await location.fill('Calgary, AB')
    await location.press('Enter')
    await expect.poll(() => dbGet(`competitions:submissions/${id}/competition/location`)).toBe('Calgary, AB')

    // Waiting, it's Approve or Reject. As spam, there's no reply to write.
    await expect(page.getByRole('button', { name: 'Delete' })).toHaveCount(0)
    await page.getByRole('button', { name: 'Reject', exact: true }).click()
    const sheet = page.locator('dialog[open]')
    await expect(sheet.getByRole('heading', { name: `Reject ${name}?` })).toBeVisible()
    await sheet.getByRole('button', { name: 'Test or spam' }).click()
    await expect(sheet.getByRole('textbox', { name: /^Reply/ })).toBeDisabled()
    await expect(sheet.getByText('Spam never gets a reply: one would confirm the address works.')).toBeVisible()
    await sheet.getByRole('button', { name: 'Reject', exact: true }).click()
    await expect(page.getByText('Rejected. No one was told.')).toBeVisible()
    await expect(page.getByText('Rejected today: test or spam. No one was told.', { exact: true })).toBeVisible()
    expect(await dbGet(`competitions:submissions/${id}/rejection`)).toEqual({ reason: 'spam' })
    expect(await dbGet(`competitions:submissions/${id}/rejectedBy`)).toBe(sys.id)
    const fold = page.getByRole('button', { name: /^Rejected/ })
    await expect(fold).toHaveAttribute('aria-expanded', 'true')
    await expect(page.getByRole('link', { name: `${name} Morag Test · rejected today`, exact: true })).toBeVisible()

    // Nothing went out, so it can be taken back.
    await page.getByRole('button', { name: 'Undo' }).click()
    await expect(page.getByRole('button', { name: 'Reject', exact: true })).toBeVisible()
    expect(await dbGet(`competitions:submissions/${id}/rejected`)).toBeNull()
    expect(await dbGet(`competitions:submissions/${id}/rejection`)).toBeNull()

    // Rejected (with no reason or reply this time), it can be deleted.
    await page.getByRole('button', { name: 'Reject', exact: true }).click()
    await sheet.getByRole('button', { name: 'Reject', exact: true }).click()
    await expect(page.getByText('Rejected today. No one was told.', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Delete' }).click()
    await page.locator('dialog[open]').getByRole('button', { name: 'Delete' }).click()
    // Beside the others it says so; if it was the only one, the inbox is empty.
    await expect(page.getByText(/^(This submission isn’t here any more|No submissions)$/)).toBeVisible()
    expect(await dbGet(`competitions:submissions/${id}`)).toBeNull()
  } finally {
    await Promise.all([dbRemove(`competitions:submissions/${id}`), dbRemove(`users:permissions/${sys.id}`)])
  }
})

test('Submissions: reject with a reply, send it again when it doesn’t go out, then approve it after all', async ({ page }) => {
  test.setTimeout(150_000)
  const sys = await systemAdmin()
  // The reply is signed with their first name.
  await dbSet(`users/${sys.id}`, { email: sys.email, displayName: 'Murray Test' })
  const id = uid('sub')
  const name = `E2E Reply ${id.slice(-5)}`
  await dbSet(`competitions:submissions/${id}`, {
    competition: { name, date: '2027-06-05', venue: 'Dunoon Stadium', location: 'Dunoon' },
    contact: { name: 'Morag Test', email: 'morag@example.test' },
    submitted: new Date().toISOString(),
  })
  const reply = 'Is this the dancing at the Cowal Gathering?\n\nIf it is, I can add you as one of its admins instead.'
  const SERVER = { timeout: 60_000 }
  let competitionId: string | undefined
  try {
    await signIn(page, sys.email)
    await page.goto(`/admin/submissions/${id}`)
    await page.getByRole('button', { name: 'Reject', exact: true }).click()
    const sheet = page.locator('dialog[open]')
    const box = sheet.getByRole('textbox', { name: /^Reply/ })
    await expect(sheet.getByText('Leave it empty and no one is told.')).toBeVisible()

    // A reason starts a reply in your words; a reply is emailed, and the button says so.
    await sheet.getByRole('button', { name: 'Already submitted' }).click()
    await expect(sheet.getByRole('button', { name: 'Already submitted' })).toHaveAttribute('aria-pressed', 'true')
    await expect(box).toHaveValue(/^Someone else has already submitted it\./)
    await expect(sheet.getByText('They’ll get this by email at morag@example.test.')).toBeVisible()
    await expect(sheet.getByRole('button', { name: 'Reject and email' })).toBeVisible()
    // Cleared, it's back to telling no one.
    await sheet.getByRole('button', { name: 'Already submitted' }).click()
    await expect(box).toHaveValue('')
    await expect(sheet.getByRole('button', { name: 'Reject', exact: true })).toBeVisible()

    // Your own words, in the note around them.
    await sheet.getByRole('button', { name: 'Already submitted' }).click()
    await box.fill(reply)
    await sheet.getByText('Preview the email').click()
    for (const line of [`About your submission of ${name}`, 'To morag@example.test', 'Hello Morag Test,', `Thanks for submitting ${name}. I haven’t added it to ScotDance.app.`, 'If it is, I can add you as one of its admins instead.', 'Saturday 5 June 2027', 'Dunoon Stadium, Dunoon', 'Murray']) {
      await expect(sheet).toContainText(line)
    }

    // ⌘Enter rejects from the reply (it only means Approve outside the sheet).
    await box.press('ControlOrMeta+Enter')
    await expect(page.getByText('Rejected. Your reply is on its way to morag@example.test.')).toBeVisible()
    expect(await dbGet(`competitions:submissions/${id}/rejection`)).toEqual({ reason: 'duplicate', reply })
    expect(await dbGet(`competitions:submissions/${id}/approved`)).toBeNull()
    await expect(page.getByText('Rejected today: already submitted.', { exact: true })).toBeVisible()
    const card = page.getByRole('region', { name: 'Your reply' })
    await expect(card).toContainText('If it is, I can add you as one of its admins instead.')

    // Emails can't go out from the emulator: the server says so, and it can be sent again, or by hand.
    await expect(card.getByText('The email didn’t go out. Send it again, or copy it and send it yourself.')).toBeVisible(SERVER)
    const failed = await dbGet<string>(`competitions:submissions/${id}/replyFailed`)
    expect(failed).toBeTruthy()
    await expect(page.getByRole('link', { name: `${name} Morag Test · rejected today The reply didn’t go out`, exact: true })).toBeVisible()
    const rejectedAt = await dbGet<string>(`competitions:submissions/${id}/rejected`)
    await card.getByRole('button', { name: 'Send again' }).click()
    await expect(page.getByText('Sending it again.')).toBeVisible()
    await expect.poll(async () => { const t = await dbGet<string | null>(`competitions:submissions/${id}/replyFailed`); return !!t && t !== failed }, SERVER).toBe(true)
    // (It's still rejected when it was: sending again doesn't change that.)
    expect(await dbGet(`competitions:submissions/${id}/rejected`)).toBe(rejectedAt)
    expect(await dbGet(`competitions:submissions/${id}/rejection/retried`)).toBeTruthy()
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
    await card.getByRole('button', { name: 'Copy reply' }).click()
    await expect(page.getByText('Reply copied. Send it to morag@example.test any way you like.')).toBeVisible()
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(reply)

    // Approved after all (say, once they've answered): it's no longer rejected.
    await page.getByRole('button', { name: 'Approve', exact: true }).click()
    await page.locator('dialog[open]').getByRole('button', { name: 'Approve' }).click()
    await expect(page.getByRole('link', { name: 'Manage it' })).toBeVisible(SERVER)
    competitionId = (await dbGet<{ competitionId?: string }>(`competitions:submissions/${id}`)).competitionId
    expect(await dbGet(`competitions:submissions/${id}/rejected`)).toBeNull()
    await expect(page.getByRole('button', { name: /^Approved/ })).toHaveAttribute('aria-expanded', 'true')
  } finally {
    if (competitionId) await removeCompetition(competitionId)
    await Promise.all([dbRemove(`competitions:submissions/${id}`), dbRemove(`users/${sys.id}`), dbRemove(`users:permissions/${sys.id}`)])
  }
})

test('Tools: rebuilding the published list and search reports back', async ({ page }) => {
  test.setTimeout(120_000)
  const sys = await systemAdmin()
  try {
    await signIn(page, sys.email)
    await page.goto('/admin/tools')
    for (const [label, result] of [
      ['Published and listed competitions lists', /^Done: \d+ published, \d+ listed\.$/],
      ['Competitions search', /^Done: \d+ indexed\.$/],
    ] as const) {
      const row = page.getByRole('listitem').filter({ hasText: label })
      await row.getByRole('button', { name: 'Rebuild' }).click()
      await expect(row.getByText(result)).toBeVisible({ timeout: 90_000 })
    }
    // Dancer search starts from empty (the old apps' search too), so it asks first.
    const dancers = page.getByRole('listitem').filter({ hasText: 'Dancers search' })
    await dancers.getByRole('button', { name: 'Rebuild' }).click()
    const ask = page.getByRole('dialog').filter({ hasText: 'Rebuild dancer search?' })
    await expect(ask).toContainText('empty here and in the old apps')
    await ask.getByRole('button', { name: 'Cancel' }).click()
    await expect(ask).toHaveCount(0)
    await expect(dancers.getByText(/^Done/)).toHaveCount(0)
  } finally {
    await dbRemove(`users:permissions/${sys.id}`)
  }
})

test('Submissions: waiting ones first, approved ones folded away, ⌘Enter to approve', async ({ page }) => {
  const sys = await systemAdmin()
  const [waiting, done] = [uid('sub'), uid('sub')]
  await dbSet(`competitions:submissions/${waiting}`, {
    competition: { name: `E2E Waiting ${waiting.slice(-5)}`, date: '2027-06-05', location: 'Calgary, AB' },
    contact: { name: 'Morag Test', email: 'morag@example.test' },
    submitted: new Date().toISOString(),
  })
  await dbSet(`competitions:submissions/${done}`, {
    competition: { name: `E2E Approved ${done.slice(-5)}`, date: '2027-06-12', location: 'Banff, AB' },
    contact: { name: 'Isla Test', email: 'isla@example.test' },
    submitted: new Date(Date.now() - 86_400_000).toISOString(),
    approved: new Date().toISOString(),
  })
  try {
    await signIn(page, sys.email)
    await page.goto(`/admin/submissions/${waiting}`)
    await expect(page.getByRole('heading', { name: `E2E Waiting ${waiting.slice(-5)}` })).toBeVisible()
    await expect(page.getByRole('link', { name: new RegExp(`E2E Waiting ${waiting.slice(-5)}`) })).toBeVisible()
    const fold = page.getByRole('button', { name: /^Approved/ })
    await expect(fold).toHaveAttribute('aria-expanded', 'false')
    await expect(page.getByRole('link', { name: new RegExp(`E2E Approved ${done.slice(-5)}`) })).toHaveCount(0)
    await fold.click()
    await expect(page.getByRole('link', { name: new RegExp(`E2E Approved ${done.slice(-5)}`) })).toBeVisible()

    // The keyboard asks to approve the open one (Cancel leaves it waiting).
    await page.goto(`/admin/submissions/${waiting}`)
    await expect(page.getByRole('button', { name: 'Approve', exact: true })).toBeVisible()
    await page.keyboard.press('ControlOrMeta+Enter')
    await expect(page.locator('dialog[open]')).toContainText(`Approve E2E Waiting ${waiting.slice(-5)}?`)
    await page.locator('dialog[open]').getByRole('button', { name: 'Cancel' }).click()
    expect(await dbGet(`competitions:submissions/${waiting}/approved`)).toBeNull()
  } finally {
    await Promise.all([dbRemove(`competitions:submissions/${waiting}`), dbRemove(`competitions:submissions/${done}`), dbRemove(`users:permissions/${sys.id}`)])
  }
})
