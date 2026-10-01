import { ref as dbRef } from 'firebase/database'
import { database } from '@/firebase'
import { getSaved, onReconnect, onValueSaved } from '@/lib/offline'
import {
  danceFullName,
  dancerFullName,
  groupFullName,
  type Category,
  type Dance,
  type Dancer,
  type DrawsTree,
  type EnrichedDance,
  type EnrichedDancer,
  type EnrichedGroup,
  type Group,
  type Platform,
  type PointsTree,
  type ResultsTree,
  type Schedule,
  type StaffMember,
} from '@/types/competition'

// Cached, promise-shared loaders for a competition's data sections. The
// competition screens and Home (which shows several competitions at once)
// share one fetch per section per session. On competition day the same
// bundles stream instead (`watch*`), so late entries, a redrawn order or a
// changed schedule show up without a restart; each update also refreshes
// the cache.

const NAMESPACE = import.meta.env.VITE_FIREBASE_DATA_NAMESPACE || 'production'

type Section =
  | 'dancers'
  | 'groups'
  | 'categories'
  | 'dances'
  | 'results'
  | 'points'
  | 'schedule'
  | 'platforms'
  | 'draws'
  | 'staff'

const sectionRef = (id: string, section: Section) =>
  dbRef(database, `${NAMESPACE}/competitions:data/${id}/${section}`)

export function snapshotToArray<T extends { id: string }>(
  value: Record<string, Omit<T, 'id'>> | null,
): T[] {
  if (!value || typeof value !== 'object') return []
  return Object.entries(value).map(([id, v]) => ({ id, ...v }) as T)
}

// Push ids sort by creation time only when compared byte by byte, as Firebase
// does. `localeCompare` ignores case, so "-LEgsiq…" would land before "-LEgsT0…".
export const compareKeys = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)

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

// --- Raw section values → what the screens use.

function toDancersBundle(dancersVal: unknown, groupsVal: unknown, categoriesVal: unknown): DancersBundle {
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
    .filter((d) => d.firstName || d.lastName)
    .map<EnrichedDancer>((d) => {
      // RTDB stores `number` as a string; coerce so numeric sort works.
      const parsed = typeof d.number === 'string' ? Number.parseInt(d.number, 10) : d.number
      return {
        ...d,
        number: Number.isFinite(parsed as number) ? (parsed as number) : undefined,
        fullName: dancerFullName(d),
        group: d.groupId ? groupsById.get(d.groupId) : undefined,
      }
    })

  return {
    dancers,
    groups: [...groupsById.values()].sort(byDragOrder),
    categories: [...rawCategories].sort(byDragOrder),
  }
}

function toResults(resultsVal: unknown, pointsVal: unknown) {
  return {
    results: (resultsVal && typeof resultsVal === 'object' ? resultsVal : {}) as ResultsTree,
    points: (pointsVal && typeof pointsVal === 'object' ? pointsVal : {}) as PointsTree,
  }
}

function toResultsBundle(dancesVal: unknown, resultsVal: unknown, pointsVal: unknown): ResultsBundle {
  const dances = snapshotToArray<Dance>(dancesVal as Record<string, Dance> | null)
    .map<EnrichedDance>((d) => ({ ...d, fullName: danceFullName(d) }))
    .sort(byDragOrder)
  return { dances, ...toResults(resultsVal, pointsVal), hidden: resultsVal === false }
}

// RTDB stores `false` for admin-disabled sections and `null` for never-created.
function toScheduleBundle(scheduleVal: unknown, platformsVal: unknown, drawsVal: unknown): ScheduleBundle {
  return {
    schedule: scheduleVal && typeof scheduleVal === 'object' ? (scheduleVal as Schedule) : null,
    platforms: snapshotToArray<Platform>(platformsVal as Record<string, Platform> | null).sort(byDragOrder),
    draws: drawsVal && typeof drawsVal === 'object' ? (drawsVal as DrawsTree) : {},
    hidden: scheduleVal === false,
  }
}

