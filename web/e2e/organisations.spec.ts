import { expect, test } from '@playwright/test'
import { as, account, callFunction } from './support/backend'
import { dbGet, dbRemove, dbSet, dbUpdate, signIn, uid } from './support/emulator'
import { removeCompetition, seedCompetition } from './support/seed'

// Organisations (ADR 0005): who may change one or list a competition under
// it, starting one through the server, a submission that asks for them, and
// the pages people see.

test.skip(({ isMobile }) => isMobile, 'rules and server flows: one layout is enough')
test.describe.configure({ mode: 'serial' })

const comp = uid('org-comp')
const other = uid('org-other')
const theirs = uid('org-theirs')
const mine = uid('org-mine')
let organiser: Awaited<ReturnType<typeof account>>
let orgAdmin: Awaited<ReturnType<typeof account>>
let stranger: Awaited<ReturnType<typeof account>>
const made: string[] = []
const orgAdminEmail = `${uid('orgadmin')}@example.test`

test.beforeAll(async () => {
  organiser = await account(`${uid('organiser')}@example.test`)
  orgAdmin = await account(orgAdminEmail)
  stranger = await account(`${uid('stranger')}@example.test`)
  for (const id of [comp, other]) await dbSet(`competitions/${id}`, { name: `Competition ${id}`, date: '2026-11-07', listed: true, published: false })
  await dbSet(`users:permissions/${organiser.uid}/competitions/${comp}`, true)
  await dbSet(`organisations/${theirs}`, { name: `Their Association ${theirs}` })
  await dbSet(`organisations/${mine}`, { name: `My Series ${mine}`, shortName: 'MS' })
  await dbSet(`users:permissions/${orgAdmin.uid}/organisations/${mine}`, true)
  await dbSet(`organisations:permissions/${mine}/users/${orgAdmin.uid}`, true)
})

test.afterAll(async () => {
  for (const id of [comp, other]) await dbRemove(`competitions/${id}`)
  for (const id of [theirs, mine, ...made]) await dbRemove(`organisations/${id}`)
  for (const a of [organiser, orgAdmin, stranger]) await dbRemove(`users:permissions/${a.uid}`)
})

test('anyone reads organisations; only their admins change them, and nobody makes one directly', async () => {
  expect((await as(null, 'GET', `organisations/${mine}/name`)).data).toBe(`My Series ${mine}`)
  expect((await as(orgAdmin, 'PATCH', `organisations/${mine}`, { description: 'Five competitions, one champion.' })).ok).toBe(true)
  expect((await as(orgAdmin, 'PATCH', `organisations/${theirs}`, { description: 'Not mine' })).ok).toBe(false)
  expect((await as(stranger, 'PATCH', `organisations/${mine}`, { description: 'Nope' })).ok).toBe(false)
  // Making or deleting one is for the server.
  expect((await as(orgAdmin, 'PUT', `organisations/${uid('new')}`, { name: 'Homemade' })).ok).toBe(false)
  expect((await as(orgAdmin, 'DELETE', `organisations/${mine}`)).ok).toBe(false)
  // A name it must keep.
  expect((await as(orgAdmin, 'PATCH', `organisations/${mine}`, { name: '' })).ok).toBe(false)
})

test('a competition’s admins add their own organisations; an organisation’s admins add any competition', async () => {
  // The organiser runs `comp` but no organisation: they can't claim one.
  expect((await as(organiser, 'PUT', `competitions/${comp}/organisations/${theirs}`, true)).ok).toBe(false)
  // The organisation's admin can list any competition under theirs (a series), and take it off.
  expect((await as(orgAdmin, 'PUT', `competitions/${other}/organisations/${mine}`, true)).ok).toBe(true)
  expect((await as(orgAdmin, 'PUT', `competitions/${other}/organisations/${theirs}`, true)).ok).toBe(false)
  expect((await as(orgAdmin, 'DELETE', `competitions/${other}/organisations/${mine}`)).ok).toBe(true)
  // A competition's admins can take off any organisation that's on theirs.
  await dbSet(`competitions/${comp}/organisations/${theirs}`, true)
  expect((await as(organiser, 'DELETE', `competitions/${comp}/organisations/${theirs}`)).ok).toBe(true)
  // Only organisations that exist.
  expect((await as(orgAdmin, 'PUT', `competitions/${other}/organisations/${uid('ghost')}`, true)).ok).toBe(false)
})

