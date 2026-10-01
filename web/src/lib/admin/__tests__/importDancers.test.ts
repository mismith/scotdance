import { describe, expect, it } from 'vitest'
import {
  decodeText,
  gridFromSheet,
  gridFromText,
  guessColumns,
  parseGrid,
  parseTable,
  pickSheet,
  planImport,
  planUpdates,
  splitGroupTitle,
  type ExistingCategory,
  type ExistingDancer,
  type ExistingGroup,
  type ImportedDancer,
} from '@/lib/admin/importDancers'

// --- helpers

/** Apply planned updates (relative paths) to a plain data tree, as RTDB would. */
function apply(tree: Record<string, unknown>, updates: Record<string, unknown>) {
  const out = structuredClone(tree)
  for (const [path, value] of Object.entries(updates)) {
    const keys = path.split('/')
    let node = out as Record<string, unknown>
    for (const k of keys.slice(0, -1)) {
      if (!node[k] || typeof node[k] !== 'object') node[k] = {}
      node = node[k] as Record<string, unknown>
    }
    const last = keys[keys.length - 1]
    if (value === null || value === undefined) delete node[last]
    else node[last] = structuredClone(value)
  }
  return out
}

interface Tree {
  categories?: Record<string, { name?: string; _order?: number }>
  groups?: Record<string, { name?: string | null; categoryId?: string | null; _order?: number }>
  dancers?: Record<string, { number?: string | number; firstName?: string | null; lastName?: string | null; location?: string | null; groupId?: string | null; categoryId?: string | null }>
}

/** The "existing" shape ImportDancers.vue builds from the live data. */
function existingFrom(tree: Tree) {
  const categories: ExistingCategory[] = Object.entries(tree.categories ?? {}).map(([id, c]) => ({ id, name: c.name }))
  const groups: ExistingGroup[] = Object.entries(tree.groups ?? {}).map(([id, g]) => ({ id, name: g.name ?? undefined, categoryId: g.categoryId ?? undefined }))
  const dancers: ExistingDancer[] = Object.entries(tree.dancers ?? {}).map(([id, d]) => ({
    id,
    num: String(d.number ?? '').trim(),
    firstName: d.firstName ?? undefined,
    lastName: d.lastName ?? undefined,
    location: d.location ?? undefined,
    groupId: d.groupId ?? undefined,
    label: `${d.firstName ?? ''} ${d.lastName ?? ''}`.trim(),
  }))
  return { categories, groups, dancers }
}

function keys() {
  let n = 0
  return () => `k${String(++n).padStart(3, '0')}`
}

/** Plan and apply a whole import, the way ImportDancers.vue does. */
function importInto(tree: Tree, rows: ImportedDancer[], removeMissing = false, newKey = keys()) {
  const existing = existingFrom(tree)
  const plan = planImport(rows, existing)
  const nextOrder = (items: Record<string, { _order?: number }> = {}) =>
    Object.values(items).reduce((max, i) => Math.max(max, typeof i._order === 'number' ? i._order : -1), -1) + 1
  const updates = planUpdates(plan, existing, newKey, {
    removeMissing,
    nextGroupOrder: nextOrder(tree.groups),
    nextCategoryOrder: nextOrder(tree.categories),
  })
  return { plan, updates, tree: apply(tree as Record<string, unknown>, updates) as Tree }
}

const dancersOf = (tree: Tree) =>
  Object.values(tree.dancers ?? {}).map((d) => {
    const g = tree.groups?.[d.groupId ?? '']
    const c = tree.categories?.[g?.categoryId ?? '']
    return `${d.number} ${d.firstName ?? ''} ${d.lastName ?? ''} [${`${c?.name ?? ''} ${g?.name ?? ''}`.trim()}] ${d.location ?? ''}`.trim()
  }).sort()

// --- reading cells

