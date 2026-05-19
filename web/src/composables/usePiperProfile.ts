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

function latestNonNull<T>(
  list: PiperAppearance[],
  pick: (a: PiperAppearance) => T | null | undefined,
): T | null {
  for (const a of list) {
    const v = pick(a)
    if (v != null && v !== '') return v as T
  }
  return null
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

  // Sorted: most recent (or future) first → past in descending order.
  const appearances = computed<PiperAppearance[]>(() => {
    const apps = aggregate.value?.appearances || {}
    return Object.entries(apps)
      .map<PiperAppearance>(([key, raw]) => ({
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
    return composed || aggregate.value?.$name?.trim() || 'Piper'
  })

  const image = computed(() => latestNonNull(appearances.value, (a) => a.raw.image))
  const bio = computed(() => latestNonNull(appearances.value, (a) => a.raw.bio))
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
  }
}
