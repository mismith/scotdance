import { allCapitals, isShouting, known, learn, spelled } from '@/lib/capitals'

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
// Dancers are matched to existing ones by competitor number within their age
// group, so importing an updated list changes people rather than duplicating
// them. A number in another age group is always another entry.
//
// Duets, trios and groups (ADR 0012) come in the same list, by two plain
// rules and nothing else: names joined by "&" (or on separate lines in one
// cell) are several dancers, and rows with the same number in the same age
// group are one entry, a dancer on each row.

import type { MemberName } from '@/lib/admin/teamReader'
import { listToMembers, membersToList } from '@/lib/admin/teamMembers'
import { legacyNames } from '@/lib/entries'
import type { TeamMember } from '@/types/competition'

export type Grid = string[][]

export interface ImportedDancer {
  row: number
  number: string
  firstName: string
  lastName: string
  location: string
  /** From a Studio column (or the program's sixth). */
  studio?: string
  /** From a Routine or Title column. */
  title?: string
  /** From a Dancers column: one or more names, as typed. */
  members?: string
  /** Its dancers, once rows with the same number are one entry (`entriesOf`). */
  names?: MemberName[]
  /** Category and age range, as written in the file. */
  category: string
  group: string
}

export interface ParseResult {
  layout: 'program' | 'table'
  dancers: ImportedDancer[]
  /** Which column each field came from (-1 = none). */
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
  // A heading line on its own ("Premier 12 & Under 14") may have no tabs:
  // the next few lines say whether cells were pasted.
  const head = lines.split('\n').slice(0, 20).join('\n')
  // Excel uses semicolons where the comma is the decimal point (e.g. French).
  const sep = head.includes('\t') ? '\t' : first.includes(';') && !first.includes(',') ? ';' : ','
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
/** A studio's name, never an email, a phone number, a tick or a number. */
const studioCell = (v: string | undefined) => {
  const t = (v ?? '').trim()
  return t.length > 2 && !/@|\d{3}/.test(t) ? t : ''
}
const blank = (r: string[]) => r.every((c) => !c)

/** "Premier 16 & Under 18 Years" → category "Premier", age range "16 & Under 18 Years". Separators between them ("Beginner / 8 & Under") are dropped. */
export function splitGroupTitle(title: string): { category: string; group: string } {
  const t = title.replace(/\s+/g, ' ').trim()
  const i = t.search(/\d/)
  if (i < 0) return { category: t, group: '' }
  return { category: t.slice(0, i).replace(/[\s/|:,–—-]+$/, ''), group: t.slice(i).trim() }
}

function looksLikeProgram(grid: Grid): boolean {
  const dancerRows = grid.filter((r) => isNumberCell(r[0] ?? '') && (r[1] || r[2])).length
  const headingRows = grid.filter((r) => r[0] && !isNumberCell(r[0]) && r.slice(1).every((c) => !c)).length
  return dancerRows > 0 && headingRows > 0
}

/** "Mary Ann Smith" → first word, then the rest (fix odd ones after import). "Smith, Mary Ann" too. */
export function splitFullName(name: string) {
  const comma = name.indexOf(',')
  if (comma > 0) return { firstName: name.slice(comma + 1).trim(), lastName: name.slice(0, comma).trim() }
  const parts = name.split(' ')
  const firstName = parts.shift() ?? ''
  return { firstName, lastName: parts.join(' ') }
}

/** "Lily Siecker & Grace Thompson": two dancers, not one name to split. */
const isPair = (name: string) => /&|\band\b|\+/i.test(name)

/**
 * Whole names read into First name, with no last names anywhere: a sheet
 * with one name column that didn't look like one (number, name, an empty
 * column, location), or a First name column typed in full. Most names, not
 * all: one "Mary Jane" with no last name is just a name. The same rule as
 * System admin › Dancer cleanup (functions/src/combinedNames).
 */
export function hasWholeNames(dancers: ImportedDancer[]): boolean {
  const named = dancers.filter((d) => (d.firstName.trim() || d.lastName.trim()) && !isPair(d.firstName))
  if (named.some((d) => d.lastName.trim())) return false
  const whole = named.filter((d) => /[ ,]/.test(d.firstName.trim()))
  return whole.length >= 3 && whole.length >= named.length * 0.6
}

/** Each whole name split as a combined name column is; pairs left as they are. */
export function splitWholeNames(dancers: ImportedDancer[]): ImportedDancer[] {
  return dancers.map((d) => (!d.lastName.trim() && !isPair(d.firstName) ? { ...d, ...splitFullName(d.firstName.trim()) } : d))
}

/** Whether a list has names typed in capitals ("MARY MACKENZIE"). */
export function hasCapitals(dancers: ImportedDancer[]): boolean {
  return dancers.some((d) => isShouting(d.firstName) || isShouting(d.lastName))
}

/** What's typed in a competition already, to spell a list in capitals by. */
export interface ExistingText {
  names: string[]
  locations: string[]
  /** Category and age group names. */
  groups: string[]
}

/**
 * A list's text in capitals written as it's spelled (lib/capitals): the
 * competition's own spellings first, so a name fixed by hand stays fixed when
 * the list's imported again, then the rest of the list's. In a list typed in
 * capitals, every name with no small letters, short ones too ("MIA LEE");
 * short words in a location are a state or country (VIC, ON), so stay.
 */
export function spellCapitals(dancers: ImportedDancer[], existing: ExistingText): ImportedDancer[] {
  const names = known(learn([...existing.names, ...dancers.flatMap((d) => [d.firstName, d.lastName])]))
  const locations = known(learn([...existing.locations, ...dancers.map((d) => d.location)]))
  const groups = known(learn([...existing.groups, ...dancers.flatMap((d) => [d.category, d.group])]))
  const loud = hasCapitals(dancers)
  const name = (s: string) => ((loud ? allCapitals(s) : isShouting(s, names)) ? spelled(s, names) : s)
  const other = (s: string, dict: Map<string, string>) => (isShouting(s, dict) ? spelled(s, dict) : s)
  return dancers.map((d) => ({
    ...d,
    firstName: name(d.firstName),
    lastName: name(d.lastName),
    location: isShouting(d.location) ? spelled(d.location, locations) : d.location,
    category: other(d.category, groups),
    group: other(d.group, groups),
  }))
}

/** Which column holds what in a program, unless the organiser says otherwise. */
export function programColumns(grid: Grid): Record<TableField, number> {
  // Some programs (and scotdance-splits with names combined) have three
  // columns: number, full name, location. Spot it from the whole sheet:
  // nothing past the third column, and the names mostly have spaces.
  const rows = grid.filter((r) => isNumberCell(r[0] ?? ''))
  // (Not rows of several dancers: "Isla Grant & Mairi Shaw" isn't one dancer's full name.)
  const combined =
    rows.length > 0 &&
    rows.every((r) => !r[3] && !r[4]) &&
    !rows.some((r) => /&|\band\b/.test(r[2] ?? '') && (r[2] ?? '').split(/\s+/).length >= 4) &&
    rows.filter((r) => /[ ,]/.test(r[1] ?? '') && !/&|\band\b/.test(r[1] ?? '')).length >= rows.length * 0.6
  // A Studio column only where a heading says so (the template's does): a
  // program's other columns hold ages, ticks, notes, even a parent's email.
  const studioAt = (() => {
    for (const r of grid.slice(0, 15)) {
      const i = r.findIndex((c, n) => n >= 3 && FIELD_PATTERNS.studio.test(c ?? ''))
      if (i >= 0) return i
    }
    return -1
  })()
  const none = { number: -1, firstName: -1, lastName: -1, fullName: -1, location: -1, group: -1, category: -1, studio: -1, title: -1, members: -1 }
  return combined ? { ...none, number: 0, fullName: 1, location: 2 } : { ...none, number: 0, firstName: 1, lastName: 2, location: 3, studio: studioAt }
}

function parseProgram(grid: Grid, columns = programColumns(grid)): ImportedDancer[] {
  const out: ImportedDancer[] = []
  const at = (r: string[], field: TableField) => (columns[field] >= 0 ? (r[columns[field]] ?? '') : '')
  let current = { category: '', group: '' }
  grid.forEach((r, i) => {
    if (blank(r)) return
    const first = r[0] ?? ''
    // A dancer without a number still shows, so the plan can say so.
    if (isNumberCell(first) || (!first && (r[1] || r[2]) && !headingHits(r))) {
      let names = { firstName: at(r, 'firstName'), lastName: at(r, 'lastName') }
      if (!names.firstName && !names.lastName && at(r, 'fullName')) names = splitFullName(at(r, 'fullName'))
      const extra = Object.fromEntries(
        (['studio', 'title', 'members'] as const).map((f) => [f, f === 'studio' ? studioCell(at(r, f)) : at(r, f)]).filter(([, v]) => v),
      )
      out.push({ row: i + 1, number: at(r, 'number') || first, ...names, location: at(r, 'location'), ...extra, ...current })
    } else if (first && r.slice(1).every((c) => !c) && !/^category\s*\/\s*age group$/i.test(first)) {
      current = splitGroupTitle(first)
    }
  })
  return out
}

export type TableField = 'number' | 'firstName' | 'lastName' | 'fullName' | 'location' | 'group' | 'category' | 'studio' | 'title' | 'members'

const FIELD_PATTERNS: Record<TableField, RegExp> = {
  studio: /^(studio|school|dance school|teacher|club|studio\s*\/\s*teacher)$/i,
  title: /^(routine|title|song|team name|routine name|choreography)$/i,
  members: /^(dancers|members|team members|dancers in team)$/i,
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
    const extra = Object.fromEntries(
      (['studio', 'title', 'members'] as const).map((f) => [f, f === 'studio' ? studioCell(at(r, f)) : at(r, f)]).filter(([, v]) => v),
    )
    out.push({ row: headerRow + i + 2, number: at(r, 'number'), firstName, lastName, location: at(r, 'location'), category, group, ...extra })
  })
  return out
}

