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
import {
  appearanceDate,
  buildAppearances,
  countCompsThisYear,
  countTotalComps,
  countUniqueVenues,
  filterPast,
  filterUpcoming,
  findFirstSeen,
  findLastSeen,
  latestNonNull,
} from '@/lib/appearanceStats'
import { insertEntityAggregate } from '@/composables/useEntityAggregates'
import { useRecentEntities } from '@/composables/useRecentEntities'
import type { Competition } from '@/types/competition'

export interface PiperAppearanceRaw {
  competitionId?: string
  staffId?: string
  firstName?: string | null
  lastName?: string | null
  image?: string | null
  bio?: string | null
  location?: string | null
}

export interface PiperAggregate {
  $name?: string
  appearanceCount?: number
  appearances?: Record<string, PiperAppearanceRaw>
}

export interface PiperAppearance {
  key: string
  raw: PiperAppearanceRaw
  competition: Competition | null
}

export interface UsePiperProfile {
  loading: Ref<boolean>
  notFound: Ref<boolean>
  displayName: Ref<string>
  image: Ref<string | null>
  bio: Ref<string | null>
  location: Ref<string | null>
  appearances: Ref<PiperAppearance[]>
  upcoming: Ref<PiperAppearance[]>
  past: Ref<PiperAppearance[]>
  totalComps: Ref<number>
  compsThisYear: Ref<number>
  firstSeen: Ref<PiperAppearance | null>
  firstSeenDate: Ref<Date | null>
  lastSeen: Ref<PiperAppearance | null>
  lastSeenDate: Ref<Date | null>
  venueCount: Ref<number>
}

const KEY: InjectionKey<UsePiperProfile> = Symbol('piperProfile')

export function providePiperProfile(piperId: Ref<string>): UsePiperProfile {
  const profile = createPiperProfile(piperId)
  provide(KEY, profile)
  return profile
}

export function usePiperProfile(): UsePiperProfile {
  const injected = inject(KEY, null)
  if (!injected) throw new Error('usePiperProfile() called outside PiperLayout')
  return injected
}

function createPiperProfile(piperId: Ref<string>): UsePiperProfile {
  const recent = useRecentEntities('pipers')
  const loading = ref(false)
  const notFound = ref(false)
  const aggregate = ref<PiperAggregate | null>(null)
  const compMeta = ref<Record<string, Competition | null>>({})

  watch(
    piperId,
    async (id) => {
      if (!id) {
        aggregate.value = null
        notFound.value = false
        return
      }
      loading.value = true
      notFound.value = false
      try {
        const snap = await get(child(dataRef('pipers'), id))
        const value = snap.val()
        if (value && typeof value === 'object') {
          const agg = value as PiperAggregate
          aggregate.value = agg
          insertEntityAggregate('pipers', id, agg)
          const eagerName = (agg as { name?: string }).name?.trim() || agg.$name?.trim()
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

  // Fetch comp meta for every appearance (cached by fetchCompetitionMeta).
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

  const appearances = computed<PiperAppearance[]>(() =>
    buildAppearances(aggregate.value?.appearances, compMeta.value),
  )
  const upcoming = computed(() => filterUpcoming(appearances.value))
  const past = computed(() => filterPast(appearances.value))

  const displayName = computed(() => {
    const apps = appearances.value
    const fn = latestNonNull(apps, (a) => a.raw.firstName) ?? ''
    const ln = latestNonNull(apps, (a) => a.raw.lastName) ?? ''
    const composed = `${fn} ${ln}`.trim()
    return composed || aggregate.value?.$name?.trim() || 'Piper'
  })

  const image = computed(() => latestNonNull(appearances.value, (a) => a.raw.image))
  const bio = computed(() => latestNonNull(appearances.value, (a) => a.raw.bio))
  const location = computed(() => latestNonNull(appearances.value, (a) => a.raw.location))

  const totalComps = computed(() => countTotalComps(appearances.value))
  const compsThisYear = computed(() => countCompsThisYear(appearances.value))

  const firstSeen = computed(() => findFirstSeen(appearances.value))
  const firstSeenDate = computed(() => appearanceDate(firstSeen.value))
  const lastSeen = computed(() => findLastSeen(appearances.value))
  const lastSeenDate = computed(() => appearanceDate(lastSeen.value))
  const venueCount = computed(() => countUniqueVenues(appearances.value))

  return {
    loading,
    notFound,
    displayName,
    image,
    bio,
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
