import {
  computed,
  inject,
  provide,
  ref,
  watch,
  type InjectionKey,
  type Ref,
} from 'vue'
import { child, get } from 'firebase/database'
import { dataRef } from '@/firebase'
import { fetchCompetitionMeta } from '@/lib/competitionMeta'
import { isBeforeToday, parseDate } from '@/lib/format'
import { useRecentDancers } from '@/composables/useRecentDancers'
import { insertEntityAggregate } from '@/composables/useEntityAggregates'
import type { Competition } from '@/types/competition'

// ─── Aggregate-backed dancer profile ─────────────────────────────────────────
// Replaces the v1 slug-based composable (which re-ran Typesense searches on
// every page load) with a single read of `/dancers/{dancerId}`. The route
// param `:dancerId` is now the Firebase push key of the aggregate, not a
// name slug — see ADR-0003 §13.

export interface DancerAppearanceRaw {
  competitionId?: string
  /** Per-comp dancer record id (push key under competitions:data/.../dancers). */
  dancerId?: string
  firstName?: string | null
  lastName?: string | null
  image?: string | null
  location?: string | null
  number?: number | null
}

export interface DancerAggregate {
  name?: string
  appearanceCount?: number
  appearances?: Record<string, DancerAppearanceRaw>
}

export interface DancerAppearance {
  /** {compId}:{perCompDancerId} */
  key: string
  raw: DancerAppearanceRaw
  competition: Competition | null
}

export interface UseDancerProfile {
  loading: Ref<boolean>
  notFound: Ref<boolean>
  displayName: Ref<string>
  image: Ref<string | null>
  location: Ref<string | null>
  appearances: Ref<DancerAppearance[]>
  upcoming: Ref<DancerAppearance[]>
  past: Ref<DancerAppearance[]>
  totalComps: Ref<number>
  compsThisYear: Ref<number>
  firstSeen: Ref<DancerAppearance | null>
  firstSeenDate: Ref<Date | null>
  lastSeen: Ref<DancerAppearance | null>
  lastSeenDate: Ref<Date | null>
  venueCount: Ref<number>
}

const KEY: InjectionKey<UseDancerProfile> = Symbol('dancerProfile')

export function provideDancerProfile(dancerId: Ref<string>): UseDancerProfile {
  const profile = createDancerProfile(dancerId)
  provide(KEY, profile)
  return profile
}

export function useDancerProfile(): UseDancerProfile {
  const injected = inject(KEY, null)
  if (!injected) throw new Error('useDancerProfile() called outside DancerLayout')
  return injected
}

function latestNonNull<T>(
  list: DancerAppearance[],
  pick: (a: DancerAppearance) => T | null | undefined,
): T | null {
  for (const a of list) {
    const v = pick(a)
    if (v != null && v !== '') return v as T
  }
  return null
}

