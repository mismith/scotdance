import { equalTo, orderByChild, query, ref as dbRef, type Query } from 'firebase/database'
import { database } from '@/firebase'
import { competitionChanged, editedCompetition, stampOf } from '@/lib/competitionChanged'
import { enrichTrophyEvents } from '@/lib/trophyEvents'
import { getSavedAt, onReconnect, onValueSaved } from '@/lib/offline'
import { entryName, isTeam, memberName, teamMembers } from '@/lib/entries'
import { compareKeys } from '@shared/util'
import {
  danceFullName,
  dancerFullName,
  groupFullName,
  type TrophyEvent,
  type Category,
  type Dance,
  type Dancer,
  type DrawsTree,
  type EnrichedTrophyEvent,
  type EnrichedDance,
  type EnrichedDancer,
  type EnrichedGroup,
  type Group,
  type Platform,
  type PointsTree,
  type ResultsTree,
  type Schedule,
  type SheetsTree,
  type StaffMember,
} from '@/types/competition'

// Cached, promise-shared loaders for a competition's data sections. The
// competition screens and Home (which shows several competitions at once)
// share one fetch per section per session, and a section already saved on
// the device is re-used while it hasn't changed (see competitionChanged).
// On competition day the same bundles stream instead (`watch*`), so late
// entries, a redrawn order or a changed schedule show up without a restart;
// each update also refreshes the cache.

const NAMESPACE = import.meta.env.VITE_FIREBASE_DATA_NAMESPACE || 'production'

type Section =
  | 'dancers'
  | 'groups'
  | 'categories'
  | 'trophyEvents'
  | 'dances'
  | 'results'
  | 'points'
  | 'schedule'
  | 'platforms'
  | 'draws'
  | 'staff'
  | 'sheets'

const sectionRef = (id: string, section: Section) =>
  dbRef(database, `${NAMESPACE}/competitions:data/${id}/${section}`)

// What's read: a section, or part of one, and the section whose
// last-changed stamp it goes by. `key` names a part's saved copy.
interface Part {
  q: Query
  stamp: Section
  key?: string
  /** An extra: when it can't be read (no saved copy offline, or refused), it's empty rather than failing the rest. */
  optional?: boolean
}
const sections = (id: string, names: Section[]): Part[] => names.map((s) => ({ q: sectionRef(id, s), stamp: s }))
// Trophy events came after the rest, so a copy saved before then has none:
// without them, the dancers still show.
const trophyEventsPart = (id: string): Part => ({ q: sectionRef(id, 'trophyEvents'), stamp: 'trophyEvents', optional: true })
// One person's entries, found by the link back to their profile: Home needs
// those, not everyone else's.
function entriesOf(id: string, personId: string): Part {
  const dancers = sectionRef(id, 'dancers')
  return {
    q: query(dancers, orderByChild('dancerId'), equalTo(personId)),
    stamp: 'dancers',
    key: `${dancers.toString()}?dancerId=${personId}`,
  }
}

// A team's entry by its id: someone's teams aren't found by `dancerId` (it's
// on each member, inside the team), so their profile names them (ADR 0012).
function entryPart(id: string, entryId: string): Part {
  const q = dbRef(database, `${NAMESPACE}/competitions:data/${id}/dancers/${entryId}`)
  return { q, stamp: 'dancers', key: q.toString() }
}

/** Someone's own entries, with their teams' added. */
function withTeams(own: unknown, teamIds: string[], teams: unknown[]) {
  const rows = { ...((own && typeof own === 'object' ? own : {}) as Record<string, unknown>) }
  teamIds.forEach((t, i) => {
    if (teams[i] && typeof teams[i] === 'object') rows[t] = teams[i]
  })
  return rows
}
const entriesKey = (id: string, personId: string, teamIds: string[]) =>
  `${id}/${personId}${teamIds.length ? `+${teamIds.join(',')}` : ''}`

export function snapshotToArray<T extends { id: string }>(
  value: Record<string, Omit<T, 'id'>> | null,
): T[] {
  if (!value || typeof value !== 'object') return []
  return Object.entries(value).map(([id, v]) => ({ id, ...v }) as T)
}

