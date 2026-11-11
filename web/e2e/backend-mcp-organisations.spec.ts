import { expect, test } from '@playwright/test'
import { dbGet, dbRemove, dbSet, ensureUser, grantCompetition, uid } from './support/emulator'
import { callTool, type Json } from './support/mcp'
import { isoDay } from './support/seed'

// The assistants' organisation tools and add_competition (ADR 0018), asked over MCP against the `mcp` function:
// each acts as the person through the database rules, organisations keep a change log of their own that undo_change
// reads, creating an organisation reaches the callable's checks, and a competition is added by submitting it, so the
// submission trigger sees the person as the submitter, approves a tidy one (making them its admin) and holds the rest.

test.skip(({ isMobile }) => isMobile, 'Functions only: no need to run per device')
test.describe.configure({ mode: 'serial' })
// (A submission waits for the trigger in a functions emulator that may be busy: add_competition waits up to 30 s)
test.setTimeout(240_000)

let person = ''
let email = ''
let stranger = ''
let tag = ''
const org = () => `org-${tag}`
const cid = (n: string) => `orgc-${tag}-${n}`
const ask = (name: string, args: Json = {}) => callTool(person, name, args)
const orgLog = () => dbGet<Record<string, Json> | null>(`organisations:changes/${org()}`)

test.beforeAll(async () => {
  tag = uid('t').slice(-8)
  email = `${uid('mcp-org')}@example.test`
  person = await ensureUser(email)
  stranger = await ensureUser(`${uid('mcp-stranger')}@example.test`)
  await dbSet(`users/${person}`, { email, displayName: 'Pat Organiser' })
  await dbSet(`organisations/${org()}`, { name: `Prairie Dance Society ${tag}`, shortName: 'PDS', location: 'Red Deer, AB' })
  await dbSet(`users:permissions/${person}/organisations/${org()}`, true)
  await dbSet(`organisations:permissions/${org()}/users/${person}`, true)
  // One they manage, and one that is someone else's (a series takes in competitions it doesn't run)
  await dbSet(`competitions/${cid('mine')}`, { name: 'Mine Games', date: isoDay(40), location: 'Red Deer, AB' })
  await dbSet(`competitions/${cid('theirs')}`, { name: 'Their Games', date: isoDay(50), location: 'Banff, AB' })
  await grantCompetition(person, cid('mine'))
})

test.afterAll(async () => {
  await dbRemove(`organisations/${org()}`)
  await dbRemove(`organisations:changes/${org()}`)
  await dbRemove(`organisations:permissions/${org()}`)
  await dbRemove(`competitions/${cid('mine')}`)
  await dbRemove(`competitions/${cid('theirs')}`)
  await dbRemove(`competitions:permissions/${cid('mine')}`)
  await dbRemove(`users:permissions/${person}`)
  await dbRemove(`users:permissions/${stranger}`)
  await dbRemove(`users/${person}`)
})

test('get_organisations lists the ones they are an admin of, with their competitions', async () => {
  await dbSet(`competitions/${cid('mine')}/organisations/${org()}`, true)
  const out = await ask('get_organisations')
  expect(out.isError, out.text).toBe(false)
  expect(out.data.organisations.map((o: Json) => o.id)).toEqual([org()])
  expect(out.data.organisations[0].competitions).toEqual([expect.objectContaining({ id: cid('mine'), yours: true })])
  await dbRemove(`competitions/${cid('mine')}/organisations/${org()}`)
})

