// Turning an organiser's entry list (Excel, CSV, or cells pasted from a
// spreadsheet) into dancers, age groups and categories.
//
// Two layouts are understood:
// - "Program": a heading row per age group ("Premier 16 & Under 18 Years"),
//   followed by rows of number, first name, last name, location. This is
//   the ScotDance template and how most programs are laid out.
// - "Table": a header row (Number, First name, Last name, Location, Age
//   group…) and one dancer per row.
//
// Dancers are matched to existing ones by competitor number, so importing
// an updated list changes people rather than duplicating them.

export type Grid = string[][]

export interface ImportedDancer {
  row: number
  number: string
  firstName: string
  lastName: string
  location: string
  /** Category and age range, as written in the file. */
  category: string
  group: string
}

export interface ParseResult {
  layout: 'program' | 'table'
  dancers: ImportedDancer[]
  /** For tables: which column each field came from (-1 = none). */
  columns?: Record<TableField, number>
  headers?: string[]
}

const clean = (v: unknown) => (v == null ? '' : v instanceof Date ? v.toISOString().slice(0, 10) : String(v)).replace(/\s+/g, ' ').trim()

export function gridFromSheet(rows: unknown[][]): Grid {
  return rows.map((r) => r.map(clean))
}

/** A CSV file's text: UTF-8, else Windows-1252 (what Excel's plain "CSV" saves). */
export function decodeText(bytes: ArrayBuffer | Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return new TextDecoder('windows-1252').decode(bytes)
  }
}

/** CSV or tab-separated text (what copying cells from Excel or Sheets gives). */
export function gridFromText(text: string): Grid {
  const lines = text.replace(/\r\n?/g, '\n')
  const first = lines.split('\n')[0] ?? ''
  // Excel uses semicolons where the comma is the decimal point (e.g. French).
  const sep = first.includes('\t') ? '\t' : first.includes(';') && !first.includes(',') ? ';' : ','
  const rows: Grid = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < lines.length; i += 1) {
    const ch = lines[i]
    if (quoted) {
      if (ch === '"' && lines[i + 1] === '"') {
        cell += '"'
        i += 1
      } else if (ch === '"') quoted = false
      else cell += ch
    } else if (ch === '"' && cell === '') quoted = true
    else if (ch === sep) {
      row.push(clean(cell))
      cell = ''
    } else if (ch === '\n') {
      row.push(clean(cell))
      rows.push(row)
      row = []
      cell = ''
    } else cell += ch
  }
  if (cell || row.length) {
    row.push(clean(cell))
    rows.push(row)
  }
  return rows
}

const isNumberCell = (v: string) => /^\d+[a-z]?$/i.test(v)
const blank = (r: string[]) => r.every((c) => !c)

/** "Premier 16 & Under 18 Years" → category "Premier", age range "16 & Under 18 Years". */
export function splitGroupTitle(title: string): { category: string; group: string } {
  const t = title.replace(/\s+/g, ' ').trim()
  const i = t.search(/\d/)
  if (i < 0) return { category: t, group: '' }
  return { category: t.slice(0, i).trim(), group: t.slice(i).trim() }
}

function looksLikeProgram(grid: Grid): boolean {
  const dancerRows = grid.filter((r) => isNumberCell(r[0] ?? '') && (r[1] || r[2])).length
  const headingRows = grid.filter((r) => r[0] && !isNumberCell(r[0]) && r.slice(1).every((c) => !c)).length
  return dancerRows > 0 && headingRows > 0
}

/** "Mary Ann Smith" → first word, then the rest (fix odd ones after import). "Smith, Mary Ann" too. */
function splitFullName(name: string) {
  const comma = name.indexOf(',')
  if (comma > 0) return { firstName: name.slice(comma + 1).trim(), lastName: name.slice(0, comma).trim() }
  const parts = name.split(' ')
  const firstName = parts.shift() ?? ''
  return { firstName, lastName: parts.join(' ') }
}

