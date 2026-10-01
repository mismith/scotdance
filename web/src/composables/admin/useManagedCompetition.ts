import {
  computed,
  inject,
  onScopeDispose,
  provide,
  ref,
  shallowRef,
  watch,
  type InjectionKey,
  type Ref,
} from 'vue'
import { onValue } from 'firebase/database'
import { dataRef } from '@/firebase'
import { compareKeys, forgetCompetition } from '@/lib/competitionData'
import { forgetCompetitionMeta } from '@/lib/competitionMeta'
import { forgetCompetitionsList } from '@/composables/useCompetitions'
import { newKey, write } from '@/lib/admin/write'
import { at } from '@/lib/admin/collection'
import { record, undo, type HistoryWriter } from '@/lib/admin/history'
import {
  dancerFullName,
  danceFullName,
  groupFullName,
  type Competition,
  type DrawsTree,
  type PointsTree,
  type ResultsTree,
  type Schedule,
} from '@/types/competition'

// Live, editable view of one competition for the Manage screens. Unlike the
// public loaders (session-cached, numbers parsed, nameless dancers dropped),
// this keeps the raw records exactly as stored, so editing never rewrites a
// field nobody touched.

export interface RawCategory { name?: string; _order?: number }
export interface RawGroup { name?: string; categoryId?: string; sponsor?: string; trophy?: string; _order?: number }
export interface RawDance { name?: string; shortName?: string; steps?: string | number; groupIds?: Record<string, boolean>; _order?: number }
export interface RawDancer {
  number?: string | number
  firstName?: string
  lastName?: string
  location?: string
  groupId?: string
  categoryId?: string
  dancerId?: string
}
export interface RawStaff {
  type?: string
  firstName?: string
  lastName?: string
  location?: string
  description?: string
  image?: string
  website?: string
  judgeId?: string
  piperId?: string
  _order?: number
}
export interface RawPlatform { name?: string; description?: string; _order?: number }
export interface RawInvite {
  created?: string
  cancelled?: string
  expires?: string
  accepted?: string
  acceptedBy?: string
  payload?: { email?: string }
}

export interface RawData {
  categories?: Record<string, RawCategory>
  groups?: Record<string, RawGroup>
  dances?: Record<string, RawDance>
  dancers?: Record<string, RawDancer>
  staff?: Record<string, RawStaff>
  platforms?: Record<string, RawPlatform>
  schedule?: Schedule | false
  results?: ResultsTree | false
  points?: PointsTree
  draws?: DrawsTree
  invites?: Record<string, RawInvite>
}

export type WithId<T> = T & { id: string }

export interface MCategory extends WithId<RawCategory> { label: string }
export interface MGroup extends WithId<RawGroup> { label: string; category?: MCategory }
export interface MDance extends WithId<RawDance> { label: string }
export interface MDancer extends WithId<RawDancer> { label: string; num: string; group?: MGroup }
export interface MStaff extends WithId<RawStaff> { label: string }
export interface MPlatform extends WithId<RawPlatform> { label: string }

const byOrder = <T extends { id: string; _order?: number }>(a: T, b: T) => {
  const ao = a._order ?? Number.POSITIVE_INFINITY
  const bo = b._order ?? Number.POSITIVE_INFINITY
  return ao !== bo ? ao - bo : compareKeys(a.id, b.id)
}

function entries<T>(rec: Record<string, T> | undefined | null): Array<WithId<T>> {
  if (!rec || typeof rec !== 'object') return []
  return Object.entries(rec)
    .filter(([, v]) => v && typeof v === 'object')
    .map(([id, v]) => ({ ...v, id }))
}

/** Numeric-aware compare for competitor numbers ("9" before "10", "?" last). */
export function compareNumbers(a: string, b: string) {
  const na = Number.parseInt(a, 10)
  const nb = Number.parseInt(b, 10)
  const fa = Number.isFinite(na)
  const fb = Number.isFinite(nb)
  if (fa && fb && na !== nb) return na - nb
  if (fa !== fb) return fa ? -1 : 1
  return a.localeCompare(b, undefined, { numeric: true })
}