/** `chosen`: the organiser's own choice of which column holds what. */
export function parseGrid(grid: Grid, chosen?: Record<TableField, number> | null): ParseResult | null {
  const header = findHeaderRow(grid)
  const columns = header >= 0 ? guessColumns(grid[header]) : null
  const table = (c: Record<TableField, number>): ParseResult => ({ layout: 'table', dancers: parseTable(grid, header, c), columns: c, headers: grid[header] })
  // Headings with an age group column make a table, even under a title (which
  // would otherwise pass for a program's first heading).
  if (columns && (columns.group >= 0 || columns.category >= 0)) return table(chosen ?? columns)
  if (looksLikeProgram(grid)) {
    const c = chosen ?? programColumns(grid)
    return { layout: 'program', dancers: parseProgram(grid, c), columns: c }
  }
  return columns ? table(chosen ?? columns) : null
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
export interface ExistingGroup { id: string; name?: string; categoryId?: string; teams?: boolean }
export interface ExistingDancer {
  id: string
  num: string
  firstName?: string
  lastName?: string
  location?: string
  groupId?: string
  label: string
  team?: boolean
  title?: string
  studio?: string
  members?: Record<string, TeamMember>
}

export type RowStatus = 'new' | 'changed' | 'same' | 'error'

/** Dancer fields an import can change, with how the plan names them. */
const FIELDS = [
  ['firstName', 'First name'],
  ['lastName', 'Last name'],
  ['location', 'Location'],
  ['title', 'Routine'],
  ['studio', 'Studio'],
] as const

/** A team as read from a row: its title, dancers and studio, and what to check. */
export interface ImportedTeam {
  title: string
  members: MemberName[]
  studio: string
  location: string
  unsure: string[]
}

const membersText = (members: MemberName[]) => members.map((m) => `${m.firstName} ${m.lastName}`.trim()).join(', ')

/** Names in one cell, when it holds several: "Ava Reid & Mia Lee", or one per line. */
const SEVERAL = /&|\n/
const listOf = (text: string): MemberName[] =>
  text
    .split(/\s*(?:&|,|;|\n)\s*/)
    .map((n) => n.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .map(splitFullName)

/** A row's dancers: from a Dancers column, else its first and last name (one of them may hold a list). */
export function readNames(r: Pick<ImportedDancer, 'firstName' | 'lastName' | 'members'>): MemberName[] {
  if (r.members?.trim()) return listOf(r.members)
  const first = r.firstName.trim()
  const last = r.lastName.trim()
  if (SEVERAL.test(first) || SEVERAL.test(last)) return listOf(`${first} ${last}`)
  // A whole name typed in one cell.
  if (!first && last) return [splitFullName(last)]
  if (first && !last && first.includes(' ')) return [splitFullName(first)]
  return first || last ? [{ firstName: first, lastName: last }] : []
}

/**
 * The file's rows as entries: rows with the same number in the same age
 * group are one, a dancer on each row, keeping the first row's place.
 */
export function entriesOf(rows: ImportedDancer[]): ImportedDancer[] {
  const out: ImportedDancer[] = []
  const byKey = new Map<string, ImportedDancer>()
  for (const r of rows) {
    const key = r.number ? `${r.number}#${norm(r.category)}|${norm(r.group)}` : null
    const names = readNames(r)
    const into = key ? byKey.get(key) : undefined
    if (!into) {
      const entry = { ...r, names }
      out.push(entry)
      if (key) byKey.set(key, entry)
      continue
    }
    into.names = [...(into.names ?? []), ...names]
    for (const f of ['title', 'studio', 'location'] as const) if (!into[f] && r[f]) into[f] = r[f]
  }
  return out
}

export interface PlannedDancer {
  source: ImportedDancer
  status: RowStatus
  errors: string[]
  existingId?: string
  /** Field → [before, after] for changed rows. */
  changes: Record<string, [string, string]>
  groupKey: string
  /** Several dancers: the duet, trio or group it reads as. */
  team?: ImportedTeam
}

export interface ImportPlan {
  newCategories: string[]
  newGroups: Array<{ key: string; category: string; group: string }>
  /** What the file has for teams: fields it doesn't have are left alone on teams already here. */
  teamFields: Array<'title' | 'members' | 'studio' | 'location'>
  dancers: PlannedDancer[]
  /** Existing entries (number in an age group) the file doesn't have. */
  missing: ExistingDancer[]
  counts: Record<RowStatus, number>
}

export function planImport(
  fileRows: ImportedDancer[],
  existing: { categories: ExistingCategory[]; groups: ExistingGroup[]; dancers: ExistingDancer[] },
): ImportPlan {
  // Each entry once, with its dancers; one dancer's name in their own fields.
  const rows = entriesOf(fileRows).map((r) =>
    (r.names?.length ?? 0) === 1 ? { ...r, firstName: r.names![0].firstName, lastName: r.names![0].lastName } : r,
  )
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

  const newCategories = new Map<string, string>()
  const newGroups = new Map<string, { key: string; category: string; group: string }>()
  const matched = new Set<string>()
  // A column nobody filled in (e.g. no locations in this file) leaves what's
  // there alone rather than clearing it.
  const compared = FIELDS.filter(([key]) => rows.some((r) => r[key]))
  // Several dancers: a duet, trio or group. As for dancers, only what any of them in the file has.
  const teamsRead = new Map<ImportedDancer, ImportedTeam>()
  for (const r of rows) {
    if ((r.names?.length ?? 0) >= 2) teamsRead.set(r, { title: r.title ?? '', members: r.names!, studio: r.studio ?? '', location: r.location ?? '', unsure: [] })
  }
  const teamFields = (['title', 'members', 'studio', 'location'] as const).filter((f) =>
    [...teamsRead.values()].some((t) => (f === 'members' ? t.members.length : t[f])),
  )

  const dancers: PlannedDancer[] = rows.map((r) => {
    const errors: string[] = []
    const key = groupKey(r.category, r.group)
    const team = teamsRead.get(r)
    if (!r.number) errors.push('No number')
    else if (!isNumberCell(r.number)) errors.push(`Number “${r.number}” should be digits, like 101`)
    if (team ? !team.title && !team.members.length && !team.studio : !r.firstName && !r.lastName) errors.push('No name')
    if (!r.category && !r.group) errors.push('No age group')
    if (r.category || r.group) {
      if (!groupByKey.has(key)) newGroups.set(key, { key, category: r.category, group: r.group })
      if (r.category && !catByName.has(norm(r.category))) newCategories.set(norm(r.category), r.category)
    }
    // Same number and age group: the same entry. Anything else is new; the
    // organiser's grouping is never second-guessed.
    const prev = byNumAndGroup.get(`${r.number}#${key}`)
    if (prev && !errors.length) matched.add(prev.id)
    const changes: Record<string, [string, string]> = {}
    if (prev && !errors.length) {
      // Spacing doesn't count as a change; fixing capitals does.
      const tidy = (s: string) => s.replace(/\s+/g, ' ').trim()
      if (team) {
        // A team: its title, dancers, studio and location as read (one typed as a dancer before becomes one).
        if (!prev.team) changes['Dancers'] = [prev.label, membersText(team.members)]
        const was = { title: prev.team ? prev.title ?? '' : '', members: prev.team ? membersText(membersToList(prev.members)) : '', studio: prev.studio ?? '', location: prev.location ?? '' }
        const now = { title: team.title, members: membersText(team.members), studio: team.studio, location: team.location }
        for (const [k, label] of [['title', 'Routine'], ['members', 'Dancers'], ['studio', 'Studio'], ['location', 'Location']] as const) {
          // A field no team in the file has is left as it is, as for dancers (unless it's becoming a team).
          if (prev.team && !teamFields.includes(k)) continue
          if (tidy(was[k]) !== tidy(now[k])) changes[label] = [was[k], now[k]]
        }
      } else {
        for (const [field, label] of compared) if (tidy(prev[field] ?? '') !== tidy(r[field] ?? '')) changes[label] = [prev[field] ?? '', r[field] ?? '']
      }
    }
    const status: RowStatus = errors.length ? 'error' : !prev ? 'new' : Object.keys(changes).length ? 'changed' : 'same'
    return { source: r, status, errors, existingId: prev?.id, changes, groupKey: key, ...(team && { team }) }
  })

  const missing = existing.dancers.filter((d) => !matched.has(d.id) && !dancers.some((p) => p.existingId === d.id))
  const counts = { new: 0, changed: 0, same: 0, error: 0 } as Record<RowStatus, number>
  for (const d of dancers) counts[d.status] += 1
  return { newCategories: [...newCategories.values()], newGroups: [...newGroups.values()], teamFields: [...teamFields], dancers, missing, counts }
}

/** The database writes for a plan (relative to competitions:data/{id}). */
export function planUpdates(
  plan: ImportPlan,
  existing: { categories: ExistingCategory[]; groups: ExistingGroup[]; dancers?: ExistingDancer[] },
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
    if (d.team) {
      const prev = d.existingId ? existing.dancers?.find((x) => x.id === d.existingId) : undefined
      const team = {
        team: true,
        number: d.source.number,
        title: d.team.title || null,
        studio: d.team.studio || null,
        location: d.team.location || null,
        // Keys kept for dancers already on the team, so their links stay.
        members: listToMembers(d.team.members, newKey, prev?.team ? prev.members : null),
        groupId: g?.id ?? null,
        categoryId: g?.categoryId ?? null,
      }
      const v3 = legacyNames({ ...team, title: team.title ?? undefined, studio: team.studio ?? undefined, members: team.members ?? undefined })
      const fields = { ...team, ...v3 }
      if (d.existingId) {
        // A team already here keeps what the file doesn't have (its studio, say); v3's copy follows what it ends up with.
        const keep = prev?.team ? (['title', 'members', 'studio', 'location'] as const).filter((f) => !plan.teamFields.includes(f)) : []
        const merged = { ...fields, ...Object.fromEntries(keep.map((f) => [f, prev?.[f] ?? null])) }
        const v3Now = legacyNames({ ...merged, title: merged.title ?? undefined, studio: merged.studio ?? undefined, members: (merged.members as Record<string, TeamMember> | null) ?? undefined })
        for (const [k, v] of Object.entries({ ...merged, ...v3Now })) if (!keep.includes(k as never)) updates[`dancers/${d.existingId}/${k}`] = v
        // A dancer's row made a team: it isn't a person any more.
        if (!prev?.team) updates[`dancers/${d.existingId}/dancerId`] = null
      } else {
        updates[`dancers/${newKey()}`] = Object.fromEntries(Object.entries(fields).filter(([, v]) => v != null))
      }
      continue
    }
    const fields = {
      number: d.source.number,
      firstName: d.source.firstName || null,
      lastName: d.source.lastName || null,
      location: d.source.location || null,
      title: d.source.title || null,
      studio: d.source.studio || null,
      groupId: g?.id ?? null,
      categoryId: g?.categoryId ?? null,
    }
    if (d.existingId) {
      // Update only the fields shown as changed, keeping the rest (and links
      // the server added) as they are.
      for (const [k, label] of FIELDS) if (d.changes[label]) updates[`dancers/${d.existingId}/${k}`] = fields[k]
    } else {
      updates[`dancers/${newKey()}`] = Object.fromEntries(Object.entries(fields).filter(([k, v]) => v != null || !['title', 'studio'].includes(k)))
    }
  }
  if (opts.removeMissing) for (const d of plan.missing) updates[`dancers/${d.id}`] = null
  return updates
}