test('starting one through the server makes you its admin, and can add it to your competition', async () => {
  expect((await callFunction('createOrganisation', { name: 'Nobody’s Club' }, stranger)).error?.status).toBe('PERMISSION_DENIED')
  const res = await callFunction<{ organisationId: string }>('createOrganisation', { name: '  Foothills Dance Society  ', shortName: 'FDS', competitionId: comp }, organiser)
  const id = res.result!.organisationId
  made.push(id)
  expect(await dbGet(`organisations/${id}/name`)).toBe('Foothills Dance Society')
  expect(await dbGet(`users:permissions/${organiser.uid}/organisations/${id}`)).toBe(true)
  expect(await dbGet(`organisations:permissions/${id}/users/${organiser.uid}`)).toBe(true)
  expect(await dbGet(`competitions/${comp}/organisations/${id}`)).toBe(true)
  // Now theirs, they can add it to (and take it off) their competition themselves.
  expect((await as(organiser, 'DELETE', `competitions/${comp}/organisations/${id}`)).ok).toBe(true)
  expect((await as(organiser, 'PUT', `competitions/${comp}/organisations/${id}`, true)).ok).toBe(true)
})

test('an approved submission lists the competition under the organisations it asked for, starting new ones', async () => {
  const sub = uid('org-sub')
  expect(
    (
      await as(organiser, 'PUT', `competitions:submissions/${sub}`, {
        competition: { name: `Submitted ${sub}`, date: '2027-04-17', location: 'Calgary, AB' },
        contact: { name: 'Fiona', email: 'fiona@example.test', disclaimer: true },
        organisations: { [mine]: true },
        newOrganisations: { n1: { name: `Brand New Society ${sub}`, shortName: 'BNS' } },
        submitted: new Date().toISOString(),
      })
    ).ok,
  ).toBe(true)
  await expect.poll(() => dbGet(`competitions:submissions/${sub}/submittedBy`)).toBe(organiser.uid)
  await dbUpdate(`competitions:submissions/${sub}`, { approved: new Date().toISOString() })
  let competitionId = ''
  await expect.poll(async () => (competitionId = (await dbGet<string>(`competitions:submissions/${sub}/competitionId`)) ?? ''), { timeout: 20_000 }).not.toBe('')
  await expect.poll(async () => Object.keys((await dbGet<Record<string, true>>(`competitions/${competitionId}/organisations`)) ?? {}).length, { timeout: 20_000 }).toBe(2)
  const linked = Object.keys((await dbGet<Record<string, true>>(`competitions/${competitionId}/organisations`)) ?? {})
  expect(linked).toContain(mine)
  const fresh = linked.find((id) => id !== mine)!
  made.push(fresh)
  expect(await dbGet(`organisations/${fresh}/name`)).toBe(`Brand New Society ${sub}`)
  expect(await dbGet(`users:permissions/${organiser.uid}/organisations/${fresh}`)).toBe(true)
  await removeCompetition(competitionId)
  await dbRemove(`competitions:submissions/${sub}`)
})