// Push ids sort by creation time only when compared byte by byte, as Firebase
// does. `localeCompare` ignores case, so "-LEgsiq…" would land before "-LEgsT0…".
export { compareKeys }

// Items without `_order` sink to the end; ties broken by push id.
export function byDragOrder<T extends { id: string; _order?: number }>(a: T, b: T) {
  const ao = a._order ?? Number.POSITIVE_INFINITY
  const bo = b._order ?? Number.POSITIVE_INFINITY
  if (ao !== bo) return ao - bo
  return compareKeys(a.id, b.id)
}

export interface DancersBundle {
  dancers: EnrichedDancer[]
  groups: EnrichedGroup[]
  categories: Category[]
  /** Trophies across age groups (lib/trophyEvents). */
  trophyEvents: EnrichedTrophyEvent[]
}

export interface ResultsBundle {
  dances: EnrichedDance[]
  results: ResultsTree
  points: PointsTree
  /** The organiser hid results (stored as `false`). */
  hidden: boolean
}

export interface ScheduleBundle {
  /** null when missing or admin-disabled. */
  schedule: Schedule | null
  platforms: Platform[]
  draws: DrawsTree
  /** The organiser hid the schedule (stored as `false`). */
  hidden: boolean
}

// --- Raw section values → what the screens use (and what Manage › Print lays out).

export function toDancersBundle(dancersVal: unknown, groupsVal: unknown, categoriesVal: unknown, trophyEventsVal?: unknown): DancersBundle {
  const rawDancers = snapshotToArray<Dancer>(dancersVal as Record<string, Dancer> | null)
  const rawGroups = snapshotToArray<Group>(groupsVal as Record<string, Group> | null)
  const rawCategories = snapshotToArray<Category>(categoriesVal as Record<string, Category> | null)

  const categoriesById = new Map(rawCategories.map((c) => [c.id, c]))
  const groupsById = new Map<string, EnrichedGroup>(
    rawGroups.map((g) => {
      const category = g.categoryId ? categoriesById.get(g.categoryId) : undefined
      return [g.id, { ...g, category, fullName: groupFullName(g, category) }]
    }),
  )

  const dancers = rawDancers
    .filter((d) => isTeam(d) || d.firstName || d.lastName)
    .map<EnrichedDancer>((d) => {
      // RTDB stores `number` as a string; coerce so numeric sort works.
      const parsed = typeof d.number === 'string' ? Number.parseInt(d.number, 10) : d.number
      const team = isTeam(d)
      return {
        ...d,
        number: Number.isFinite(parsed as number) ? (parsed as number) : undefined,
        fullName: team ? entryName(d) : dancerFullName(d),
        group: d.groupId ? groupsById.get(d.groupId) : undefined,
        // A team is never a person: only its members have profiles.
        ...(team && {
          dancerId: undefined,
          teamMembers: teamMembers(d).map(([key, m]) => ({ ...m, key, name: memberName(m) })),
        }),
      }
    })

  const groups = [...groupsById.values()].sort(byDragOrder)
  const categories = [...rawCategories].sort(byDragOrder)
  const rawTrophyEvents = snapshotToArray<TrophyEvent>(trophyEventsVal as Record<string, TrophyEvent> | null).filter((a) => a && typeof a === 'object')
  return {
    dancers,
    groups,
    categories,
    trophyEvents: enrichTrophyEvents(rawTrophyEvents.sort(byDragOrder), groups, categories),
  }
}

function toResults(resultsVal: unknown, pointsVal: unknown) {
  return {
    results: (resultsVal && typeof resultsVal === 'object' ? resultsVal : {}) as ResultsTree,
    points: (pointsVal && typeof pointsVal === 'object' ? pointsVal : {}) as PointsTree,
  }
}

export function toResultsBundle(dancesVal: unknown, resultsVal: unknown, pointsVal: unknown): ResultsBundle {
  const dances = snapshotToArray<Dance>(dancesVal as Record<string, Dance> | null)
    .map<EnrichedDance>((d) => ({ ...d, fullName: danceFullName(d) }))
    .sort(byDragOrder)
  return { dances, ...toResults(resultsVal, pointsVal), hidden: resultsVal === false }
}

