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

test('Submissions: select several to reject (and undo), approve or delete together', async ({ page }) => {
  test.setTimeout(150_000)
  const sys = await systemAdmin()
  const tag = uid('bulk').slice(-5)
  const ids: Record<'a' | 'b' | 'c' | 'r', string> = { a: uid('sub'), b: uid('sub'), c: uid('sub'), r: uid('sub') }
  const name = (k: string) => `E2E Bulk ${k.toUpperCase()} ${tag}`
  const sub = (k: string, extra: Record<string, unknown> = {}) => ({
    competition: { name: name(k), date: '2027-06-05', location: 'Calgary' },
    contact: { name: `Morag ${k.toUpperCase()}`, email: `${k}@example.test` },
    submitted: new Date().toISOString(),
    ...extra,
  })
  await Promise.all([
    dbSet(`competitions:submissions/${ids.a}`, sub('a')),
    dbSet(`competitions:submissions/${ids.b}`, sub('b')),
    // On the map already: nothing to flag.
    dbSet(`competitions:submissions/${ids.c}`, sub('c', { competition: { name: name('c'), date: '2027-06-05', location: 'Calgary', lat: 51, lng: -114 } })),
    dbSet(`competitions:submissions/${ids.r}`, sub('r', { rejected: new Date().toISOString(), rejection: { reason: 'spam' } })),
  ])
  const SERVER = { timeout: 60_000 }
  const competitionIds: string[] = []
  try {
    await signIn(page, sys.email)
    await page.goto('/admin/submissions')
    // While selecting, rows tick instead of opening.
    const row = (k: string) => page.getByRole('checkbox', { name: new RegExp(name(k)) })
    const sheet = page.locator('dialog[open]')
    const select = () => page.getByRole('button', { name: 'Select', exact: true }).click()

    // Reject two quietly, then take it back.
    await select()
    await expect(page.getByText('Choose the ones to approve, reject or delete.')).toBeVisible()
    await row('a').click()
    await row('b').click()
    await expect(page.getByText('2 selected')).toBeVisible()
    await page.getByRole('button', { name: 'Reject 2' }).click()
    await expect(sheet.getByRole('heading', { name: 'Reject 2 submissions?' })).toBeVisible()
    await sheet.getByRole('button', { name: 'Already submitted' }).click()
    await expect(sheet.getByText('They’ll each get this by email, in a note of their own.')).toBeVisible()
    await sheet.getByRole('button', { name: 'Test or spam' }).click()
    await sheet.getByRole('button', { name: 'Reject', exact: true }).click()
    await expect(page.getByText('Rejected 2. No one was told.')).toBeVisible()
    for (const k of ['a', 'b'] as const) expect(await dbGet(`competitions:submissions/${ids[k]}/rejection`)).toEqual({ reason: 'spam' })
    await page.getByRole('button', { name: 'Undo' }).click()
    for (const k of ['a', 'b'] as const) await expect.poll(() => dbGet(`competitions:submissions/${ids[k]}/rejected`)).toBeNull()

    // The bar offers what fits what's picked: waiting ones approve or reject; rejected ones delete.
    await select()
    await page.getByRole('button', { name: /^Rejected/ }).click()
    await row('b').click()
    await row('r').click()
    for (const label of ['Approve 1', 'Reject 1', 'Delete 1']) await expect(page.getByRole('button', { name: label })).toBeVisible()
    await row('b').click()
    await expect(page.getByRole('button', { name: 'Approve 1' })).toHaveCount(0)
    await page.getByRole('button', { name: 'Delete 1' }).click()
    await sheet.getByRole('button', { name: 'Delete' }).click()
    await expect(page.getByText('Deleted.', { exact: true })).toBeVisible()
    expect(await dbGet(`competitions:submissions/${ids.r}`)).toBeNull()

    // Approve two: listed first, flagging the one that isn't on the map yet.
    await select()
    await row('a').click()
    await row('c').click()
    await page.getByRole('button', { name: 'Approve 2' }).click()
    await expect(sheet.getByRole('heading', { name: 'Approve 2 competitions?' })).toBeVisible()
    // (By its name alone: another's flags can name it, as already submitted that day.)
    const item = (k: string) => sheet.getByRole('listitem').filter({ has: page.getByText(name(k), { exact: true }) })
    await expect(item('a')).toContainText('Not on the map yet')
    await expect(item('c')).not.toContainText('Not on the map yet')
    await sheet.getByRole('button', { name: 'Approve 2' }).click()
    await expect(page.getByText('Approved 2. The competitions are being created.')).toBeVisible()
    for (const k of ['a', 'c'] as const) {
      await expect.poll(() => dbGet(`competitions:submissions/${ids[k]}/competitionId`), SERVER).toBeTruthy()
      competitionIds.push(await dbGet<string>(`competitions:submissions/${ids[k]}/competitionId`))
    }
    expect(await dbGet(`competitions:submissions/${ids.b}/approved`)).toBeNull()
  } finally {
    await Promise.all(competitionIds.map((cid) => removeCompetition(cid)))
    await Promise.all([...Object.values(ids).map((sid) => dbRemove(`competitions:submissions/${sid}`)), dbRemove(`users:permissions/${sys.id}`)])
  }
})

