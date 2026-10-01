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
// share one fetch per section per session. Live competitions add a realtime
// results subscription on top via `subscribeResults`.

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
}

export interface ScheduleBundle {
  /** null when missing or admin-disabled. */
  schedule: Schedule | null
  platforms: Platform[]
  draws: DrawsTree
}

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

export function fetchDancers(id: string): Promise<DancersBundle> {
  return cached(caches.dancers, id, async () => {
    const [dancersSnap, groupsSnap, categoriesSnap] = await Promise.all([
      getSaved(sectionRef(id, 'dancers')),
      getSaved(sectionRef(id, 'groups')),
      getSaved(sectionRef(id, 'categories')),
    ])
    const rawDancers = snapshotToArray<Dancer>(dancersSnap.val())
    const rawGroups = snapshotToArray<Group>(groupsSnap.val())
    const rawCategories = snapshotToArray<Category>(categoriesSnap.val())

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
  })
}

function toResults(resultsVal: unknown, pointsVal: unknown) {
  return {
    results: (resultsVal && typeof resultsVal === 'object' ? resultsVal : {}) as ResultsTree,
    points: (pointsVal && typeof pointsVal === 'object' ? pointsVal : {}) as PointsTree,
  }
}

export function fetchResults(id: string): Promise<ResultsBundle> {
  return cached(caches.results, id, async () => {
    const [dancesSnap, resultsSnap, pointsSnap] = await Promise.all([
      getSaved(sectionRef(id, 'dances')),
      getSaved(sectionRef(id, 'results')),
      getSaved(sectionRef(id, 'points')),
    ])
    const dances = snapshotToArray<Dance>(dancesSnap.val())
      .map<EnrichedDance>((d) => ({ ...d, fullName: danceFullName(d) }))
      .sort(byDragOrder)
    return { dances, ...toResults(resultsSnap.val(), pointsSnap.val()) }
  })
}

export function fetchSchedule(id: string): Promise<ScheduleBundle> {
  return cached(caches.schedule, id, async () => {
    const [scheduleSnap, platformsSnap, drawsSnap] = await Promise.all([
      getSaved(sectionRef(id, 'schedule')),
      getSaved(sectionRef(id, 'platforms')),
      getSaved(sectionRef(id, 'draws')),
    ])
    // RTDB stores `false` for admin-disabled sections and `null` for never-created.
    const sval = scheduleSnap.val()
    const dval = drawsSnap.val()
    return {
      schedule: sval && typeof sval === 'object' ? (sval as Schedule) : null,
      platforms: snapshotToArray<Platform>(platformsSnap.val()).sort(byDragOrder),
      draws: dval && typeof dval === 'object' ? (dval as DrawsTree) : {},
    }
  })
}

export function fetchStaff(id: string): Promise<StaffMember[]> {
  return cached(caches.staff, id, async () => {
    const snap = await getSaved(sectionRef(id, 'staff'))
    return snapshotToArray<StaffMember>(snap.val()).sort(byDragOrder)
  })
}

/**
 * Realtime results for a live competition. Calls back with the full results
 * and points trees on every change (including the first read). Returns an
 * unsubscribe function.
 */
export function subscribeResults(
  id: string,
  cb: (bundle: { results: ResultsTree; points: PointsTree }) => void,
): () => void {
  let results: unknown = undefined
  let points: unknown = undefined
  let gotResults = false
  let gotPoints = false
  const emit = () => {
    if (gotResults && gotPoints) cb(toResults(results, points))
  }
  const offResults = onValueSaved(sectionRef(id, 'results'), (snap) => {
    results = snap.val()
    gotResults = true
    emit()
  })
  const offPoints = onValueSaved(sectionRef(id, 'points'), (snap) => {
    points = snap.val()
    gotPoints = true
    emit()
  })
  return () => {
    offResults()
    offPoints()
  }
}