function createDancerProfile(dancerId: Ref<string>): UseDancerProfile {
  const recent = useRecentDancers()
  const loading = ref(false)
  const notFound = ref(false)
  const aggregate = ref<DancerAggregate | null>(null)
  const compMeta = ref<Record<string, Competition | null>>({})

  watch(
    dancerId,
    async (id) => {
      if (!id) {
        aggregate.value = null
        notFound.value = false
        return
      }
      loading.value = true
      notFound.value = false
      try {
        const snap = await get(child(dataRef('dancers'), id))
        const value = snap.val()
        if (value && typeof value === 'object') {
          const agg = value as DancerAggregate
          aggregate.value = agg
          insertEntityAggregate('dancers', id, agg)
          // Record into recentDancers eagerly so back-nav to /dancers has the
          // row in place for the view-transition. The deferred watcher below
          // also calls this on later displayName changes; calling sync here
          // covers the back-before-displayName-settles case.
          const eagerName = agg.name?.trim()
          if (eagerName) recent.record(id, eagerName)
        } else {
          aggregate.value = null
          notFound.value = true
        }
      } catch {
        aggregate.value = null
        notFound.value = true
      } finally {
        loading.value = false
      }
    },
    { immediate: true },
  )

  watch(
    aggregate,
    async (agg) => {
      const apps = agg?.appearances || {}
      const compIds = Array.from(
        new Set(
          Object.values(apps)
            .map((a) => a.competitionId)
            .filter((id): id is string => !!id),
        ),
      ).filter((id) => !(id in compMeta.value))
      if (!compIds.length) return
      const fetched = await Promise.all(compIds.map((id) => fetchCompetitionMeta(id)))
      const next = { ...compMeta.value }
      compIds.forEach((id, i) => {
        next[id] = fetched[i]
      })
      compMeta.value = next
    },
    { immediate: true },
  )

  const appearances = computed<DancerAppearance[]>(() => {
    const apps = aggregate.value?.appearances || {}
    return Object.entries(apps)
      .map<DancerAppearance>(([key, raw]) => ({
        key,
        raw,
        competition: raw.competitionId
          ? compMeta.value[raw.competitionId] ?? null
          : null,
      }))
      .sort((a, b) => {
        const da = a.competition?.date ? parseDate(a.competition.date).getTime() : 0
        const db = b.competition?.date ? parseDate(b.competition.date).getTime() : 0
        return db - da
      })
  })

  const upcoming = computed(() =>
    appearances.value
      .filter((a) => a.competition?.date && !isBeforeToday(a.competition.date))
      .sort((a, b) => {
        const da = a.competition?.date ? parseDate(a.competition.date).getTime() : 0
        const db = b.competition?.date ? parseDate(b.competition.date).getTime() : 0
        return da - db
      }),
  )

  const past = computed(() =>
    appearances.value.filter(
      (a) => a.competition?.date && isBeforeToday(a.competition.date),
    ),
  )

  const displayName = computed(() => {
    const apps = appearances.value
    const fn = latestNonNull(apps, (a) => a.raw.firstName) ?? ''
    const ln = latestNonNull(apps, (a) => a.raw.lastName) ?? ''
    const composed = `${fn} ${ln}`.trim()
    return composed || aggregate.value?.name?.trim() || 'Dancer'
  })

  const image = computed(() => latestNonNull(appearances.value, (a) => a.raw.image))
  const location = computed(() => latestNonNull(appearances.value, (a) => a.raw.location))

  const totalComps = computed(() => {
    const ids = new Set<string>()
    for (const a of appearances.value) {
      if (a.raw.competitionId) ids.add(a.raw.competitionId)
    }
    return ids.size
  })

  const compsThisYear = computed(() => {
    const year = new Date().getFullYear()
    const ids = new Set<string>()
    for (const a of appearances.value) {
      const d = a.competition?.date
      if (!d) continue
      if (parseDate(d).getFullYear() === year && a.raw.competitionId) {
        ids.add(a.raw.competitionId)
      }
    }
    return ids.size
  })

  const firstSeen = computed<DancerAppearance | null>(() => {
    let best: DancerAppearance | null = null
    let bestT = Infinity
    for (const a of appearances.value) {
      const d = a.competition?.date
      if (!d) continue
      const t = parseDate(d).getTime()
      if (t < bestT) {
        bestT = t
        best = a
      }
    }
    return best
  })

  const firstSeenDate = computed<Date | null>(() => {
    const d = firstSeen.value?.competition?.date
    return d ? parseDate(d) : null
  })

  const lastSeen = computed<DancerAppearance | null>(() => {
    let best: DancerAppearance | null = null
    let bestT = -Infinity
    for (const a of appearances.value) {
      const d = a.competition?.date
      if (!d) continue
      if (!isBeforeToday(d)) continue
      const t = parseDate(d).getTime()
      if (t > bestT) {
        bestT = t
        best = a
      }
    }
    return best
  })

  const lastSeenDate = computed<Date | null>(() => {
    const d = lastSeen.value?.competition?.date
    return d ? parseDate(d) : null
  })

  const venueCount = computed(() => {
    const venues = new Set<string>()
    for (const a of appearances.value) {
      const v = a.competition?.venue?.trim()
      if (v) venues.add(v.toLowerCase())
    }
    return venues.size
  })

  watch(
    [dancerId, displayName, notFound],
    ([id, name, missing]) => {
      if (!id || missing) return
      const trimmed = name?.trim()
      if (!trimmed || trimmed === 'Dancer') return
      recent.record(id, trimmed)
    },
  )

  return {
    loading,
    notFound,
    displayName,
    image,
    location,
    appearances,
    upcoming,
    past,
    totalComps,
    compsThisYear,
    firstSeen,
    firstSeenDate,
    lastSeen,
    lastSeenDate,
    venueCount,
  }
}
