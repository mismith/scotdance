import { expect, test } from '@playwright/test'
import { dbRemove, ensureUser, grantCompetition, uid } from './support/emulator'
import { retry } from './support/retry'
import { removeCompetition, seedCompetition, type SeededCompetition } from './support/seed'

// The assistants' read tools (ADR 0018), asked over MCP the way an assistant asks, against the `mcp` function:
// each answers for a competition its person manages, and refuses (in a sentence) for one they don't, even a
// published one that anyone can read in the app. The emulator takes `Bearer dev:<uid>` in place of OAuth tokens.
// No browser needed, so it runs once (desktop project).

test.skip(({ isMobile }) => isMobile, 'Functions only: no need to run per device')
test.describe.configure({ mode: 'serial' })

const OFFSET = Number(process.env.E2E_EMULATOR_PORT_OFFSET ?? 0)
const MCP = `http://127.0.0.1:${5001 + OFFSET}/firebase-scotdance/us-central1/mcp/mcp`

let mine: SeededCompetition
let theirs: SeededCompetition
let person = ''

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

test.beforeAll(async () => {
  mine = await seedCompetition({ dancersPerGroup: 3, resultsForGroups: 2 })
  theirs = await seedCompetition({ dancersPerGroup: 2 })
  person = await ensureUser(`${uid('mcp-org')}@example.test`)
  await grantCompetition(person, mine.id)
})

test.afterAll(async () => {
  for (const c of [mine, theirs]) await retry(() => removeCompetition(c.id))
  await dbRemove(`users:permissions/${person}`)
})

test('get_competitions lists only the ones they manage', async () => {
  const out = await call('get_competitions')
  expect(out.isError).toBe(false)
  expect(out.data.competitions.map((c: Json) => c.id)).toEqual([mine.id])
})

test('get_competition: details, flags, counts and today', async () => {
  const { data } = await call('get_competition', { competition: mine.id })
  expect(data.name).toBe(mine.name)
  expect(data.today).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  expect(data.venue).toBe('Spruce Meadows')
  expect(data.listed).toBe(true)
  expect(data.published).toBe(true)
  expect(data.counts).toMatchObject({ categories: 4, ageGroups: 11, dances: 4, entries: 33, judges: 3, pipers: 1, sponsors: 1, platforms: 2, scheduleDays: 2 })
})

test('get_dances: age groups with their dances, and dances with their age groups', async () => {
  const { data } = await call('get_dances', { competition: mine.id })
  expect(data.ageGroups).toHaveLength(mine.groups.length)
  expect(data.ageGroups[0]).toMatchObject({ id: mine.groups[0].id, name: 'Primary Under 7', category: { name: 'Primary' }, entries: 3 })
  expect(data.dances.map((d: Json) => d.name)).toEqual(['Highland Fling (4)', 'Sword Dance (2&1)', 'Seann Triubhas (3&1)', 'Reel'])
  expect(data.dances[0].ageGroups).toBe('all')
})

test('get_dancers: by number, and narrowed to an age group by name', async () => {
  const all = await call('get_dancers', { competition: mine.id })
  expect(all.data.total).toBe(33)
  expect(all.data.entries[0]).toMatchObject({ number: '101', ageGroup: { id: mine.groups[0].id } })
  const some = await call('get_dancers', { competition: mine.id, ageGroup: 'Premier 9 & 10 Years' })
  expect(some.data.total).toBe(3)
  const nope = await call('get_dancers', { competition: mine.id, ageGroup: 'Juvenile' })
  expect(nope.isError).toBe(true)
  expect(nope.text).toMatch(/No age group matches/)
})

test('get_staff: judges, pipers, sponsors and platforms', async () => {
  const { data } = await call('get_staff', { competition: mine.id })
  expect(data.judges.map((j: Json) => j.name)).toEqual(['Aileen Robertson', 'Deborah Wardrope', 'Iain Fraser'])
  expect(data.pipers[0].name).toBe('Alasdair Gillies')
  expect(data.platforms.map((p: Json) => p.name)).toEqual(['Platform A', 'Platform B'])
})

test('get_schedule: days to platforms with names, and one day', async () => {
  const { data } = await call('get_schedule', { competition: mine.id })
  expect(data.days.map((d: Json) => d.name)).toEqual(['Saturday', 'Sunday'])
  const dance = data.days[0].blocks[0].events[0].dances[0]
  expect(dance.name).toBe('Highland Fling (4)')
  expect(dance.platforms[0]).toMatchObject({ name: 'Platform A', judges: [{ name: 'Aileen Robertson' }] })
  expect(dance.platforms[0].ageGroups[0].name).toMatch(/^Primary/)
  const day = await call('get_schedule', { competition: mine.id, day: 'Sunday' })
  expect(day.data.days).toHaveLength(1)
})

test('get_results: placings by number and name, with the tie, and draws when asked', async () => {
  const g = mine.groups[0]
  const { data } = await call('get_results', { competition: mine.id, ageGroup: g.id, draws: true })
  const fling = data.ageGroups[0].dances[0]
  expect(fling.state).toBe('entered')
  expect(fling.placings.map((p: Json) => p.number)).toEqual(['101', '102', '103'])
  // The seed ties the second dancer with the first
  expect(fling.placings.map((p: Json) => p.place)).toEqual([1, 1, 3])
  expect(fling.placings[0].name).toMatch(/\w/)
  expect(fling.draw).toHaveLength(3)
  const overview = await call('get_results', { competition: mine.id })
  expect(overview.data.ageGroups.length).toBeGreaterThan(0)
  expect(overview.data.key).toMatch(/standIn/)
})

test('find: by number and by name', async () => {
  const byNumber = await call('find', { competition: mine.id, query: '101' })
  expect(byNumber.data.entries).toHaveLength(1)
  const byName = await call('find', { competition: mine.id, query: 'robertson' })
  expect(byName.data.staff[0].name).toBe('Aileen Robertson')
})

test('every tool refuses a competition they do not manage, in words, even a published one', async () => {
  for (const name of ['get_competition', 'get_dances', 'get_dancers', 'get_staff', 'get_schedule', 'get_results']) {
    const out = await call(name, { competition: theirs.id })
    expect(out.isError, name).toBe(true)
    expect(out.text, name).toMatch(/You don’t manage a competition with the id/)
    expect(out.text, name).not.toContain(theirs.name)
  }
  const found = await call('find', { competition: theirs.id, query: 'robertson' })
  expect(found.isError).toBe(true)
  const nonsense = await call('get_competition', { competition: '../users' })
  expect(nonsense.isError).toBe(true)
  expect(nonsense.text).toMatch(/not a competition id/)
})
