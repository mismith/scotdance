import { expect, test } from '@playwright/test'
import { dbGet, dbRemove, dbSet, ensureUser, grantCompetition, signIn, uid } from './support/emulator'
import { retry } from './support/retry'
import { removeCompetition, seedCompetition, type SeededCompetition } from './support/seed'

// The assistants' results, draws and schedule tools (ADR 0018 §9), asked over MCP against the `mcp` function: each
// writes to a seeded competition as its person, the app's own pages show it, undo_change restores it, and a mistake
// is refused in a sentence.

test.skip(({ isMobile }) => isMobile, 'Functions only: no need to run per device')
// The functions emulator runs one worker (--inspect-functions: see .github/workflows/e2e.yml), so every request to a function, even
// a route that does nothing, waits behind whatever triggers other tests have set off. Measured under a full run, `mcp`'s
// well-known route (no database, no token) answered in 5 ms when quiet and took up to 51 s at the worst; it is not the tools' work.
// So these specs allow for the queue instead of the default 30 s.
test.describe.configure({ mode: 'serial', timeout: 180_000 })

const OFFSET = Number(process.env.E2E_EMULATOR_PORT_OFFSET ?? 0)
const MCP = `http://127.0.0.1:${5001 + OFFSET}/firebase-scotdance/us-central1/mcp/mcp`

let comp: SeededCompetition
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

const data = (p: string) => `competitions:data/${comp.id}/${p}`
const group = (suffix: string) => comp.groups.find((g) => g.id.endsWith(`-grp-${suffix}`))!
const numbersOf = (groupId: string) => comp.dancers.filter((d) => d.groupId === groupId).map((d) => d.number)

test.beforeAll(async () => {
  comp = await retry(() => seedCompetition({ dancersPerGroup: 6, resultsForGroups: 0 }))
  email = `${uid('mcp-results')}@example.test`
  person = await ensureUser(email)
  await grantCompetition(person, comp.id)
})
test.afterAll(async () => {
  if (comp) {
    await retry(() => removeCompetition(comp.id))
    await dbRemove(`competitions:changes/${comp.id}`)
  }
  await dbRemove(`users:changes/${person}`)
  await dbRemove(`users:permissions/${person}`)
})

test('save_results enters callbacks, a tied dance and an overall; the public page shows them; undo puts them back', async ({ page }) => {
  const g = group('22')
  const [fling] = comp.dances
  const mine = comp.dancers.filter((d) => d.groupId === g.id)
  const n = mine.map((d) => d.number)
  const out = await call('save_results', {
    competition: comp.id,
    rows: [
      { ageGroup: g.id, row: 'Highland Fling', numbers: [n[2], [n[0], n[1]], n[3]] },
      { ageGroup: g.id, row: 'callbacks', numbers: n.slice(0, 4) },
      { ageGroup: g.id, row: 'overall', numbers: [n[2]] },
    ],
  })
  expect(out.isError, out.text).toBe(false)
  expect(out.data.change).toBeTruthy()
  expect(await dbGet(data(`results/${g.id}/${fling.id}`))).toEqual([mine[2].id, mine[0].id, `${mine[1].id}:tie`, mine[3].id])
  expect(await dbGet(data(`results/${g.id}/callbacks`))).toEqual(mine.slice(0, 4).map((d) => d.id))
  const saved = out.data.saved.find((r: Json) => r.row === 'Highland Fling (4)')
  expect(saved.numbers).toEqual([n[2], [n[0], n[1]], n[3]])
  expect(saved.placings[0]).toMatchObject({ place: 1, number: n[2], name: `${mine[2].firstName} ${mine[2].lastName}` })

  // The same list comes back from get_results
  const read = await call('get_results', { competition: comp.id, ageGroup: g.id })
  expect(read.data.ageGroups[0].dances[0].numbers).toEqual(saved.numbers)

  await page.goto(`/competitions/${comp.id}/results/${g.id}`)
  const f = page.locator(`#dance-${fling.id}`)
  const ribbons = f.getByRole('img', { name: /place/ })
  await expect(ribbons).toHaveCount(4)
  await expect(ribbons.nth(0)).toHaveAccessibleName(/(^|: )1st place$/)
  await expect(ribbons.nth(1)).toHaveAccessibleName(/(^|: )2nd place, tied$/)
  await expect(ribbons.nth(3)).toHaveAccessibleName(/(^|: )4th place$/)
  await expect(f.getByRole('listitem').first()).toContainText(mine[2].firstName)

  const undone = await call('undo_change', { competition: comp.id, change: out.data.change })
  expect(undone.isError, undone.text).toBe(false)
  expect(await dbGet(data(`results/${g.id}`))).toBeNull()
  await page.reload()
  await expect(page.locator(`#dance-${fling.id}`).getByRole('img', { name: /place/ })).toHaveCount(0)
})