function parseProgram(grid: Grid): ImportedDancer[] {
  const out: ImportedDancer[] = []
  let current = { category: '', group: '' }
  // Some programs (and scotdance-splits with names combined) have three
  // columns: number, full name, location. Spot it from the whole sheet:
  // nothing past the third column, and the names mostly have spaces.
  const rows = grid.filter((r) => isNumberCell(r[0] ?? ''))
  const combined = rows.length > 0 && rows.every((r) => !r[3]) && rows.filter((r) => /[ ,]/.test(r[1] ?? '')).length >= rows.length * 0.6
  grid.forEach((r, i) => {
    if (blank(r)) return
    const first = r[0] ?? ''
    // A dancer without a number still shows, so the plan can say so.
    if (isNumberCell(first) || (!first && (r[1] || r[2]) && !headingHits(r))) {
      const names = combined ? splitFullName(r[1] ?? '') : { firstName: r[1] ?? '', lastName: r[2] ?? '' }
      out.push({ row: i + 1, number: first, ...names, location: (combined ? r[2] : r[3]) ?? '', ...current })
    } else if (first && r.slice(1).every((c) => !c) && !/^category\s*\/\s*age group$/i.test(first)) {
      current = splitGroupTitle(first)
    }
  })
  return out
}

export type TableField = 'number' | 'firstName' | 'lastName' | 'fullName' | 'location' | 'group' | 'category'