describe('gridFromText', () => {
  it('reads CSV with quotes, embedded commas, doubled quotes and newlines', () => {
    const grid = gridFromText('Number,Name,Location\r\n101,"Reid, Ava","Calgary, AB"\r\n102,"Mia ""Mo"" Lee","Line\nTwo"\r\n')
    expect(grid).toEqual([
      ['Number', 'Name', 'Location'],
      ['101', 'Reid, Ava', 'Calgary, AB'],
      ['102', 'Mia "Mo" Lee', 'Line Two'],
    ])
  })

  it('reads tab-separated cells pasted from a spreadsheet', () => {
    expect(gridFromText('101\tAva\tReid\n102\tMia\tLee')).toEqual([
      ['101', 'Ava', 'Reid'],
      ['102', 'Mia', 'Lee'],
    ])
  })

  it('reads semicolon-separated CSV (Excel in French and other locales)', () => {
    expect(gridFromText('Number;First name;Last name\n101;Ava;Reid')).toEqual([
      ['Number', 'First name', 'Last name'],
      ['101', 'Ava', 'Reid'],
    ])
  })

  it('tidies whitespace, including non-breaking spaces', () => {
    expect(gridFromText('  101 , Ava  , Mac  Donald ')).toEqual([['101', 'Ava', 'Mac Donald']])
  })
})

describe('gridFromSheet', () => {
  it('turns cell values (numbers, dates, nulls) into tidy strings', () => {
    expect(gridFromSheet([[101, ' Ava ', null, true, new Date(Date.UTC(2026, 6, 4))]])).toEqual([['101', 'Ava', '', 'true', '2026-07-04']])
  })
})

describe('splitGroupTitle', () => {
  it.each([
    ['Premier 16 & Under 18 Years', 'Premier', '16 & Under 18 Years'],
    ['Primary', 'Primary', ''],
    ['12 & Over', '', '12 & Over'],
    ['Restricted Premier 18 Years & Over', 'Restricted Premier', '18 Years & Over'],
    ['  Beginner   7  Years ', 'Beginner', '7 Years'],
  ])('%s', (title, category, group) => {
    expect(splitGroupTitle(title)).toEqual({ category, group })
  })
})

// --- layouts

const PROGRAM = [
  ['Category / Age Group', '', '', ''],
  ['Primary', '', '', ''],
  ['101', 'Isla', 'MacDonald', 'Calgary, AB'],
  ['102', 'Ava', 'O’Neill', 'Edmonton, AB'],
  ['', '', '', ''],
  ['Beginner 7 & Under 9 Years', '', '', ''],
  ['Dancer Number', 'First Name', 'Last Name', 'Location'],
  ['201', 'Mia', 'Reid', 'Ottawa, ON'],
  ['202A', 'Seán', 'Ó Briain', ''],
]

describe('parseGrid: program layout', () => {
  it('reads headings and the dancers under them', () => {
    const r = parseGrid(PROGRAM)!
    expect(r.layout).toBe('program')
    expect(r.dancers.map((d) => [d.row, d.number, d.firstName, d.lastName, d.location, d.category, d.group])).toEqual([
      [3, '101', 'Isla', 'MacDonald', 'Calgary, AB', 'Primary', ''],
      [4, '102', 'Ava', 'O’Neill', 'Edmonton, AB', 'Primary', ''],
      [8, '201', 'Mia', 'Reid', 'Ottawa, ON', 'Beginner', '7 & Under 9 Years'],
      [9, '202A', 'Seán', 'Ó Briain', '', 'Beginner', '7 & Under 9 Years'],
    ])
  })

  it('reads three-column programs (number, full name, location)', () => {
    const r = parseGrid([
      ['Novice 10 & Under 12 Years'],
      ['501', 'Kirsty Mackenzie', 'Calgary, AB'],
      ['502', 'Mary Ann Smith', 'Edmonton'],
      ['503', 'Eilidh Campbell', ''],
    ])!
    expect(r.dancers.map((d) => [d.number, d.firstName, d.lastName, d.location])).toEqual([
      ['501', 'Kirsty', 'Mackenzie', 'Calgary, AB'],
      ['502', 'Mary', 'Ann Smith', 'Edmonton'],
      ['503', 'Eilidh', 'Campbell', ''],
    ])
  })

  it('reads "Last, First" full names', () => {
    const r = parseGrid([
      ['Novice 10 & Under 12 Years'],
      ['501', 'Mackenzie, Kirsty', 'Calgary, AB'],
      ['502', 'Smith, Mary Ann', 'Edmonton'],
    ])!
    expect(r.dancers.map((d) => [d.firstName, d.lastName])).toEqual([
      ['Kirsty', 'Mackenzie'],
      ['Mary Ann', 'Smith'],
    ])
  })

  it('keeps a dancer whose number is missing, so the plan can flag them', () => {
    const r = parseGrid([['Primary'], ['', 'Name', 'Location'], ['101', 'Isla', 'MacDonald'], ['', 'Ava', 'Reid']])!
    const plan = planImport(r.dancers, { categories: [], groups: [], dancers: [] })
    expect(plan.dancers.map((d) => [d.source.firstName, d.status, d.errors])).toEqual([
      ['Isla', 'new', []],
      ['Ava', 'error', ['No number']],
    ])
  })
})