test('the organisation’s page lists its competitions, a competition names its organisations, and Search finds it', async ({ page }) => {
  const seeded = await seedCompetition({ startOffset: 14, dancersPerGroup: 1, resultsForGroups: 0 })
  try {
    await dbSet(`competitions/${seeded.id}/organisations/${mine}`, true)
    await page.goto(`/organisations/${mine}`)
    await expect(page.getByRole('heading', { level: 1, name: `My Series ${mine}` })).toBeVisible()
    await expect(page.getByRole('link', { name: new RegExp(seeded.name) })).toBeVisible()
    await page.getByRole('link', { name: new RegExp(seeded.name) }).click()
    await expect(page).toHaveURL(new RegExp(`/competitions/${seeded.id}/info$`))
    await page.getByRole('link', { name: new RegExp(`My Series ${mine}`) }).click()
    await expect(page).toHaveURL(new RegExp(`/organisations/${mine}/info$`))
    // Search finds it too, by name.
    await page.goto(`/search?q=${encodeURIComponent(`My Series ${mine}`)}`)
    await page.getByRole('link', { name: new RegExp(`My Series ${mine}`) }).click()
    await expect(page).toHaveURL(new RegExp(`/organisations/${mine}/info$`))
  } finally {
    await removeCompetition(seeded.id)
  }
})

test('an invited helper accepts and can change the organisation’s page, until removed', async ({ page, browser }) => {
  const email = `${uid('orgguest')}@example.test`
  const guestAccount = await account(email)
  const guest = await (await browser.newContext()).newPage()
  try {
    await signIn(page, orgAdminEmail)
    await page.goto(`/organisations/${mine}/manage`)
    await page.getByRole('textbox', { name: 'Invite someone' }).fill(email)
    await page.getByRole('button', { name: 'Send invite' }).click()
    await expect(page.getByText(`Invite sent to ${email}`)).toBeVisible()
    let inviteId = ''
    await expect
      .poll(async () => {
        const all = (await dbGet<Record<string, { payload?: { email?: string }; createdBy?: string }>>(`organisations:data/${mine}/invites`)) ?? {}
        inviteId = Object.entries(all).find(([, i]) => i.payload?.email === email && i.createdBy)?.[0] ?? ''
        return inviteId
      })
      .not.toBe('')

    await signIn(guest, email)
    await guest.goto(`/organisations/${mine}/invites/${inviteId}`)
    await expect(guest.getByText(`Help manage My Series ${mine}`)).toBeVisible()
    await guest.getByRole('button', { name: 'Accept' }).click()
    await expect(guest.getByText(`You can manage My Series ${mine}`)).toBeVisible()
    await expect.poll(() => dbGet(`users:permissions/${guestAccount.uid}/organisations/${mine}`)).toBe(true)
    expect((await as(guestAccount, 'PATCH', `organisations/${mine}`, { location: 'Calgary, AB' })).ok).toBe(true)

    await page.getByRole('listitem').filter({ hasText: email }).getByRole('button', { name: 'Remove' }).click()
    await page.locator('dialog[open]').getByRole('button', { name: 'Remove' }).click()
    await expect.poll(() => dbGet(`users:permissions/${guestAccount.uid}/organisations/${mine}`)).toBeNull()
    expect((await as(guestAccount, 'PATCH', `organisations/${mine}`, { location: 'Banff, AB' })).ok).toBe(false)
  } finally {
    await guest.context().close()
    await dbRemove(`users:permissions/${guestAccount.uid}`)
  }
})

test('System admin tags a family of competitions in one go, and Undo takes it back', async ({ page }) => {
  // Letters only, so the name stays the family's name.
  const family = `Tagging Games ${Math.random().toString(36).replace(/[^a-z]/g, '').slice(0, 5)}`
  const years = [uid('fam-a'), uid('fam-b')]
  await dbSet(`competitions/${years[0]}`, { name: `${family} 2025`, date: '2025-06-01', listed: true })
  await dbSet(`competitions/${years[1]}`, { name: `The 12th Annual ${family}`, date: '2026-06-06', listed: true })
  const email = `${uid('tagger')}@example.test`
  const tagger = await account(email)
  await dbSet(`users:permissions/${tagger.uid}/admin`, true)
  try {
    await signIn(page, email)
    await page.goto('/admin/organisations?view=tag')
    await page.getByText('Every year', { exact: true }).click()
    await page.getByRole('searchbox', { name: 'Find a competition' }).fill(family)
    // Two years under two spellings, one family.
    await page.getByRole('button', { name: `Choose ${family}` }).click()
    await expect(page.getByRole('toolbar', { name: 'Chosen competitions' })).toContainText('2 competitions')
    await page.getByRole('button', { name: 'Add to…' }).click()
    await page.locator('dialog[open]').getByRole('button', { name: new RegExp(`My Series ${mine}`) }).click()
    await expect(page.getByText('Added MS to 2 competitions')).toBeVisible()
    for (const id of years) await expect.poll(() => dbGet(`competitions/${id}/organisations/${mine}`)).toBe(true)
    await page.getByRole('button', { name: 'Undo' }).click()
    for (const id of years) await expect.poll(() => dbGet(`competitions/${id}/organisations/${mine}`)).toBeNull()
  } finally {
    for (const id of years) await dbRemove(`competitions/${id}`)
    await dbRemove(`users:permissions/${tagger.uid}`)
  }
})

