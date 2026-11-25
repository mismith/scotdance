// @vitest-environment node
import assert from 'node:assert/strict'
import { describe, test } from 'vitest'
import { writeTools } from '../../../../functions/src/mcp/writeTools'
import { dancesView, resultsView, type Parts } from '../../../../functions/src/mcp/view'
import { fakeSession, type Json } from './mcpHarness'

// The examples the AI assistants page (/ai) shows, each played as the tool calls an assistant makes for it, on a
// competition the size of a real one. If one of these fails, fix the tool or change the example.

const tool = (name: string) => writeTools.find((t) => t.name === name)!
const call = (s: ReturnType<typeof fakeSession>['session'], name: string, args: Json) => tool(name).run(args as never, s) as Promise<Json>

const CATEGORIES = ['Primary', 'Beginner', 'Novice', 'Intermediate', 'Premier']
const BANDS = ['6 & Under', '7 & Under 9', '9 & Under 12', '12 & Under 14', '14 & Under 16', '16 & Over']
const DANCES: Array<[string, string]> = [['Highland Fling', '4'], ['Sword Dance', '2+1'], ['Seann Triubhas', '3+1'], ['Highland Reel', '']]

/** Five categories × six age bands, four dances each, ten entries in every age group: 300 entries */
function bigCompetition(): Json {
  const categories: Json = {}
  const groups: Json = {}
  const dances: Json = {}
  const dancers: Json = {}
  CATEGORIES.forEach((name, i) => { categories[`cat${i}`] = { name, _order: i } })
  let n = 100
  CATEGORIES.forEach((_, i) => BANDS.forEach((band, j) => {
    const g = `g${i}${j}`
    groups[g] = { name: `${band} Years`, categoryId: `cat${i}`, _order: i * 10 + j }
    for (let k = 0; k < 10; k++) {
      n++
      dancers[`e${n}`] = { number: String(n), firstName: `Dancer${n}`, lastName: 'Test', groupId: g, categoryId: `cat${i}` }
    }
  }))
  DANCES.forEach(([name, steps], i) => {
    dances[`d${i}`] = { name, ...(steps ? { steps } : {}), _order: i, groupIds: Object.fromEntries(Object.keys(groups).map((g) => [g, true])) }
  })
  return {
    'users:permissions': { u1: { competitions: { c1: true } } },
    competitions: { c1: { name: 'Prairie Spring Games', date: '2026-04-11', listed: true, published: false } },
    'competitions:data': { c1: { categories, groups, dances, dancers } },
  }
}
const dataOf = (db: ReturnType<typeof fakeSession>) => db.tree['competitions:data'].c1 as Json

