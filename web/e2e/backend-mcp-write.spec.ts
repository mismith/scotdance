import { expect, test } from '@playwright/test'
import { dbGet, dbRemove, dbSet, ensureUser, grantCompetition, signIn, uid } from './support/emulator'
import { retry } from './support/retry'
import { removeCompetition, seedCompetition, type SeededCompetition } from './support/seed'

// The assistants' write tools (ADR 0018), asked over MCP the way an assistant asks, against the `mcp` function: each
// changes a competition its person manages (through the database rules, as them), is refused on one they don't,
// logs one change that undo_change puts back, and a later edit stops the undo. Plus the draft that lands in the
// organiser's import inbox and shows in Import dancers.

test.skip(({ isMobile }) => isMobile, 'Functions only: no need to run per device')
test.describe.configure({ mode: 'serial' })

const OFFSET = Number(process.env.E2E_EMULATOR_PORT_OFFSET ?? 0)
const MCP = `http://127.0.0.1:${5001 + OFFSET}/firebase-scotdance/us-central1/mcp/mcp`

let mine: SeededCompetition
let theirs: SeededCompetition
let person = ''
let email = ''

type Json = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

async function call(name: string, args: Json = {}): Promise<{ isError: boolean; text: string; data: Json }> {
  const res = await fetch(MCP, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', Authorization: `Bearer dev:${person}` },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }),
  })
  const { result } = (await res.json()) as { result: { isError?: boolean; content: Array<{ text: string }>; structuredContent?: Json } }
  return { isError: result.isError === true, text: result.content[0].text, data: result.structuredContent ?? {} }
}

const data = (p: string, id = mine.id) => `competitions:data/${id}/${p}`
const info = (p = '', id = mine.id) => `competitions/${id}${p ? `/${p}` : ''}`
const log = (id = mine.id) => dbGet<Record<string, Json> | null>(`competitions:changes/${id}`)

test.beforeAll(async () => {
  mine = await seedCompetition({ dancersPerGroup: 3, resultsForGroups: 2 })
  theirs = await seedCompetition({ dancersPerGroup: 2 })
  email = `${uid('mcp-write')}@example.test`
  person = await ensureUser(email)
  await grantCompetition(person, mine.id)
})

test.afterAll(async () => {
  for (const c of [mine, theirs]) {
    await retry(() => removeCompetition(c.id))
    await dbRemove(`competitions:changes/${c.id}`)
  }
  await dbRemove(`users:permissions/${person}`)
  await dbRemove(`users:inbox/${person}`)
  await dbRemove(`competitionLinks:sync/${mine.id}`)
  await dbRemove(`competitionLinks:of/${mine.id}`)
  await dbRemove('competitionLinks/L-write')
})

test('update_competition changes the details, logs one change, and undo_change puts them back', async () => {
  const before = await dbGet<Json>(info())
  const out = await call('update_competition', { competition: mine.id, name: 'Renamed Games', venue: 'The Arena', description: 'Two days of dancing.', links: [{ label: 'Program', url: 'example.com/program' }] })
  expect(out.isError, out.text).toBe(false)
  expect(out.data.change).toBeTruthy()
  expect(out.data.warnings?.[0]).toMatch(/map pin/)
  const now = await dbGet<Json>(info())
  expect([now.name, now.venue, now.description]).toEqual(['Renamed Games', 'The Arena', 'Two days of dancing.'])
  expect(Object.values(now.links as Json)[0]).toMatchObject({ name: 'Program', url: 'example.com/program' })

  const entries = await log()
  expect(Object.keys(entries!)).toContain(out.data.change)
  expect(entries![out.data.change]).toMatchObject({ uid: person, tool: 'update_competition', client: expect.any(String) })
  const changes = await call('get_changes', { competition: mine.id })
  expect(changes.data.changes[0]).toMatchObject({ id: out.data.change, tool: 'update_competition' })

  const undone = await call('undo_change', { competition: mine.id, change: out.data.change })
  expect(undone.isError, undone.text).toBe(false)
  const after = await dbGet<Json>(info())
  expect([after.name, after.venue, after.description, after.links ?? null]).toEqual([before.name, before.venue, before.description ?? null, null])
  const again = await call('undo_change', { competition: mine.id, change: out.data.change })
  expect(again.text).toMatch(/already been undone/)
  const marked = (await log())![out.data.change]
  expect(marked.undone).toMatchObject({ by: person })
})

test('undo_change refuses once something it changed has been changed again', async () => {
  const out = await call('update_competition', { competition: mine.id, name: 'First rename' })
  const later = await call('update_competition', { competition: mine.id, name: 'Second rename' })
  expect(later.isError).toBe(false)
  const undo = await call('undo_change', { competition: mine.id, change: out.data.change })
  expect(undo.isError).toBe(true)
  expect(undo.text).toMatch(/changed again since.*Second rename/)
  expect((await dbGet<Json>(info())).name).toBe('Second rename')
  // the newer one still undoes, and then so does the first
  expect((await call('undo_change', { competition: mine.id, change: later.data.change })).isError).toBe(false)
  expect((await call('undo_change', { competition: mine.id, change: out.data.change })).isError).toBe(false)
})

