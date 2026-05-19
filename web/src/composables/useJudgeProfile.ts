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

export interface JudgeAppearanceRaw {
  competitionId?: string
  staffId?: string
  firstName?: string | null
  lastName?: string | null
  image?: string | null
  bio?: string | null
  location?: string | null
}

export interface JudgeAggregate {
  name?: string
  appearanceCount?: number
  appearances?: Record<string, JudgeAppearanceRaw>
}

export interface JudgeAppearance {
  key: string
  raw: JudgeAppearanceRaw
  competition: Competition | null
}

export interface UseJudgeProfile {
  loading: Ref<boolean>
  notFound: Ref<boolean>
  displayName: Ref<string>
  image: Ref<string | null>
  bio: Ref<string | null>
  location: Ref<string | null>
  appearances: Ref<JudgeAppearance[]>
  upcoming: Ref<JudgeAppearance[]>
  past: Ref<JudgeAppearance[]>
  totalComps: Ref<number>
  compsThisYear: Ref<number>
}

const KEY: InjectionKey<UseJudgeProfile> = Symbol('judgeProfile')

export function provideJudgeProfile(judgeId: Ref<string>): UseJudgeProfile {
  const profile = createJudgeProfile(judgeId)
  provide(KEY, profile)
  return profile
}

export function useJudgeProfile(): UseJudgeProfile {
  const injected = inject(KEY, null)
  if (!injected) throw new Error('useJudgeProfile() called outside JudgeLayout')
  return injected
}

function latestNonNull<T>(
  list: JudgeAppearance[],
  pick: (a: JudgeAppearance) => T | null | undefined,
): T | null {
  for (const a of list) {
    const v = pick(a)
    if (v != null && v !== '') return v as T
  }
  return null
}

function createJudgeProfile(judgeId: Ref<string>): UseJudgeProfile {
  const recent = useRecentEntities('judges')
  const loading = ref(false)
  const notFound = ref(false)
  const aggregate = ref<JudgeAggregate | null>(null)
  const compMeta = ref<Record<string, Competition | null>>({})

  watch(
    judgeId,
    async (id) => {
      if (!id) {
        aggregate.value = null
        notFound.value = false
        return
      }
      loading.value = true
      notFound.value = false
      try {
        const snap = await get(child(dataRef('judges'), id))
        const value = snap.val()
        if (value && typeof value === 'object') {
          const agg = value as JudgeAggregate
          aggregate.value = agg
          // Seed the /judges list cache with this row so back-nav from the
          // detail page has a real row in the DOM for the view-transition
          // morph to land on (without paying for a full list fetch).
          insertEntityAggregate('judges', id, agg)
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
  const appearances = computed<JudgeAppearance[]>(() => {
    const apps = aggregate.value?.appearances || {}
    return Object.entries(apps)
      .map<JudgeAppearance>(([key, raw]) => ({
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
    return composed || aggregate.value?.name?.trim() || 'Judge'
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