// RTDB stores `false` for admin-disabled sections and `null` for never-created.
export function toScheduleBundle(scheduleVal: unknown, platformsVal: unknown, drawsVal: unknown): ScheduleBundle {
  return {
    schedule: scheduleVal && typeof scheduleVal === 'object' ? (scheduleVal as Schedule) : null,
    platforms: snapshotToArray<Platform>(platformsVal as Record<string, Platform> | null).sort(byDragOrder),
    draws: drawsVal && typeof drawsVal === 'object' ? (drawsVal as DrawsTree) : {},
    hidden: scheduleVal === false,
  }
}

export const toStaff = (val: unknown) => snapshotToArray<StaffMember>(val as Record<string, StaffMember> | null).sort(byDragOrder)

const toSheets = (val: unknown) => (val && typeof val === 'object' ? val : {}) as SheetsTree

// --- One-off reads, cached per session.

const caches = {
  dancers: new Map<string, Promise<DancersBundle>>(),
  /** By `{competitionId}/{personId}`. */
  entries: new Map<string, Promise<DancersBundle>>(),
  results: new Map<string, Promise<ResultsBundle>>(),
  schedule: new Map<string, Promise<ScheduleBundle>>(),
  staff: new Map<string, Promise<StaffMember[]>>(),
  sheets: new Map<string, Promise<SheetsTree>>(),
}

// Anything read while offline may be a saved copy: fetch afresh next time.
onReconnect(() => {
  for (const map of Object.values(caches)) map.clear()
})

/** Drop everything cached for one competition (after an organiser edits it). */
export function forgetCompetition(id: string) {
  for (const map of Object.values(caches)) map.delete(id)
  for (const key of caches.entries.keys()) if (key.startsWith(`${id}/`)) caches.entries.delete(key)
  editedCompetition(id)
}

function cached<T>(map: Map<string, Promise<T>>, id: string, load: () => Promise<T>) {
  let p = map.get(id)
  if (!p) {
    p = load()
    map.set(id, p)
    // Don't cache failures: the next caller retries.
    p.catch(() => map.delete(id))
  }
  return p
}

const readAll = async (id: string, parts: Part[]) => {
  const changed = await competitionChanged(id)
  return Promise.all(
    parts.map((p) => {
      const read = getSavedAt(p.q, stampOf(changed, p.stamp), p.key).then((snap) => snap.val())
      return p.optional ? read.catch(() => null) : read
    }),
  )
}

export function fetchDancers(id: string): Promise<DancersBundle> {
  return cached(caches.dancers, id, async () => {
    const [d, g, c, a] = await readAll(id, [...sections(id, ['dancers', 'groups', 'categories']), trophyEventsPart(id)])
    return toDancersBundle(d, g, c, a)
  })
}

/** One person's entries (by their profile id) and their teams' (by entry id), with the groups and categories. */
export function fetchEntries(id: string, personId: string, teamIds: string[] = []): Promise<DancersBundle> {
  return cached(caches.entries, entriesKey(id, personId, teamIds), async () => {
    const [d, ...rest] = await readAll(id, [entriesOf(id, personId), ...teamIds.map((t) => entryPart(id, t)), ...sections(id, ['groups', 'categories']), trophyEventsPart(id)])
    const [g, c, a] = rest.slice(teamIds.length)
    return toDancersBundle(withTeams(d, teamIds, rest.slice(0, teamIds.length)), g, c, a)
  })
}

export function fetchResults(id: string): Promise<ResultsBundle> {
  return cached(caches.results, id, async () => {
    const [d, r, p] = await readAll(id, sections(id, ['dances', 'results', 'points']))
    return toResultsBundle(d, r, p)
  })
}

export function fetchSchedule(id: string): Promise<ScheduleBundle> {
  return cached(caches.schedule, id, async () => {
    const [s, p, d] = await readAll(id, sections(id, ['schedule', 'platforms', 'draws']))
    return toScheduleBundle(s, p, d)
  })
}