test('save_results: a championship from the bottom, stand-ins only when asked, and refusals in sentences', async () => {
  const g = group('31')
  const mine = comp.dancers.filter((d) => d.groupId === g.id)
  const n = mine.map((d) => d.number)
  const ok = await call('save_results', { competition: comp.id, rows: [{ ageGroup: g.id, row: 'callbacks', numbers: n.slice(0, 4) }, { ageGroup: g.id, row: 'Reel', numbers: [n[3], n[2], [n[1], n[0]]], reversedFrom: 4 }] })
  expect(ok.isError, ok.text).toBe(false)
  const reel = comp.dances[3]
  expect(await dbGet(data(`results/${g.id}/${reel.id}`))).toEqual(['reverse:4', mine[3].id, mine[2].id, mine[1].id, `${mine[0].id}:tie`])
  expect(ok.data.saved[1].placings.map((p: Json) => p.place)).toEqual([4, 3, 1, 1])

  const before = await dbGet(data('results'))
  const refusals: Array<[Json, RegExp]> = [
    [{ ageGroup: g.id, row: 'Reel', numbers: ['9999'] }, /9999 is not an entry in Premier 7 & 8 Years/],
    [{ ageGroup: g.id, row: 'Reel', numbers: [n[0], n[0]] }, /placed twice/],
    [{ ageGroup: g.id, row: 'Reel', numbers: [n[0], '?'] }, /allowStandIns/],
    [{ ageGroup: g.id, row: 'Reel', numbers: [n[5]] }, new RegExp(`${n[5]} wasn’t called back`)],
    [{ ageGroup: group('00').id, row: 'overall', numbers: [numbersOf(group('00').id)[0]] }, /Primary Under 7 has no overall/],
    [{ ageGroup: g.id, row: 'Sword Dance', numbers: [n[0]], reversedFrom: 1 }, /reversedFrom is the lowest place/],
  ]
  for (const [row, match] of refusals) {
    const out = await call('save_results', { competition: comp.id, rows: [row] })
    expect(out.isError, JSON.stringify(row)).toBe(true)
    expect(out.text).toMatch(match)
  }
  expect(await dbGet(data('results'))).toEqual(before)

  const standIn = await call('save_results', { competition: comp.id, rows: [{ ageGroup: g.id, row: 'Reel', numbers: [n[0], '?'], allowStandIns: true }] })
  expect(standIn.isError, standIn.text).toBe(false)
  expect(standIn.data.saved[0].numbers).toEqual([n[0], '?'])
  expect(standIn.data.saved[0].placings[1].standIn).toBe(true)
})