describe('parseGrid: table layout', () => {
  const TABLE = [
    ['Number', 'First name', 'Last name', 'Location', 'Age group'],
    ['101', 'Isla', 'MacDonald', 'Calgary, AB', 'Primary'],
    ['', '', '', '', ''],
    ['301', 'Ava', 'Reid', 'Edmonton', 'Premier 12 & Under 14'],
  ]

  it('finds the columns from the headings', () => {
    const r = parseGrid(TABLE)!
    expect(r.layout).toBe('table')
    expect(r.columns).toMatchObject({ number: 0, firstName: 1, lastName: 2, location: 3, group: 4, category: -1 })
    expect(r.dancers.map((d) => [d.row, d.number, d.firstName, d.category, d.group])).toEqual([
      [2, '101', 'Isla', 'Primary', ''],
      [4, '301', 'Ava', 'Premier', '12 & Under 14'],
    ])
  })

  it('is still a table when a title sits above the headings', () => {
    const r = parseGrid([['Calgary Highland Games 2026', '', '', '', ''], ['', '', '', '', ''], ...TABLE])!
    expect(r.layout).toBe('table')
    expect(r.dancers.map((d) => [d.row, d.number, d.firstName, d.lastName, d.location, d.category, d.group])).toEqual([
      [4, '101', 'Isla', 'MacDonald', 'Calgary, AB', 'Primary', ''],
      [6, '301', 'Ava', 'Reid', 'Edmonton', 'Premier', '12 & Under 14'],
    ])
  })

  it('uses separate category and age group columns', () => {
    const r = parseGrid([
      ['#', 'Surname', 'Given name', 'Category', 'Age'],
      ['7', 'Reid', 'Ava', 'Premier', '12 & Under 14 Years'],
    ])!
    expect(r.dancers[0]).toMatchObject({ number: '7', firstName: 'Ava', lastName: 'Reid', category: 'Premier', group: '12 & Under 14 Years' })
  })

  it('splits a single name column', () => {
    const r = parseGrid([
      ['Dancer #', 'Name', 'Competition'],
      ['7', 'Ava Reid', 'Premier 12 & Under 14'],
    ])!
    expect(r.dancers[0]).toMatchObject({ firstName: 'Ava', lastName: 'Reid' })
  })

  it('skips the headings when repeated down the sheet', () => {
    const r = parseGrid([...TABLE, TABLE[0], ['302', 'Mia', 'Lee', '', 'Premier 12 & Under 14']])!
    expect(r.dancers.map((d) => d.number)).toEqual(['101', '301', '302'])
  })

  it('lets columns be chosen by hand', () => {
    const grid = [
      ['Bib', 'Who', 'Where', 'Class'],
      ['5', 'Ava Reid', 'Calgary', 'Premier 12 & Under 14'],
    ]
    const columns = { ...guessColumns(grid[0]), fullName: 1, location: 2 }
    expect(parseTable(grid, 0, columns)[0]).toMatchObject({ number: '5', firstName: 'Ava', lastName: 'Reid', location: 'Calgary', category: 'Premier' })
  })

  it('returns null when nothing looks like a list', () => {
    expect(parseGrid([['hello'], ['world']])).toBeNull()
    expect(parseGrid([])).toBeNull()
  })
})