export function fetchStaff(id: string): Promise<StaffMember[]> {
  return cached(caches.staff, id, async () => {
    const [s] = await readAll(id, sections(id, ['staff']))
    return toStaff(s)
  })
}

// Judges' sheets are extras: a page that can't read them (rules not out yet,
// or offline with no saved copy) shows the results without them, never an
// error. A failed read isn't kept, so the next visit tries again.
export function fetchSheets(id: string): Promise<SheetsTree> {
  return cached(caches.sheets, id, async () => {
    const [s] = await readAll(id, sections(id, ['sheets']))
    return toSheets(s)
  }).catch((e) => {
    console.warn('[sheets] not read', e)
    return {}
  })
}

// --- Streams, for competition day.

type OnError = (e: Error) => void

/**
 * Stream several sections (or parts of them) together: calls back once every one has a value,
 * then on every change. Starts from the copy saved on the device when
 * offline. Returns an unsubscribe function.
 */
function watchParts(parts: Part[], cb: (values: unknown[]) => void, onError?: OnError) {
  const values: unknown[] = new Array(parts.length)
  const got = new Set<number>()
  const arrived = (i: number, value: unknown) => {
    values[i] = value
    got.add(i)
    if (got.size === parts.length) cb([...values])
  }
  const offs = parts.map((p, i) =>
    onValueSaved(
      p.q,
      (snap) => arrived(i, snap.val()),
      p.optional ? () => arrived(i, null) : onError,
      p.key,
    ),
  )
  return () => offs.forEach((off) => off())
}

export function watchDancers(id: string, cb: (b: DancersBundle) => void, onError?: OnError) {
  return watchParts([...sections(id, ['dancers', 'groups', 'categories']), trophyEventsPart(id)], ([d, g, c, a]) => {
    const b = toDancersBundle(d, g, c, a)
    caches.dancers.set(id, Promise.resolve(b))
    cb(b)
  }, onError)
}

/** One person's entries streaming, late ones included, with their teams'. */
export function watchEntries(id: string, personId: string, cb: (b: DancersBundle) => void, onError?: OnError, teamIds: string[] = []) {
  return watchParts([entriesOf(id, personId), ...teamIds.map((t) => entryPart(id, t)), ...sections(id, ['groups', 'categories']), trophyEventsPart(id)], ([d, ...rest]) => {
    const [g, c, a] = rest.slice(teamIds.length)
    const b = toDancersBundle(withTeams(d, teamIds, rest.slice(0, teamIds.length)), g, c, a)
    caches.entries.set(entriesKey(id, personId, teamIds), Promise.resolve(b))
    cb(b)
  }, onError)
}

export function watchResults(id: string, cb: (b: ResultsBundle) => void, onError?: OnError) {
  return watchParts(sections(id, ['dances', 'results', 'points']), ([d, r, p]) => {
    const b = toResultsBundle(d, r, p)
    caches.results.set(id, Promise.resolve(b))
    cb(b)
  }, onError)
}

export function watchSchedule(id: string, cb: (b: ScheduleBundle) => void, onError?: OnError) {
  return watchParts(sections(id, ['schedule', 'platforms', 'draws']), ([s, p, d]) => {
    const b = toScheduleBundle(s, p, d)
    caches.schedule.set(id, Promise.resolve(b))
    cb(b)
  }, onError)
}

export function watchSheets(id: string, cb: (sheets: SheetsTree) => void) {
  return watchParts(
    sections(id, ['sheets']),
    ([s]) => {
      const sheets = toSheets(s)
      caches.sheets.set(id, Promise.resolve(sheets))
      cb(sheets)
    },
    (e) => {
      console.warn('[sheets] not streamed', e)
      cb({})
    },
  )
}

export function watchStaff(id: string, cb: (staff: StaffMember[]) => void, onError?: OnError) {
  return watchParts(sections(id, ['staff']), ([s]) => {
    const staff = toStaff(s)
    caches.staff.set(id, Promise.resolve(staff))
    cb(staff)
  }, onError)
}