test('save_results: trophy events and championship points', async () => {
  const g = group('32')
  const mine = comp.dancers.filter((d) => d.groupId === g.id)
  const te = await call('save_dances', { competition: comp.id, trophyEvents: [{ name: 'Dancer of the Day', ageGroups: [g.id, group('21').id] }] })
  expect(te.isError, te.text).toBe(false)
  const id = te.data.created[0].id
  const placed = await call('save_results', { competition: comp.id, rows: [{ trophyEvent: id, row: 'overall', numbers: [mine[1].number] }] })
  expect(placed.isError, placed.text).toBe(false)
  expect(await dbGet(data(`results/${id}/overall`))).toEqual([mine[1].id])
  const points = await call('save_results', { competition: comp.id, rows: [{ ageGroup: g.id, row: 'Highland Fling', points: [mine[2].number, mine[3].number] }] })
  expect(points.isError, points.text).toBe(false)
  expect(await dbGet(data(`points/${g.id}/${comp.dances[0].id}/combined`))).toEqual([mine[2].id, mine[3].id])
  const off = await call('save_results', { competition: comp.id, rows: [{ ageGroup: g.id, row: 'Highland Fling', numbers: [mine[2].number], points: [] }] })
  expect(off.isError, off.text).toBe(false)
  expect(await dbGet(data(`points/${g.id}/${comp.dances[0].id}`))).toBeNull()
})

test('save_draws sets an order the Draws screen shows, shuffles with reels in number order, and undo restores', async ({ page }) => {
  const g = group('21')
  const n = numbersOf(g.id)
  const [fling, , , reel] = comp.dances
  const order = [...n].reverse()
  const out = await call('save_draws', { competition: comp.id, draws: [{ ageGroup: g.id, dance: 'Highland Fling', order }] })
  expect(out.isError, out.text).toBe(false)
  expect(out.data.saved[0].order).toEqual(order)
  expect(await dbGet(data(`draws/${g.id}/${fling.id}`))).toEqual(order)

  await signIn(page, email)
  await page.goto(`/competitions/${comp.id}/manage/groups/${g.id}/draws`)
  const card = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Highland Fling (4)', exact: true }) })
  await expect(card.getByRole('listitem').first()).toContainText(order[0])

  const shuffled = await call('save_draws', { competition: comp.id, draws: [{ ageGroup: g.id, dance: 'all', action: 'shuffle' }] })
  expect(shuffled.isError, shuffled.text).toBe(false)
  expect([...((await dbGet<string[]>(data(`draws/${g.id}/${fling.id}`))) ?? [])].sort()).toEqual([...n].sort())
  expect(await dbGet(data(`draws/${g.id}/${reel.id}`))).toEqual(n)

  expect((await call('undo_change', { competition: comp.id, change: shuffled.data.change })).isError).toBe(false)
  expect(await dbGet(data(`draws/${g.id}/${fling.id}`))).toEqual(order)
  const bad = await call('save_draws', { competition: comp.id, draws: [{ ageGroup: g.id, dance: 'Highland Fling', order: ['9999'] }] })
  expect(bad.text).toMatch(/9999 is not an entry in/)
})