describe('pickSheet', () => {
  it('prefers a sheet named like an entry list, else the first with dancers', () => {
    const notes = { sheet: 'Notes', grid: [['Read me']] }
    const list = { sheet: 'Sheet2', grid: PROGRAM }
    expect(pickSheet([notes, list])).toBe(1)
    expect(pickSheet([notes, { sheet: 'Entries', grid: [] }, list])).toBe(1)
    expect(pickSheet([notes])).toBe(0)
  })
})

// --- planning against what's there

const row = (number: string, firstName: string, lastName: string, category: string, group: string, location = ''): ImportedDancer => ({
  row: 0,
  number,
  firstName,
  lastName,
  location,
  category,
  group,
})

describe('planImport + planUpdates', () => {
  const FILE = [
    row('101', 'Isla', 'MacDonald', 'Primary', '', 'Calgary, AB'),
    row('102', 'Ava', 'O’Neill', 'Primary', '', 'Edmonton, AB'),
    row('201', 'Mia', 'Reid', 'Beginner', '7 & Under 9 Years', 'Ottawa, ON'),
    // The same dancer in their age group and a championship.
    row('301', 'Freya', 'Ross', 'Premier', '12 & Under 14 Years', 'Vancouver, BC'),
    row('301', 'Freya', 'Ross', 'Premier', 'Championship 12 & Over', 'Vancouver, BC'),
    // The same number in two age groups, for different dancers.
    row('401', 'Seán', 'Ó Briain', 'Novice', '10 Years', 'Glasgow'),
    row('401', 'Ruby', 'Sinclair', 'Intermediate', '10 Years', ''),
  ]

  it('creates categories, age groups and dancers into an empty competition', () => {
    const { plan, tree } = importInto({}, FILE)
    expect(plan.counts).toEqual({ new: 7, changed: 0, same: 0, error: 0 })
    expect(plan.newCategories).toEqual(['Primary', 'Beginner', 'Premier', 'Novice', 'Intermediate'])
    expect(plan.newGroups.map((g) => `${g.category} ${g.group}`.trim())).toEqual([
      'Primary',
      'Beginner 7 & Under 9 Years',
      'Premier 12 & Under 14 Years',
      'Premier Championship 12 & Over',
      'Novice 10 Years',
      'Intermediate 10 Years',
    ])
    expect(dancersOf(tree)).toEqual([
      '101 Isla MacDonald [Primary] Calgary, AB',
      '102 Ava O’Neill [Primary] Edmonton, AB',
      '201 Mia Reid [Beginner 7 & Under 9 Years] Ottawa, ON',
      '301 Freya Ross [Premier 12 & Under 14 Years] Vancouver, BC',
      '301 Freya Ross [Premier Championship 12 & Over] Vancouver, BC',
      '401 Ruby Sinclair [Intermediate 10 Years]',
      '401 Seán Ó Briain [Novice 10 Years] Glasgow',
    ])
    // Categories and groups are ordered after what's there, in file order.
    expect(Object.values(tree.categories!).map((c) => [c.name, c._order])).toEqual([
      ['Primary', 0],
      ['Beginner', 1],
      ['Premier', 2],
      ['Novice', 3],
      ['Intermediate', 4],
    ])
    // Dancers carry their category, like the old admin wrote.
    for (const d of Object.values(tree.dancers!)) expect(d.categoryId).toBe(tree.groups![d.groupId!].categoryId)
  })

  it('changes nothing when the same file is imported again', () => {
    const first = importInto({}, FILE).tree
    const again = importInto(first, FILE)
    expect(again.plan.counts).toEqual({ new: 0, changed: 0, same: 7, error: 0 })
    expect(again.plan.newCategories).toEqual([])
    expect(again.plan.newGroups).toEqual([])
    expect(again.plan.missing).toEqual([])
    expect(again.updates).toEqual({})
  })

  it('matches names and age groups regardless of spacing, case and "&" spacing', () => {
    const first = importInto({}, FILE).tree
    const again = importInto(first, [
      row('201', ' Mia ', 'Reid', 'BEGINNER', '7&under  9 years', 'Ottawa,  ON'),
    ])
    expect(again.plan.dancers[0].status).toBe('same')
    expect(again.plan.newGroups).toEqual([])
  })

  it('treats a capitalisation fix as a change', () => {
    const first = importInto({}, [row('201', 'mia', 'REID', 'Beginner', '7 & Under 9 Years')]).tree
    const again = importInto(first, [row('201', 'Mia', 'Reid', 'Beginner', '7 & Under 9 Years')])
    expect(again.plan.dancers[0].status).toBe('changed')
    expect(dancersOf(again.tree)).toEqual(['201 Mia Reid [Beginner 7 & Under 9 Years]'])
  })

  it('shows changed, moved, new and missing dancers', () => {
    const first = importInto({}, FILE).tree
    const second = importInto(first, [
      row('101', 'Isla', 'Macdonald-Smith', 'Primary', '', 'Calgary, AB'), // changed name
      row('102', 'Ava', 'O’Neill', 'Beginner', '7 & Under 9 Years', 'Edmonton, AB'), // moved
      row('201', 'Mia', 'Reid', 'Beginner', '7 & Under 9 Years', 'Ottawa, ON'), // same
      row('202', 'Lucy', 'Kerr', 'Beginner', '7 & Under 9 Years', 'Halifax, NS'), // new
    ])
    const byNum = Object.fromEntries(second.plan.dancers.map((d) => [d.source.number, d]))
    expect(byNum['101'].status).toBe('changed')
    expect(byNum['101'].changes).toEqual({ 'Last name': ['MacDonald', 'Macdonald-Smith'] })
    expect(byNum['102'].status).toBe('changed')
    expect(byNum['102'].changes).toEqual({ 'Age group': ['Primary', 'Beginner 7 & Under 9 Years'] })
    expect(byNum['201'].status).toBe('same')
    expect(byNum['202'].status).toBe('new')
    expect(second.plan.missing.map((d) => `${d.num} ${d.label}`).sort()).toEqual([
      '301 Freya Ross',
      '301 Freya Ross',
      '401 Ruby Sinclair',
      '401 Seán Ó Briain',
    ])
    // Missing dancers stay unless asked.
    expect(Object.keys(second.tree.dancers!)).toHaveLength(8)
    expect(dancersOf(second.tree)).toContain('102 Ava O’Neill [Beginner 7 & Under 9 Years] Edmonton, AB')
    // Moving keeps the record (and anything linked to it).
    const avaBefore = Object.entries(first.dancers!).find(([, d]) => d.number === '102')![0]
    expect(second.tree.dancers![avaBefore].lastName).toBe('O’Neill')

    const removing = importInto(first, second.plan.dancers.map((d) => d.source), true)
    expect(Object.keys(removing.tree.dancers!)).toHaveLength(4)
  })

  it('leaves fields the file doesn’t have alone', () => {
    const first = importInto({}, FILE).tree
    // A later list without locations, and one dancer in a new age group.
    const again = importInto(first, [
      row('101', 'Isla', 'MacDonald', 'Primary', ''),
      row('201', 'Mia', 'Reid', 'Beginner', '9 & Under 11 Years'),
    ])
    expect(again.plan.counts).toMatchObject({ same: 1, changed: 1 })
    expect(again.plan.dancers[1].changes).toEqual({ 'Age group': ['Beginner 7 & Under 9 Years', 'Beginner 9 & Under 11 Years'] })
    expect(dancersOf(again.tree)).toContain('101 Isla MacDonald [Primary] Calgary, AB')
    expect(dancersOf(again.tree)).toContain('201 Mia Reid [Beginner 9 & Under 11 Years] Ottawa, ON')
  })

  it('flags rows it can’t import and skips them', () => {
    const { plan, tree } = importInto({}, [
      row('', 'No', 'Number', 'Primary', ''),
      row('5', '', '', 'Primary', ''),
      row('6', 'No', 'Group', '', ''),
      row('7', 'Twin', 'One', 'Primary', ''),
      row('7', 'Twin', 'Two', 'Primary', ''),
      row('8', 'Fine', 'Dancer', 'Primary', ''),
      row('#9', 'Odd', 'Number', 'Primary', ''),
    ])
    expect(plan.dancers.map((d) => [d.source.number, d.status, d.errors])).toEqual([
      ['', 'error', ['No number']],
      ['5', 'error', ['No name']],
      ['6', 'error', ['No age group']],
      ['7', 'error', ['Number 7 is in this age group more than once']],
      ['7', 'error', ['Number 7 is in this age group more than once']],
      ['8', 'new', []],
      ['#9', 'error', ['Number “#9” should be digits, like 101']],
    ])
    expect(dancersOf(tree)).toEqual(['8 Fine Dancer [Primary]'])
  })

  it('never lists a dancer with an unimportable row as missing', () => {
    const first = importInto({}, [row('7', 'Ava', 'Reid', 'Primary', '')]).tree
    const again = importInto(first, [row('7', '', '', 'Primary', '')])
    expect(again.plan.dancers[0].status).toBe('error')
    expect(again.plan.missing).toEqual([])
  })

  it('matches legacy records: numbers stored as numbers, odd spacing, no category', () => {
    const legacy: Tree = {
      categories: { c1: { name: 'Novice  Highland' } },
      groups: { g1: { name: '10&under 12', categoryId: 'c1' }, g2: { name: 'Adult' } },
      dancers: {
        d1: { number: 12, firstName: 'Ava', lastName: 'Reid', groupId: 'g1' },
        d2: { number: ' 13 ', firstName: 'Mia', lastName: 'Lee', groupId: 'g2' },
      },
    }
    const again = importInto(legacy, [row('12', 'Ava', 'Reid', 'Novice Highland', '10 & Under 12'), row('13', 'Mia', 'Lee', '', 'Adult')])
    expect(again.plan.dancers.map((d) => d.status)).toEqual(['same', 'same'])
    expect(again.plan.newGroups).toEqual([])
    expect(again.updates).toEqual({})
  })

  it('doesn’t move one record onto two rows', () => {
    const first = importInto({}, [row('7', 'Ava', 'Reid', 'Primary', '')]).tree
    // Ava is now in two other groups: both rows are new; the Primary entry is missing.
    const again = importInto(first, [row('7', 'Ava', 'Reid', 'Beginner', '7 Years'), row('7', 'Ava', 'Reid', 'Beginner', '8 Years')])
    expect(again.plan.dancers.map((d) => d.status)).toEqual(['new', 'new'])
    expect(again.plan.missing.map((d) => d.label)).toEqual(['Ava Reid'])
  })

  it('handles a big list quickly', () => {
    const big = Array.from({ length: 1500 }, (_, i) => row(String(100 + i), `First${i}`, `Last${i}`, `Cat${i % 5}`, `${i % 9} Years`))
    const t0 = performance.now()
    const first = importInto({}, big).tree
    const again = importInto(first, big)
    expect(again.plan.counts.same).toBe(1500)
    expect(performance.now() - t0).toBeLessThan(5000)
  })
})