test('Submissions: one with nothing to look at is approved as it arrives; one that waits says why', async ({ page }) => {
  test.setTimeout(150_000)
  const sys = await systemAdmin()
  // (Capitals and digits: a lowercase word in the name would need a look.)
  const tag = uid('auto').slice(-5).toUpperCase()
  // A day of their own, so nothing else here looks like the same competition.
  const date = new Date(Date.now() + (200 + Math.floor(Math.random() * 100)) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const tidy = { id: uid('sub'), name: `Cowal Highland Games ${tag}` }
  const messy = { id: uid('sub'), name: `SPRING FLING ${tag}` }
  const contact = { name: 'Morag Fraser', email: 'morag@example.test' }
  await Promise.all([
    dbSet(`competitions:submissions/${tidy.id}`, { competition: { name: tidy.name, date, location: 'Dunoon' }, contact, submitted: new Date().toISOString() }),
    dbSet(`competitions:submissions/${messy.id}`, { competition: { name: messy.name, date }, contact, submitted: new Date().toISOString() }),
  ])
  const SERVER = { timeout: 60_000 }
  let competitionId: string | null = null
  try {
    await expect.poll(() => dbGet(`competitions:submissions/${tidy.id}/competitionId`), SERVER).toBeTruthy()
    competitionId = await dbGet<string>(`competitions:submissions/${tidy.id}/competitionId`)
    const submitter = await dbGet<string>(`competitions:submissions/${tidy.id}/submittedBy`)
    expect(await dbGet(`competitions:submissions/${tidy.id}`)).toMatchObject({ autoApproved: true, approvedBy: 'auto' })
    expect(await dbGet(`competitions/${competitionId}/name`)).toBe(tidy.name)
    await expect.poll(() => dbGet(`competitions:submissions/${messy.id}/review`), SERVER).toEqual(['The name is in capitals', 'There’s no town or city'])
    expect(await dbGet(`competitions:submissions/${messy.id}/approved`)).toBeNull()

    await signIn(page, sys.email)

    // The one that waits says why, and what's left once it's tidied (the server checks it again).
    await page.goto(`/admin/submissions/${messy.id}`)
    const look = page.getByRole('region', { name: 'Needs a look' })
    await expect(look.getByRole('listitem')).toHaveText(['The name is in capitals', 'There’s no town or city'])
    const field = page.getByRole('textbox', { name: 'Name', exact: true })
    await field.fill(`Spring Fling ${tag}`)
    await field.press('Enter')
    await expect(look.getByRole('listitem')).toHaveText(['There’s no town or city'], SERVER)
    expect(await dbGet(`competitions:submissions/${messy.id}/approved`)).toBeNull()

    // The one approved as it arrived says so (anything to fix is fixed in Manage).
    await page.goto(`/admin/submissions/${tidy.id}`)
    await expect(page.getByText('Approved automatically today.', { exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Manage it' })).toBeVisible()
    await expect(page.getByRole('link', { name: `${tidy.name} ${contact.name} · approved automatically today`, exact: true })).toBeVisible()
    // Its organiser can manage it.
    expect(await dbGet(`users:permissions/${submitter}/competitions/${competitionId}`)).toBe(true)
  } finally {
    if (competitionId) await removeCompetition(competitionId)
    await Promise.all([dbRemove(`competitions:submissions/${tidy.id}`), dbRemove(`competitions:submissions/${messy.id}`), dbRemove(`users:permissions/${sys.id}`)])
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