test('System admin starts an organisation a competition’s name points to, and it’s added to every one that names it', async ({ page }) => {
  // A made-up abbreviation, so nothing else here names it.
  const abbr = `Z${Math.random().toString(36).replace(/[^a-z]/g, '').slice(0, 3).toUpperCase()}HDA`
  const ids = [uid('abbr-a'), uid('abbr-b')]
  await dbSet(`competitions/${ids[0]}`, { name: `${abbr} Spring Competition 2025`, date: '2025-04-05', location: 'Red Deer, AB', listed: true })
  await dbSet(`competitions/${ids[1]}`, { name: `${abbr} Fall Classic`, date: '2026-10-17', location: 'Red Deer, AB', listed: true })
  const email = `${uid('starter')}@example.test`
  const starter = await account(email)
  await dbSet(`users:permissions/${starter.uid}/admin`, true)
  let organisationId = ''
  try {
    await signIn(page, email)
    await page.goto('/admin/organisations?view=tag')
    const names = page.getByRole('region', { name: 'In competitions’ names' })
    const row = names.getByRole('listitem').filter({ hasText: abbr })
    // Only the first few show until Show all.
    await expect(names.getByRole('listitem').first()).toBeVisible()
    if (!(await row.count()) && (await names.getByRole('button', { name: /^Show all/ }).count())) {
      await names.getByRole('button', { name: /^Show all/ }).click()
    }
    await expect(row).toContainText('2 competitions · Red Deer, AB')
    await row.getByRole('button', { name: 'Start' }).click()
    const sheet = page.locator('dialog[open]')
    await expect(sheet.getByRole('textbox', { name: /^Name/ })).toHaveValue(abbr)
    await expect(sheet.getByRole('textbox', { name: 'Based in' })).toHaveValue('Red Deer, AB')
    await sheet.getByRole('textbox', { name: /^Name/ }).fill(`${abbr} Highland Dancing Association`)
    await sheet.getByRole('button', { name: 'Start and add to 2 competitions' }).click()
    await expect(page.getByText(`Added ${abbr} to 2 competitions`)).toBeVisible()
    await expect
      .poll(async () => {
        const orgs = (await dbGet<Record<string, { shortName?: string; location?: string; name?: string }>>('organisations')) ?? {}
        organisationId = Object.entries(orgs).find(([, o]) => o.shortName === abbr)?.[0] ?? ''
        return organisationId && orgs[organisationId]
      })
      .toMatchObject({ name: `${abbr} Highland Dancing Association`, location: 'Red Deer, AB' })
    for (const id of ids) await expect.poll(() => dbGet(`competitions/${id}/organisations/${organisationId}`)).toBe(true)
    // Not suggested any more: it's here now.
    await expect(names.getByRole('listitem').filter({ hasText: abbr })).toHaveCount(0)
  } finally {
    for (const id of ids) await dbRemove(`competitions/${id}`)
    if (organisationId) await dbRemove(`organisations/${organisationId}`)
    await dbRemove(`users:permissions/${starter.uid}`)
  }
})