// --- real files (the same ones the e2e tests upload)

describe('real entry lists', () => {
  // Vitest runs from web/.
  const fixture = (name: string) => `${process.cwd()}/e2e/fixtures/${name}`
  const readXlsx = async (name: string) => {
    const { default: read } = await import('read-excel-file/node')
    return (await read(fixture(name))).map((s) => ({ sheet: s.sheet, grid: gridFromSheet(s.data as unknown[][]) }))
  }
  const readCsv = async (name: string) => {
    const { readFileSync } = await import('node:fs')
    return gridFromText(decodeText(readFileSync(fixture(name))))
  }

  it('reads program.xlsx: picks the program sheet, merged headings, numbers as numbers or text', async () => {
    const sheets = await readXlsx('program.xlsx')
    const i = pickSheet(sheets)
    expect(sheets[i].sheet).toBe('Program')
    const parsed = parseGrid(sheets[i].grid)!
    expect(parsed.layout).toBe('program')
    expect(parsed.dancers.map((d) => `${d.row}: ${d.number} ${d.firstName} ${d.lastName} [${d.category}|${d.group}] ${d.location}`.trim())).toEqual([
      '5: 101 Isla MacDonald [Primary|] Calgary, AB',
      '6: 102 Ava O’Neill [Primary|] Edmonton, AB',
      '7: 103 Seán Ó Briain [Primary|] Glasgow',
      '11: 201 Mia Reid [Beginner|7 & Under 9 Years] Ottawa, ON',
      '12: 202 Ella Grant [Beginner|7 & Under 9 Years]',
      '13: 203A Lucy Kerr [Beginner|7 & Under 9 Years] Halifax, NS',
      '16: 301 Freya Ross [Premier|12 & Under 14 Years] Vancouver, BC',
      '17: 302 Hannah Murray [Premier|12 & Under 14 Years] Calgary, AB',
      // Split at the first digit, as the old admin did (legacy groups match).
      '19: 301 Freya Ross [Premier Championship|12 & Over] Vancouver, BC',
      '20: 401 Ruby Sinclair [Premier Championship|12 & Over] Calgary, AB',
    ])
  })

  it('reads a Windows-1252 CSV and plans the update against the first import', async () => {
    const first = importInto({}, parseGrid((await readXlsx('program.xlsx'))[1].grid)!.dancers).tree
    const grid = await readCsv('program-updated.csv')
    expect(grid[2]).toEqual(['102', 'Ava', 'O’Neill', 'Edmonton, AB'])
    const { plan, tree } = importInto(first, parseGrid(grid)!.dancers, true)
    const summary = plan.dancers.map((d) => `${d.source.number} ${d.status}${Object.keys(d.changes).length ? ` (${Object.keys(d.changes).join(', ')})` : ''}`)
    expect(summary).toEqual([
      '101 changed (Last name)',
      '102 same',
      '103 same',
      '201 same',
      '203A same',
      '204 new',
      '301 same',
      '302 changed (Age group)',
      '301 same',
      '401 same',
    ])
    expect(plan.newGroups.map((g) => `${g.category} ${g.group}`)).toEqual(['Premier 14 & Under 16 Years'])
    expect(plan.missing.map((d) => `${d.num} ${d.label}`)).toEqual(['202 Ella Grant'])
    expect(dancersOf(tree)).toContain('302 Hannah Murray [Premier 14 & Under 16 Years] Calgary, AB')
    expect(dancersOf(tree)).not.toContain('202 Ella Grant [Beginner 7 & Under 9 Years]')
    // And once more: nothing left to do.
    expect(importInto(tree, parseGrid(grid)!.dancers).updates).toEqual({})
  })

  it('reads table.xlsx under its title, once the number column is chosen', async () => {
    const [{ grid }] = await readXlsx('table.xlsx')
    const parsed = parseGrid(grid)!
    expect(parsed.layout).toBe('table')
    expect(parsed.columns).toMatchObject({ number: -1, firstName: 1, lastName: 2, location: 3, category: 4, group: 5 })
    expect(planImport(parsed.dancers, existingFrom({})).counts.error).toBe(3)
    const rows = parseTable(grid, 2, { ...parsed.columns!, number: 0 })
    expect(rows.map((d) => `${d.number} ${d.firstName} ${d.lastName} [${d.category}|${d.group}] ${d.location}`)).toEqual([
      '11 Eilidh Campbell [Novice|10 & Under 12 Years] Calgary, AB',
      '12 Morag Stewart [Novice|10 & Under 12 Years] Edmonton, AB',
      '21 Kirsty Mackenzie [Intermediate|12 Years & Over] Banff, AB',
    ])
  })
})

describe('decodeText', () => {
  it('reads UTF-8 (with or without a byte order mark) and Windows-1252', () => {
    const utf8 = new TextEncoder().encode('Ó Briain, O’Neill')
    expect(decodeText(utf8)).toBe('Ó Briain, O’Neill')
    expect(decodeText(new Uint8Array([0xef, 0xbb, 0xbf, ...utf8]))).toBe('Ó Briain, O’Neill')
    expect(decodeText(new Uint8Array([0xd3, 0x20, 0x42, 0x72, 0x69, 0x61, 0x69, 0x6e, 0x2c, 0x20, 0x4f, 0x92, 0x4e, 0x65, 0x69, 0x6c, 0x6c]))).toBe('Ó Briain, O’Neill')
  })
})