test('update_organisation edits the page and the competitions it has, through the rules, logs it, and undo puts it back', async () => {
  const before = await dbGet<Json>(`organisations/${org()}`)
  const out = await ask('update_organisation', {
    organisation: `Prairie Dance Society ${tag}`,
    location: 'Calgary, AB',
    website: 'pds.example',
    links: [{ label: 'Rules', url: 'pds.example/rules' }],
    addCompetitions: [cid('mine'), cid('theirs')],
  })
  expect(out.isError, out.text).toBe(false)
  expect(await dbGet(`organisations/${org()}/location`)).toBe('Calgary, AB')
  expect(await dbGet(`competitions/${cid('theirs')}/organisations/${org()}`)).toBe(true)
  expect(await dbGet(`competitions/${cid('mine')}/organisations/${org()}`)).toBe(true)
  const entry = (await orgLog())![out.data.change]
  expect(entry).toMatchObject({ uid: person, tool: 'update_organisation' })
  expect(entry.paths.map((p: Json) => p.path)).toEqual(expect.arrayContaining([`competitions/${cid('theirs')}/organisations/${org()}`, `organisations/${org()}/website`]))
  expect(await dbGet(`competitions:changes/${cid('mine')}`)).toBeNull()

  const listed = await ask('get_changes', { organisation: org() })
  expect(listed.data.changes[0]).toMatchObject({ id: out.data.change, tool: 'update_organisation' })
  // Not logged for a competition: the two logs are apart
  expect((await ask('get_changes', { competition: cid('mine') })).data.changes).toEqual([])

  const taken = await ask('update_organisation', { organisation: org(), removeCompetitions: [cid('theirs')] })
  expect(taken.isError, taken.text).toBe(false)
  expect(await dbGet(`competitions/${cid('theirs')}/organisations/${org()}`)).toBeNull()
  expect((await ask('undo_change', { organisation: org(), change: taken.data.change })).isError).toBe(false)
  expect(await dbGet(`competitions/${cid('theirs')}/organisations/${org()}`)).toBe(true)

  const undone = await ask('undo_change', { organisation: org(), change: out.data.change })
  expect(undone.isError, undone.text).toBe(false)
  expect(await dbGet<Json>(`organisations/${org()}`)).toEqual(before)
  expect(await dbGet(`competitions/${cid('theirs')}/organisations/${org()}`)).toBeNull()
  expect((await orgLog())![out.data.change].undone).toMatchObject({ by: person })
})

test('someone who is not an admin of the organisation can do nothing to it, and the log is not theirs to read', async () => {
  const out = await callTool(stranger, 'update_organisation', { organisation: org(), name: 'Mine now' })
  expect(out.isError).toBe(true)
  expect(out.text).toMatch(/aren’t an admin of any organisation/)
  expect((await callTool(stranger, 'get_changes', { organisation: org() })).isError).toBe(true)
  expect((await dbGet<Json>(`organisations/${org()}`)).name).toBe(`Prairie Dance Society ${tag}`)
})

test('create_organisation: the callable’s checks, the person its admin, the full name unique, no system admin powers', async () => {
  const name = `Peace Valley Games ${tag}`
  const out = await ask('create_organisation', { name, shortName: 'PVG', competition: cid('mine') })
  expect(out.isError, out.text).toBe(false)
  const created = out.data.created[0].id
  expect(await dbGet(`organisations/${created}`)).toMatchObject({ name, shortName: 'PVG', createdBy: person })
  expect(await dbGet(`users:permissions/${person}/organisations/${created}`)).toBe(true)
  expect(await dbGet(`organisations:permissions/${created}/users/${person}`)).toBe(true)
  expect(await dbGet(`competitions/${cid('mine')}/organisations/${created}`)).toBe(true)
  // The same full name again, in other capitals: refused; a short name may be shared
  const again = await ask('create_organisation', { name: name.toUpperCase() })
  expect(again.isError).toBe(true)
  expect(again.text).toMatch(/already exists/)
  const shared = await ask('create_organisation', { name: `Another Games ${tag}`, shortName: 'PVG' })
  expect(shared.isError, shared.text).toBe(false)
  // Someone who manages nothing cannot start one
  const none = await callTool(stranger, 'create_organisation', { name: `Nobody's ${tag}` })
  expect(none.isError).toBe(true)
  expect(none.text).toMatch(/Submit a competition first/)
  for (const id of [created, shared.data.created[0].id]) {
    await dbRemove(`organisations/${id}`)
    await dbRemove(`organisations:permissions/${id}`)
    await dbRemove(`users:permissions/${person}/organisations/${id}`)
  }
  await dbRemove(`competitions/${cid('mine')}/organisations/${created}`)
})

// ---------- add_competition

// (Capitals: a lowercase word in a name is one of the things that sends a submission to be looked at)
const NAME = () => `Prairie Spring Championships ${tag.toUpperCase()}`
// (A day of its own each run: two submissions for the same day are held for a look)
const DAY = 60 + Math.floor(Math.random() * 400)
const future = () => isoDay(DAY)