export function createManagedCompetition(competitionId: Ref<string>) {
  const competition = shallowRef<Competition | null>(null)
  const raw = shallowRef<RawData>({})
  const metaLoaded = ref(false)
  const dataLoaded = ref(false)
  const loadError = ref<Error | null>(null)

  let offMeta: (() => void) | null = null
  let offData: (() => void) | null = null

  watch(
    competitionId,
    (id) => {
      offMeta?.()
      offData?.()
      competition.value = null
      raw.value = {}
      metaLoaded.value = false
      dataLoaded.value = false
      loadError.value = null
      if (!id) return
      offMeta = onValue(
        dataRef(`competitions/${id}`),
        (snap) => {
          competition.value = (snap.val() as Competition | null) ?? null
          metaLoaded.value = true
        },
        (e) => {
          loadError.value = e
          metaLoaded.value = true
        },
      )
      offData = onValue(
        dataRef(`competitions:data/${id}`),
        (snap) => {
          raw.value = (snap.val() as RawData | null) ?? {}
          dataLoaded.value = true
        },
        (e) => {
          loadError.value = e
          dataLoaded.value = true
        },
      )
    },
    { immediate: true },
  )
  onScopeDispose(() => {
    offMeta?.()
    offData?.()
  })

  const loaded = computed(() => metaLoaded.value && dataLoaded.value)
  const exists = computed(() => competition.value != null)

  const categories = computed<MCategory[]>(() =>
    entries(raw.value.categories)
      .map((c) => ({ ...c, label: (c.name ?? '').trim() || 'Untitled category' }))
      .sort(byOrder),
  )
  const categoriesById = computed(() => new Map(categories.value.map((c) => [c.id, c])))

  const groups = computed<MGroup[]>(() =>
    entries(raw.value.groups)
      .map((g) => {
        const category = g.categoryId ? categoriesById.value.get(g.categoryId) : undefined
        const label = groupFullName({ id: g.id, name: g.name }, category ? { id: category.id, name: category.name } : undefined)
        return { ...g, category, label: label || 'Untitled age group' }
      })
      .sort(byOrder),
  )
  const groupsById = computed(() => new Map(groups.value.map((g) => [g.id, g])))

  const dances = computed<MDance[]>(() =>
    entries(raw.value.dances)
      .map((d) => ({ ...d, label: danceFullName(d) || 'Untitled dance' }))
      .sort(byOrder),
  )
  const dancesById = computed(() => new Map(dances.value.map((d) => [d.id, d])))

  const dancers = computed<MDancer[]>(() =>
    entries(raw.value.dancers)
      .map((d) => {
        const num = String(d.number ?? '').trim()
        return {
          ...d,
          num,
          label: dancerFullName(d) || 'Unnamed dancer',
          group: d.groupId ? groupsById.value.get(d.groupId) : undefined,
        }
      })
      .sort((a, b) => compareNumbers(a.num, b.num) || a.label.localeCompare(b.label)),
  )
  const dancersById = computed(() => new Map(dancers.value.map((d) => [d.id, d])))

  const staff = computed<MStaff[]>(() =>
    entries(raw.value.staff)
      .map((s) => ({ ...s, label: dancerFullName(s) || 'Unnamed' }))
      .sort(byOrder),
  )
  const judges = computed(() => staff.value.filter((s) => s.type === 'Judge'))
  const sponsors = computed(() => staff.value.filter((s) => s.type === 'Sponsor'))

  const platforms = computed<MPlatform[]>(() =>
    entries(raw.value.platforms)
      .map((p) => ({ ...p, label: (p.name ?? '').trim() || 'Untitled platform' }))
      .sort(byOrder),
  )

  const schedule = computed<Schedule | null>(() => (raw.value.schedule && typeof raw.value.schedule === 'object' ? raw.value.schedule : null))
  const scheduleHidden = computed(() => raw.value.schedule === false)
  const results = computed<ResultsTree>(() => (raw.value.results && typeof raw.value.results === 'object' ? raw.value.results : {}))
  const resultsHidden = computed(() => raw.value.results === false)
  const points = computed<PointsTree>(() => raw.value.points ?? {})
  const draws = computed<DrawsTree>(() => raw.value.draws ?? {})
  const invites = computed(() => entries(raw.value.invites))

  const groupDancers = (groupId: string) => dancers.value.filter((d) => d.groupId === groupId)
  const groupDances = (groupId: string) => dances.value.filter((d) => d.groupIds?.[groupId])

  // Public pages cache what they read for the session; drop that after an
  // edit so they show the change.
  function afterWrite() {
    forgetCompetition(competitionId.value)
    forgetCompetitionMeta(competitionId.value)
  }
  function afterInfoWrite() {
    afterWrite()
    forgetCompetitionsList()
  }

  // Undo history: paths are recorded in full, so one writer can put back both
  // the competition record and its data.
  const dataPrefix = () => `competitions:data/${competitionId.value}/`
  const infoPrefix = () => `competitions/${competitionId.value}/`
  const historyWriter: HistoryWriter = {
    async apply(updates) {
      await write(updates)
      afterInfoWrite()
    },
    read(path) {
      if (path.startsWith(dataPrefix())) return at(raw.value, path.slice(dataPrefix().length))
      if (path.startsWith(infoPrefix())) return at(competition.value, path.slice(infoPrefix().length))
      return undefined
    },
  }

  async function commit(prefix: string, source: unknown, updates: Record<string, unknown>, label: string | null) {
    const prefixed = Object.fromEntries(Object.entries(updates).map(([k, v]) => [`${prefix}${k}`, v]))
    const before = Object.fromEntries(Object.keys(updates).map((k) => [`${prefix}${k}`, at(source, k) ?? null]))
    await write(prefixed)
    return label == null ? 0 : record(competitionId.value, historyWriter, label, before, prefixed)
  }

  /**
   * Save changes under competitions:data/{id}. Paths are relative to it.
   * Returns the change's id in the undo history. A `null` label keeps it out
   * of the history (e.g. invites, which send email when redone).
   */
  async function writeData(updates: Record<string, unknown>, label: string | null = 'Change') {
    const id = await commit(dataPrefix(), raw.value, updates, label)
    afterWrite()
    return id
  }

  /** Save changes under competitions/{id} (name, date, publishing…). */
  async function writeInfo(updates: Record<string, unknown>, label: string | null = 'Change') {
    const id = await commit(infoPrefix(), competition.value, updates, label)
    afterInfoWrite()
    return id
  }

  /** Undo a change (the latest by default), checking nobody has changed it since. */
  const undoChange = (id?: number) => undo(competitionId.value, id)

  return {
    competitionId,
    competition,
    raw,
    loaded,
    exists,
    loadError,
    categories,
    categoriesById,
    groups,
    groupsById,
    dances,
    dancesById,
    dancers,
    dancersById,
    staff,
    judges,
    sponsors,
    platforms,
    schedule,
    scheduleHidden,
    results,
    resultsHidden,
    points,
    draws,
    invites,
    groupDancers,
    groupDances,
    writeData,
    writeInfo,
    undoChange,
    newKey,
  }
}

export type ManagedCompetition = ReturnType<typeof createManagedCompetition>

const key: InjectionKey<ManagedCompetition> = Symbol('managedCompetition')

export function provideManagedCompetition(competitionId: Ref<string>) {
  const ctx = createManagedCompetition(competitionId)
  provide(key, ctx)
  return ctx
}

export function useManagedCompetition(): ManagedCompetition {
  const ctx = inject(key)
  if (!ctx) throw new Error('useManagedCompetition() must be used under the Manage layout')
  return ctx
}