test('save_dances, save_dancers and save_staff add what they are given, with ids back, and undo', async () => {
  const dances = await call('save_dances', {
    competition: mine.id,
    categories: [{ name: 'Juvenile' }],
    ageGroups: [{ category: 'Juvenile', name: '12 & Under 14 Years' }],
    dances: [{ name: 'Irish Jig', ageGroups: ['Juvenile 12 & Under 14 Years'] }],
  })
  expect(dances.isError, dances.text).toBe(false)
  const group = dances.data.created.find((c: Json) => c.kind === 'ageGroup')
  const dance = dances.data.created.find((c: Json) => c.kind === 'dance')
  expect(await dbGet(data(`dances/${dance.id}/groupIds`))).toEqual({ [group.id]: true })

  const dancers = await call('save_dancers', {
    competition: mine.id,
    dancers: [
      { number: 701, ageGroup: group.id, firstName: 'MARY', lastName: "O'Neill", location: 'Calgary, AB' },
      { number: '702', ageGroup: 'Juvenile 12 & Under 14 Years', routine: 'The Reelers', members: [{ firstName: 'Ella', lastName: 'Grant' }, { firstName: 'Ruby', lastName: 'Fraser' }] },
    ],
  })
  expect(dancers.isError, dancers.text).toBe(false)
  const [one, team] = dancers.data.created.map((c: Json) => c.id)
  const saved = await dbGet<Json>(data(`dancers/${one}`))
  expect(saved).toMatchObject({ number: '701', firstName: 'MARY', lastName: "O'Neill", groupId: group.id, categoryId: expect.any(String) })
  expect((await dbGet<Json>(data(`dancers/${team}`))).team).toBe(true)
  const clash = await call('save_dancers', { competition: mine.id, dancers: [{ number: '701', ageGroup: group.id, firstName: 'Again' }] })
  expect(clash.text).toMatch(/701 is already MARY O'Neill in this age group/)
  const fixed = await call('save_dancers', { competition: mine.id, dancers: [{ id: one, firstName: 'Mary' }] })
  expect((await dbGet<Json>(data(`dancers/${one}`))).firstName).toBe('Mary')

  const staff = await call('save_staff', { competition: mine.id, staff: [{ role: 'Judge', firstName: 'Fiona', lastName: 'Black' }], platforms: [{ name: 'C' }] })
  expect(staff.isError, staff.text).toBe(false)
  expect(await dbGet(data(`staff/${staff.data.created[0].id}/type`))).toBe('Judge')

  // Backwards, each its own change
  for (const c of [staff, fixed, dancers, dances]) expect((await call('undo_change', { competition: mine.id, change: c.data.change })).isError).toBe(false)
  expect(await dbGet(data(`dancers/${one}`))).toBeNull()
  expect(await dbGet(data(`dances/${dance.id}`))).toBeNull()
  expect(await dbGet(data(`groups/${group.id}`))).toBeNull()
})

test('remove takes an age group with its results, says what went, and undo brings it all back', async () => {
  const g = mine.groups[0]
  const before = await dbGet<Json>(data(''))
  expect(before.results[g.id]).toBeTruthy()
  const out = await call('remove', { competition: mine.id, what: 'ageGroup', ids: [g.id] })
  expect(out.isError, out.text).toBe(false)
  expect(out.data.removed).toEqual([expect.objectContaining({ id: g.id })])
  expect(out.data.warnings.join(' ')).toMatch(/results and draws will be deleted/)
  const gone = await dbGet<Json>(data(''))
  expect(gone.groups[g.id]).toBeUndefined()
  expect(gone.results?.[g.id]).toBeUndefined()
  expect((await call('undo_change', { competition: mine.id, change: out.data.change })).isError).toBe(false)
  const back = await dbGet<Json>(data(''))
  expect(back.groups[g.id]).toEqual(before.groups[g.id])
  expect(back.results[g.id]).toEqual(before.results[g.id])
  expect(back.schedule).toEqual(before.schedule)
  expect(back.draws).toEqual(before.draws)
})

test('set_visibility: hiding a tab with content needs the organiser’s say-so, and undo restores it', async () => {
  const results = await dbGet<Json>(data('results'))
  const refused = await call('set_visibility', { competition: mine.id, results: 'hide' })
  expect(refused.isError).toBe(true)
  expect(refused.text).toMatch(/deletes all the results entered so far.*deleteContent/)
  expect(await dbGet(data('results'))).toEqual(results)
  const out = await call('set_visibility', { competition: mine.id, results: 'hide', deleteContent: true })
  expect(out.isError, out.text).toBe(false)
  expect(await dbGet(data('results'))).toBe(false)
  expect((await call('undo_change', { competition: mine.id, change: out.data.change })).isError).toBe(false)
  expect(await dbGet(data('results'))).toEqual(results)
})

test('set_visibility lists and publishes an unlisted competition, and unlists it again', async () => {
  const scratch = await seedCompetition({ dancersPerGroup: 1, published: false, listed: false })
  await grantCompetition(person, scratch.id)
  try {
    const out = await call('set_visibility', { competition: scratch.id, published: true })
    expect(out.isError, out.text).toBe(false)
    expect(await dbGet(info('', scratch.id))).toMatchObject({ listed: true, published: true })
    const off = await call('set_visibility', { competition: scratch.id, listed: false })
    expect(await dbGet(info('', scratch.id))).toMatchObject({ listed: false, published: false })
    expect(off.data.change).toBeTruthy()
  } finally {
    await retry(() => removeCompetition(scratch.id))
    await dbRemove(`competitions:changes/${scratch.id}`)
  }
})

test('every write tool is refused on a competition they do not manage, and writes nothing', async () => {
  const before = await dbGet(data('', theirs.id))
  const beforeInfo = await dbGet(info('', theirs.id))
  const attempts: Array<[string, Json]> = [
    ['update_competition', { name: 'Mine now' }],
    ['set_visibility', { published: false }],
    ['save_dances', { categories: [{ name: 'X' }] }],
    ['save_dancers', { dancers: [{ number: '1', ageGroup: 'x', firstName: 'X' }] }],
    ['save_staff', { staff: [{ role: 'Judge', firstName: 'X' }] }],
    ['save_results', { rows: [{ ageGroup: 'x', row: 'callbacks', numbers: ['1'] }] }],
    ['save_draws', { draws: [{ ageGroup: 'x', dance: 'all', action: 'clear' }] }],
    ['save_schedule', { days: [{ name: 'Saturday' }] }],
    ['remove', { what: 'dancer', ids: ['x'] }],
    ['draft_dancers', { dancers: [{ number: '1', firstName: 'X' }] }],
    ['get_changes', {}],
    ['undo_change', { change: 'x' }],
  ]
  for (const [name, args] of attempts) {
    const out = await call(name, { competition: theirs.id, ...args })
    expect(out.isError, name).toBe(true)
    expect(out.text, name).toMatch(/You don’t manage a competition with the id/)
  }
  expect(await dbGet(data('', theirs.id))).toEqual(before)
  expect(await dbGet(info('', theirs.id))).toEqual(beforeInfo)
  expect(await log(theirs.id)).toBeNull()
})

test('a part shared from a primary competition is refused with a sentence that names the primary', async () => {
  await dbSet('competitionLinks/L-write', { primary: theirs.id, competitions: { [theirs.id]: true, [mine.id]: true } })
  await dbSet(`competitionLinks:of/${mine.id}`, 'L-write')
  await dbSet(`competitionLinks:sync/${mine.id}`, { venue: true, staff: true })
  try {
    const venue = await call('update_competition', { competition: mine.id, venue: 'Somewhere else' })
    expect(venue.isError).toBe(true)
    expect(venue.text).toMatch(new RegExp(`shared from ${theirs.name}.*only be changed there`))
    expect((await dbGet<Json>(info())).venue).toBe('Spruce Meadows')
    const staff = await call('save_staff', { competition: mine.id, staff: [{ role: 'Judge', firstName: 'New' }] })
    expect(staff.text).toMatch(/whole staff list.*shared from/)
    // What is not shared still changes
    expect((await call('update_competition', { competition: mine.id, description: 'Fine' })).isError).toBe(false)
  } finally {
    await dbRemove(`competitionLinks:sync/${mine.id}`)
  }
})

test('draft_dancers files the list in the inbox, changes nothing else, and Import dancers previews it', async ({ page }) => {
  const dancersBefore = await dbGet(data('dancers'))
  const out = await call('draft_dancers', {
    competition: mine.id,
    name: 'Entries.csv',
    dancers: [
      { number: '901', category: 'Novice', ageGroup: '9 & 10 Years', firstName: 'Isla', lastName: 'Draftson', location: 'Calgary, AB' },
      { number: '902', category: 'Novice', ageGroup: '9 & 10 Years', firstName: 'Ava', lastName: 'Draftson' },
    ],
  })
  expect(out.isError, out.text).toBe(false)
  expect(out.data.next).toContain(`/competitions/${mine.id}/manage/dancers/import?inbox=${out.data.inbox}`)
  const item = await dbGet<Json>(`users:inbox/${person}/${out.data.inbox}`)
  expect(item).toMatchObject({ kind: 'dancers', name: 'Entries.csv', competitionId: mine.id })
  expect(typeof item.sentAt).toBe('number')
  expect(await dbGet(data('dancers'))).toEqual(dancersBefore)
  expect(await log()).not.toHaveProperty(out.data.inbox)

  await signIn(page, email)
  await page.goto(`/competitions/${mine.id}/manage/dancers/import?inbox=${out.data.inbox}`)
  await expect(page.getByText('2 dancers in 1 age group')).toBeVisible()
  await expect(page.getByText('Draftson').first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Import 2 dancers' })).toBeVisible()
})