describe('the examples on the AI assistants page', () => {
  test('“Here’s a photo of the scrutineer’s sheet. Enter the Premier 14 & Under 16 results.”', async () => {
    const db = fakeSession(bigCompetition())
    // It reads the age group as the sheet names it, then saves every dance and the overall in one call
    // (Its entries are 381 to 390)
    const numbers = ['381', '382', ['383', '384'], '385', '386']
    const rows = [...DANCES.map(([name]) => ({ ageGroup: 'Premier 14 & Under 16', row: name, numbers })), { ageGroup: 'Premier 14 & Under 16', row: 'overall', numbers: ['381', '383', '382'] }]
    const out = await call(db.session, 'save_results', { competition: 'c1', rows })
    assert.equal(out.saved.length, 5)
    assert.deepEqual(dataOf(db).results.g44.d0.slice(0, 2), ['e381', 'e382'])
  })

  test('“Draw every age group at random. Keep the reels in number order.”', async () => {
    const db = fakeSession(bigCompetition())
    // One row per age group, every dance: 30 age groups × 4 dances is 120 draws in one call
    const draws = Object.keys(dataOf(db).groups).map((ageGroup) => ({ ageGroup, dance: 'all', action: 'shuffle' }))
    const out = await call(db.session, 'save_draws', { competition: 'c1', draws })
    assert.equal(out.saved.length, 120)
    const reel = dataOf(db).draws.g44.d3
    assert.deepEqual(reel, [...reel].sort())
  })

  test('“Here are this year’s entries” (a spreadsheet, PDF or photo of the forms)', async () => {
    const db = fakeSession(bigCompetition())
    const dancers = Array.from({ length: 400 }, (_, i) => ({ number: 500 + i, category: 'Novice', ageGroup: '9 & Under 12 Years', firstName: `New${i}`, lastName: 'Entry' }))
    const out = await call(db.session, 'draft_dancers', { competition: 'c1', name: 'Entries.csv', dancers })
    assert.equal(out.entries, 400)
    assert.match(out.next, /manage\/dancers\/import\?inbox=/)
  })

  test('“Set up the age groups and dances from last year’s program.”', async () => {
    const db = fakeSession({
      'users:permissions': { u1: { competitions: { c1: true } } },
      competitions: { c1: { name: 'Prairie Spring Games', date: '2027-04-10' } },
    })
    // A new competition from a program: categories, their age groups, and the dances each age group does, in one call
    const ageGroups = CATEGORIES.flatMap((category) => BANDS.map((band) => ({ category, name: `${band} Years` })))
    const dances = DANCES.map(([name, steps]) => ({
      name, steps: steps || undefined,
      // Primary doesn't dance the Seann Triubhas
      ageGroups: CATEGORIES.filter((c) => !(c === 'Primary' && name === 'Seann Triubhas')).flatMap((c) => BANDS.map((b) => `${c} ${b} Years`)),
    }))
    const out = await call(db.session, 'save_dances', {
      competition: 'c1',
      categories: CATEGORIES.map((name) => ({ name })),
      ageGroups,
      dances,
      trophyEvents: [{ name: 'Dancer of the Day', ageGroups: 'all' }],
    })
    assert.ok(!out.warnings, JSON.stringify(out.warnings))
    const set = dancesView(dataOf(db) as Parts) as Json
    assert.equal(set.ageGroups.length, 30)
    const seann = set.dances.find((d: Json) => d.name.startsWith('Seann'))
    assert.equal(seann.ageGroups.length, 24)
  })

  test('“Who’s still missing results, and which age groups have no callbacks yet?”', async () => {
    const db = fakeSession(bigCompetition())
    const groups = Object.keys(dataOf(db).groups)
    // Six placed in every dance and overall, except one Premier dance not entered yet
    const six = (ageGroup: string) => Array.from({ length: 6 }, (_, k) => String(101 + groups.indexOf(ageGroup) * 10 + k))
    const rows = groups.flatMap((ageGroup) => [
      ...DANCES.map(([name], i) => ({ ageGroup, row: name, numbers: ageGroup === 'g45' && i === 2 ? [] : six(ageGroup) })),
      ...(ageGroup.startsWith('g0') ? [] : [{ ageGroup, row: 'overall', numbers: six(ageGroup) }]),
    ])
    for (let i = 0; i < rows.length; i += 60) await call(db.session, 'save_results', { competition: 'c1', rows: rows.slice(i, i + 60) })
    const view = resultsView(dataOf(db) as Parts, { competition: 'c1' }) as Json
    // Every age group is accounted for: in full, or summarised
    const all = [...view.ageGroups, ...(view.moreAgeGroups ?? [])]
    assert.equal(all.length, 30)
    // The summarised ones (most of them) name what is left, and callbacks apart
    assert.ok(view.moreAgeGroups.length > 10)
    const g45 = view.moreAgeGroups.find((g: Json) => g.id === 'g45')
    assert.deepEqual(g45, { id: 'g45', name: 'Premier 16 & Over Years', callbacks: 'not entered', notEntered: ['Seann Triubhas (3+1)'] })
    const g44 = view.moreAgeGroups.find((g: Json) => g.id === 'g44')
    assert.deepEqual(g44, { id: 'g44', name: 'Premier 14 & Under 16 Years', callbacks: 'not entered' })
  })
})