const toStaff = (val: unknown) => snapshotToArray<StaffMember>(val as Record<string, StaffMember> | null).sort(byDragOrder)

// --- One-off reads, cached per session.

const caches = {
  dancers: new Map<string, Promise<DancersBundle>>(),
  results: new Map<string, Promise<ResultsBundle>>(),
  schedule: new Map<string, Promise<ScheduleBundle>>(),
  staff: new Map<string, Promise<StaffMember[]>>(),
}

// Anything read while offline may be a saved copy: fetch afresh next time.
onReconnect(() => {
  for (const map of Object.values(caches)) map.clear()
})

/** Drop everything cached for one competition (after an organiser edits it). */
export function forgetCompetition(id: string) {
  for (const map of Object.values(caches)) map.delete(id)
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

const readAll = (id: string, sections: Section[]) =>
  Promise.all(sections.map((s) => getSaved(sectionRef(id, s)).then((snap) => snap.val())))

export function fetchDancers(id: string): Promise<DancersBundle> {
  return cached(caches.dancers, id, async () => {
    const [d, g, c] = await readAll(id, ['dancers', 'groups', 'categories'])
    return toDancersBundle(d, g, c)
  })
}

export function fetchResults(id: string): Promise<ResultsBundle> {
  return cached(caches.results, id, async () => {
    const [d, r, p] = await readAll(id, ['dances', 'results', 'points'])
    return toResultsBundle(d, r, p)
  })
}

export function fetchSchedule(id: string): Promise<ScheduleBundle> {
  return cached(caches.schedule, id, async () => {
    const [s, p, d] = await readAll(id, ['schedule', 'platforms', 'draws'])
    return toScheduleBundle(s, p, d)
  })
}

export function fetchStaff(id: string): Promise<StaffMember[]> {
  return cached(caches.staff, id, async () => {
    const [s] = await readAll(id, ['staff'])
    return toStaff(s)
  })
}

// --- Streams, for competition day.

type OnError = (e: Error) => void

/**
 * Stream several sections together: calls back once every one has a value,
 * then on every change. Starts from the copy saved on the device when
 * offline. Returns an unsubscribe function.
 */
function watchSections(id: string, sections: Section[], cb: (values: unknown[]) => void, onError?: OnError) {
  const values: unknown[] = new Array(sections.length)
  const got = new Set<number>()
  const offs = sections.map((s, i) =>
    onValueSaved(
      sectionRef(id, s),
      (snap) => {
        values[i] = snap.val()
        got.add(i)
        if (got.size === sections.length) cb([...values])
      },
      onError,
    ),
  )
  return () => offs.forEach((off) => off())
}

export function watchDancers(id: string, cb: (b: DancersBundle) => void, onError?: OnError) {
  return watchSections(id, ['dancers', 'groups', 'categories'], ([d, g, c]) => {
    const b = toDancersBundle(d, g, c)
    caches.dancers.set(id, Promise.resolve(b))
    cb(b)
  }, onError)
}

export function watchResults(id: string, cb: (b: ResultsBundle) => void, onError?: OnError) {
  return watchSections(id, ['dances', 'results', 'points'], ([d, r, p]) => {
    const b = toResultsBundle(d, r, p)
    caches.results.set(id, Promise.resolve(b))
    cb(b)
  }, onError)
}

export function watchSchedule(id: string, cb: (b: ScheduleBundle) => void, onError?: OnError) {
  return watchSections(id, ['schedule', 'platforms', 'draws'], ([s, p, d]) => {
    const b = toScheduleBundle(s, p, d)
    caches.schedule.set(id, Promise.resolve(b))
    cb(b)
  }, onError)
}

export function watchStaff(id: string, cb: (staff: StaffMember[]) => void, onError?: OnError) {
  return watchSections(id, ['staff'], ([s]) => {
    const staff = toStaff(s)
    caches.staff.set(id, Promise.resolve(staff))
    cb(staff)
  }, onError)
}