const FIELD_PATTERNS: Record<TableField, RegExp> = {
  number: /^(#|no\.?|num(ber)?|competitor( number)?|dancer (number|#|no\.?)|bib)$/i,
  firstName: /^(first( name)?|given( name)?|forename)$/i,
  lastName: /^(last( name)?|surname|family( name)?)$/i,
  fullName: /^(name|dancer|dancer name|full name)$/i,
  location: /^(location|from|town|city|province|state|country|region|hometown|place)$/i,
  group: /^(age ?group|group|age|age range|competition|class)$/i,
  category: /^(category|level|cat\.?)$/i,
}

const headingHits = (r: string[]) => r.filter((c) => Object.values(FIELD_PATTERNS).some((p) => p.test(c))).length

function findHeaderRow(grid: Grid): number {
  for (let i = 0; i < Math.min(grid.length, 10); i += 1) {
    if (headingHits(grid[i]) >= 2) return i
  }
  return -1
}

export function guessColumns(headers: string[]): Record<TableField, number> {
  const out = {} as Record<TableField, number>
  for (const field of Object.keys(FIELD_PATTERNS) as TableField[]) out[field] = headers.findIndex((h) => FIELD_PATTERNS[field].test(h))
  return out
}

export function parseTable(grid: Grid, headerRow: number, columns: Record<TableField, number>): ImportedDancer[] {
  const at = (r: string[], field: TableField) => (columns[field] >= 0 ? (r[columns[field]] ?? '') : '')
  const out: ImportedDancer[] = []
  const header = grid[headerRow]?.join('|')
  grid.slice(headerRow + 1).forEach((r, i) => {
    // Skip blanks, and headings repeated down the sheet (as in the template).
    if (blank(r) || r.join('|') === header) return
    let firstName = at(r, 'firstName')
    let lastName = at(r, 'lastName')
    if (!firstName && !lastName && at(r, 'fullName')) ({ firstName, lastName } = splitFullName(at(r, 'fullName')))
    let category = at(r, 'category')
    let group = at(r, 'group')
    if (!category && group) ({ category, group } = splitGroupTitle(group))
    out.push({ row: headerRow + i + 2, number: at(r, 'number'), firstName, lastName, location: at(r, 'location'), category, group })
  })
  return out
}

export function parseGrid(grid: Grid): ParseResult | null {
  const header = findHeaderRow(grid)
  const columns = header >= 0 ? guessColumns(grid[header]) : null
  const table = (c: Record<TableField, number>): ParseResult => ({ layout: 'table', dancers: parseTable(grid, header, c), columns: c, headers: grid[header] })
  // Headings with an age group column make a table, even under a title (which
  // would otherwise pass for a program's first heading).
  if (columns && (columns.group >= 0 || columns.category >= 0)) return table(columns)
  if (looksLikeProgram(grid)) return { layout: 'program', dancers: parseProgram(grid) }
  return columns ? table(columns) : null
}

export function headerRowOf(grid: Grid) {
  return findHeaderRow(grid)
}

/** Pick the sheet most likely to hold the entry list. */
export function pickSheet(sheets: Array<{ sheet: string; grid: Grid }>): number {
  const byName = sheets.findIndex((s) => /program|dancers|entries|entrants|registration/i.test(s.sheet))
  if (byName >= 0) return byName
  const parsable = sheets.findIndex((s) => parseGrid(s.grid)?.dancers.length)
  return parsable >= 0 ? parsable : 0
}

// --- Planning the import against what's already there

export const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').replace(/\s*&\s*/g, ' & ').trim()

export interface ExistingCategory { id: string; name?: string }
export interface ExistingGroup { id: string; name?: string; categoryId?: string }
export interface ExistingDancer { id: string; num: string; firstName?: string; lastName?: string; location?: string; groupId?: string; label: string }

export type RowStatus = 'new' | 'changed' | 'same' | 'error'

/** Dancer fields an import can change, with how the plan names them. */
const FIELDS = [
  ['firstName', 'First name'],
  ['lastName', 'Last name'],
  ['location', 'Location'],
] as const

export interface PlannedDancer {
  source: ImportedDancer
  status: RowStatus
  errors: string[]
  existingId?: string
  /** Field → [before, after] for changed rows. */
  changes: Record<string, [string, string]>
  groupKey: string
}

export interface ImportPlan {
  newCategories: string[]
  newGroups: Array<{ key: string; category: string; group: string }>
  dancers: PlannedDancer[]
  /** Existing dancers whose numbers aren't in the file. */
  missing: ExistingDancer[]
  counts: Record<RowStatus, number>
}

export function planImport(
  rows: ImportedDancer[],
  existing: { categories: ExistingCategory[]; groups: ExistingGroup[]; dancers: ExistingDancer[] },
): ImportPlan {
  const catByName = new Map(existing.categories.map((c) => [norm(c.name ?? ''), c]))
  const groupKey = (category: string, group: string) => `${norm(category)}|${norm(group)}`
  const groupByKey = new Map(
    existing.groups.map((g) => {
      const cat = existing.categories.find((c) => c.id === g.categoryId)
      return [groupKey(cat?.name ?? '', g.name ?? ''), g]
    }),
  )
  // A dancer can be entered in more than one age group with the same number
  // (e.g. a championship as well as their age group): one entry each. So an
  // entry is a number in an age group.
  const existingGroupKey = (d: ExistingDancer) => {
    const g = existing.groups.find((x) => x.id === d.groupId)
    return g ? groupKey(existing.categories.find((c) => c.id === g.categoryId)?.name ?? '', g.name ?? '') : ''
  }
  const byNumAndGroup = new Map(existing.dancers.map((d) => [`${d.num}#${existingGroupKey(d)}`, d]))
  const byNum = new Map<string, ExistingDancer[]>()
  for (const d of existing.dancers) byNum.set(d.num, [...(byNum.get(d.num) ?? []), d])

  const newCategories = new Map<string, string>()
  const newGroups = new Map<string, { key: string; category: string; group: string }>()
  const seenEntries = new Map<string, number>()
  const seenNumbers = new Map<string, number>()
  for (const r of rows) {
    const entry = `${r.number}#${groupKey(r.category, r.group)}`
    seenEntries.set(entry, (seenEntries.get(entry) ?? 0) + 1)
    seenNumbers.set(r.number, (seenNumbers.get(r.number) ?? 0) + 1)
  }
  const matched = new Set<string>()
  // A column nobody filled in (e.g. no locations in this file) leaves what's
  // there alone rather than clearing it.
  const compared = FIELDS.filter(([key]) => rows.some((r) => r[key]))

  const dancers: PlannedDancer[] = rows.map((r) => {
    const errors: string[] = []
    const key = groupKey(r.category, r.group)
    if (!r.number) errors.push('No number')
    else if (!isNumberCell(r.number)) errors.push(`Number “${r.number}” should be digits, like 101`)
    else if ((seenEntries.get(`${r.number}#${key}`) ?? 0) > 1) errors.push(`Number ${r.number} is in this age group more than once`)
    if (!r.firstName && !r.lastName) errors.push('No name')
    if (!r.category && !r.group) errors.push('No age group')
    if (r.category || r.group) {
      if (!groupByKey.has(key)) newGroups.set(key, { key, category: r.category, group: r.group })
      if (r.category && !catByName.has(norm(r.category))) newCategories.set(norm(r.category), r.category)
    }
    // Same number and age group: the same entry. Otherwise, the same number
    // and name (once each) means they moved to another age group.
    let prev = byNumAndGroup.get(`${r.number}#${key}`)
    if (!prev && seenNumbers.get(r.number) === 1 && byNum.get(r.number)?.length === 1) {
      const only = byNum.get(r.number)![0]
      const sameName = norm(`${only.firstName ?? ''} ${only.lastName ?? ''}`) === norm(`${r.firstName} ${r.lastName}`)
      if (sameName) prev = only
    }
    if (prev && matched.has(prev.id)) prev = undefined
    if (prev && !errors.length) matched.add(prev.id)
    const changes: Record<string, [string, string]> = {}
    if (prev && !errors.length) {
      const prevGroup = existing.groups.find((g) => g.id === prev.groupId)
      const prevGroupKey = prevGroup ? groupKey(existing.categories.find((c) => c.id === prevGroup.categoryId)?.name ?? '', prevGroup.name ?? '') : ''
      // Spacing doesn't count as a change; fixing capitals does.
      const tidy = (s: string) => s.replace(/\s+/g, ' ').trim()
      for (const [field, label] of compared) if (tidy(prev[field] ?? '') !== tidy(r[field])) changes[label] = [prev[field] ?? '', r[field]]
      if (prevGroupKey !== key) changes['Age group'] = [prevGroup ? `${existing.categories.find((c) => c.id === prevGroup.categoryId)?.name ?? ''} ${prevGroup.name ?? ''}`.trim() : '', `${r.category} ${r.group}`.trim()]
    }
    const status: RowStatus = errors.length ? 'error' : !prev ? 'new' : Object.keys(changes).length ? 'changed' : 'same'
    return { source: r, status, errors, existingId: prev?.id, changes, groupKey: key }
  })

  const missing = existing.dancers.filter((d) => !matched.has(d.id) && !dancers.some((p) => p.existingId === d.id))
  const counts = { new: 0, changed: 0, same: 0, error: 0 } as Record<RowStatus, number>
  for (const d of dancers) counts[d.status] += 1
  return { newCategories: [...newCategories.values()], newGroups: [...newGroups.values()], dancers, missing, counts }
}

/** The database writes for a plan (relative to competitions:data/{id}). */
export function planUpdates(
  plan: ImportPlan,
  existing: { categories: ExistingCategory[]; groups: ExistingGroup[] },
  newKey: () => string,
  opts: { removeMissing: boolean; nextGroupOrder: number; nextCategoryOrder: number },
): Record<string, unknown> {
  const updates: Record<string, unknown> = {}
  const catIdByName = new Map(existing.categories.map((c) => [norm(c.name ?? ''), c.id]))
  let catOrder = opts.nextCategoryOrder
  for (const name of plan.newCategories) {
    const id = newKey()
    catIdByName.set(norm(name), id)
    updates[`categories/${id}`] = { name, _order: catOrder++ }
  }
  const groupIdByKey = new Map<string, { id: string; categoryId: string | null }>()
  for (const g of existing.groups) {
    const cat = existing.categories.find((c) => c.id === g.categoryId)
    groupIdByKey.set(`${norm(cat?.name ?? '')}|${norm(g.name ?? '')}`, { id: g.id, categoryId: g.categoryId ?? null })
  }
  let groupOrder = opts.nextGroupOrder
  for (const g of plan.newGroups) {
    const id = newKey()
    const categoryId = g.category ? (catIdByName.get(norm(g.category)) ?? null) : null
    groupIdByKey.set(g.key, { id, categoryId })
    updates[`groups/${id}`] = { name: g.group || null, categoryId, _order: groupOrder++ }
  }
  for (const d of plan.dancers) {
    if (d.status === 'error' || d.status === 'same') continue
    const g = groupIdByKey.get(d.groupKey)
    const fields = {
      number: d.source.number,
      firstName: d.source.firstName || null,
      lastName: d.source.lastName || null,
      location: d.source.location || null,
      groupId: g?.id ?? null,
      categoryId: g?.categoryId ?? null,
    }
    if (d.existingId) {
      // Update only the fields shown as changed, keeping the rest (and links
      // the server added) as they are.
      for (const [k, label] of FIELDS) if (d.changes[label]) updates[`dancers/${d.existingId}/${k}`] = fields[k]
      if (d.changes['Age group']) {
        updates[`dancers/${d.existingId}/groupId`] = fields.groupId
        updates[`dancers/${d.existingId}/categoryId`] = fields.categoryId
      }
    } else {
      updates[`dancers/${newKey()}`] = fields
    }
  }
  if (opts.removeMissing) for (const d of plan.missing) updates[`dancers/${d.id}`] = null
  return updates
}