test('save_schedule builds a day the public schedule shows, sends back unchanged, and undo removes it', async ({ page }) => {
  const g = group('22')
  const [fling] = comp.dances
  const body = {
    name: 'Monday',
    date: new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10),
    sessions: [{
      name: 'Evening',
      events: [
        { name: 'Registration', description: '6:00 pm', dances: [{ name: 'Check-in' }] },
        { name: 'Novice Evening', description: '7:00 pm', dances: [{ dance: 'Highland Fling', platforms: [{ platform: 'Platform A', ageGroups: [g.id, 'gap', group('21').id], judges: ['Aileen Robertson'] }, { id: comp.platforms[1], ageGroups: [group('20').id], judges: ['Deborah Wardrope'] }] }] },
      ],
    }],
  }
  const out = await call('save_schedule', { competition: comp.id, days: [body] })
  expect(out.isError, out.text).toBe(false)
  const dayId = out.data.days[0].id
  const read = await call('get_schedule', { competition: comp.id, day: dayId })
  const day = read.data.days[0]
  expect(day.sessions[0].events[1].dances[0]).toMatchObject({ danceId: fling.id, dance: 'Highland Fling (4)' })
  expect(day.sessions[0].events[1].dances[0].platforms[0].ageGroups.map((a: Json) => a.gap ?? a.name)).toEqual([expect.stringContaining('9 & 10'), true, expect.any(String)])

  const again = await call('save_schedule', { competition: comp.id, days: [day] })
  expect(again.isError, again.text).toBe(false)
  expect(again.data.change).toBeUndefined()

  const event = day.sessions[0].events[1]
  await page.goto(`/competitions/${comp.id}/schedule/${dayId}/${day.sessions[0].id}/${event.id}`)
  await expect(page.getByText('Novice Evening').first()).toBeVisible()
  await expect(page.getByText(/Aileen Robertson/).first()).toBeVisible()

  // Reel is switched on for the Novice 9 & 10 group only in the seed; take that away and it can't go in its cell
  const onlyElsewhere = await call('save_dances', { competition: comp.id, dances: [{ id: comp.dances[3].id, ageGroups: [group('21').id] }] })
  expect(onlyElsewhere.isError, onlyElsewhere.text).toBe(false)
  const wrong = await call('save_schedule', { competition: comp.id, days: [{ id: dayId, sessions: [{ id: day.sessions[0].id, name: 'Evening', events: [{ name: 'X', dances: [{ dance: 'Reel', platforms: [{ platform: 'Platform A', ageGroups: [g.id] }] }] }] }] }] })
  expect(wrong.isError).toBe(true)
  expect(wrong.text).toMatch(/Novice 9 & 10 Years doesn’t dance Reel/)

  expect((await call('undo_change', { competition: comp.id, change: out.data.change })).isError).toBe(false)
  expect(Object.keys((await dbGet<Json>(data('schedule/days'))) ?? {})).not.toContain(dayId)
})

test('every change is in the person’s index (marked undone with its undo), get_results links the judges’ sheet, and an old gap in a draw is not shown', async () => {
  const g = group('22')
  const [fling] = comp.dances
  const n = numbersOf(g.id)
  const out = await call('save_results', { competition: comp.id, rows: [{ ageGroup: g.id, row: 'Highland Fling', numbers: [n[0]] }] })
  expect(out.isError, out.text).toBe(false)
  const index = async () => Object.values((await dbGet<Record<string, Record<string, Json>>>(`users:changes/${person}`)) ?? {}).flatMap((c) => Object.entries(c))
  const mine = (await index()).find(([id]) => id === out.data.change)![1]
  expect(mine).toMatchObject({ scope: 'competitions', scopeId: comp.id })
  expect(typeof mine.at).toBe('number')
  expect(mine.undone).toBeUndefined()

  const undo = await call('undo_change', { competition: comp.id, change: out.data.change })
  expect(undo.isError, undo.text).toBe(false)
  const after = await index()
  expect(typeof after.find(([id]) => id === out.data.change)![1].undone).toBe('number')
  expect(after.find(([id]) => id === undo.data.change)![1]).toMatchObject({ undoOf: out.data.change })

  // A judges' sheet cannot be uploaded by an assistant: it gives the link where the organiser does
  const read = await call('get_results', { competition: comp.id, ageGroup: g.id })
  const sheet = read.data.ageGroups[0].dances[0].judgesSheet
  expect(sheet.pages).toBe(0)
  expect(sheet.addInApp).toMatch(new RegExp(`/competitions/${comp.id}/manage/results/${g.id}/${fling.id}$`))

  // A draw that an old admin left with holes is read as the app reads it
  await dbSet(data(`draws/${g.id}/${fling.id}`), { 0: n[1], 2: n[0], 3: '' })
  const draws = await call('get_results', { competition: comp.id, ageGroup: g.id, draws: true })
  expect(draws.data.ageGroups[0].dances[0].draw).toEqual([n[1], n[0]])
})