test('add_competition files the submission as the person, it is approved at once, and they manage the new competition', async () => {
  const out = await ask('add_competition', {
    country: 'CA', date: future(), name: NAME(), town: 'Red Deer, AB', venue: 'Westerner Park', registrationNumber: 'AB 27 1234', organisations: [org()], message: 'Thanks', acceptsAsIs: true,
  })
  expect(out.isError, out.text).toBe(false)
  // Approved as it arrives: the reply says so, if the (emulated) trigger got to it in the time the tool waits; if not it says it
  // was sent, and the competition is there all the same a little later
  expect(out.data.summary, out.text).toMatch(/^(Added|Sent)\./)
  await expect.poll(async () => (await dbGet<Json>(`competitions:submissions/${out.data.submission}`)).competitionId, { timeout: 120_000 }).toBeTruthy()
  const submission = await dbGet<Json>(`competitions:submissions/${out.data.submission}`)
  const id = submission.competitionId as string
  if (out.data.competition) expect(out.data.competition).toBe(id)
  // The trigger saw the person as the submitter, and approved it as it arrived
  expect(submission).toMatchObject({ submittedBy: person, autoApproved: true, approvedBy: 'auto', competitionId: id, contact: { email, name: 'Pat Organiser', disclaimer: true, message: 'Thanks' } })
  expect(submission.competition).toMatchObject({ name: NAME(), date: future(), location: 'Red Deer, AB', country: 'CA', sobhd: 'C-AB-CO-27-1234', venue: 'Westerner Park' })
  expect(await dbGet<Json>(`competitions/${id}`)).toMatchObject({ name: NAME(), submissionId: out.data.submission, organisations: { [org()]: true } })
  expect(await dbGet(`users:permissions/${person}/competitions/${id}`)).toBe(true)
  expect(await dbGet(`competitions:permissions/${id}/users/${person}`)).toBe(true)
  expect(out.data.pin).toMatch(/^missing/)
  expect(out.data.registrationNote).toMatch(/C-AB-CO-27-1234/)
  // and now they can work on it
  expect((await ask('get_competition', { competition: id })).data.name).toBe(NAME())

  // Adding it again: it is the one already here
  const twice = await ask('add_competition', { country: 'CA', date: future(), name: NAME(), town: 'Red Deer, AB', venue: 'Westerner Park', acceptsAsIs: true })
  expect(twice.isError).toBe(true)
  expect(twice.text).toMatch(new RegExp(`already on ScotDance.app.*id ${id}.*notTheOneAlreadyHere`))
  await dbRemove(`competitions/${id}`)
  await dbRemove(`competitions:permissions/${id}`)
  await dbRemove(`competitions:submissions/${out.data.submission}`)
})

test('add_competition holds one that needs a look, and says so; refuses what the form would', async () => {
  const out = await ask('add_competition', { country: 'CA', date: future(), name: `LOWER CASE GAMES ${tag.toUpperCase()}`, town: 'Calgary, AB', acceptsAsIs: true })
  expect(out.isError, out.text).toBe(false)
  expect(out.data.competition).toBeUndefined()
  expect(out.data.summary).toMatch(/^Sent\. .*isn’t approved yet/)
  expect(out.data.likelyWaitingBecause).toContain('The name is in capitals')
  // (The trigger says so itself, when it gets to it)
  await expect.poll(async () => (await dbGet<Json>(`competitions:submissions/${out.data.submission}`)).review ?? [], { timeout: 60_000 }).toContain('The name is in capitals')
  const submission = await dbGet<Json>(`competitions:submissions/${out.data.submission}`)
  expect(submission).toMatchObject({ submittedBy: person })
  expect(submission.approved).toBeUndefined()
  expect(await dbGet(`users:permissions/${person}/competitions`)).not.toHaveProperty(submission.competitionId ?? 'none')

  const bad = await ask('add_competition', { country: 'CA', date: '2027-13-40', name: 'X Games Day', town: 'Calgary', acceptsAsIs: true })
  expect(bad.isError).toBe(true)
  expect(bad.text).toMatch(/not a date/)
  await dbRemove(`competitions:submissions/${out.data.submission}`)
})
