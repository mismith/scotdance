import { computed, inject, provide, ref, shallowRef, watch, type InjectionKey, type Ref } from 'vue'
import { searchDancers, type SearchDancerHit } from '@/lib/searchDancers'
import { fetchCompetitionMeta } from '@/lib/competitionMeta'
import { isBeforeToday } from '@/lib/format'
import { useRecentDancers } from '@/composables/useRecentDancers'
import type { Competition } from '@/types/competition'

export interface DancerAppearance {
  hit: SearchDancerHit
  competition: Competition | null
}

export interface UseDancerProfile {
  loading: Ref<boolean>
  notFound: Ref<boolean>
  displayName: Ref<string>
  appearances: Ref<DancerAppearance[]>
  upcoming: Ref<DancerAppearance[]>
  past: Ref<DancerAppearance[]>
  location: Ref<string | null>
  compsThisYear: Ref<number>
  totalComps: Ref<number>
}

function nameFromSlug(slug: string): string {
  return slug
    .split('-')
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ')
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

const KEY: InjectionKey<UseDancerProfile> = Symbol('dancerProfile')

export function provideDancerProfile(slug: Ref<string>): UseDancerProfile {
  const profile = createDancerProfile(slug)
  provide(KEY, profile)
  return profile
}

export function useDancerProfile(): UseDancerProfile {
  const injected = inject(KEY, null)
  if (!injected) {
    throw new Error('useDancerProfile() called outside DancerLayout')
  }
  return injected
}

function createDancerProfile(slug: Ref<string>): UseDancerProfile {
  const loading = ref(false)
  const notFound = ref(false)
  const hits = shallowRef<SearchDancerHit[]>([])
  const compMeta = ref<Record<string, Competition | null>>({})

  const displayName = computed(() => {
    const fromHit = hits.value[0]?.fullName
    return fromHit?.trim() || nameFromSlug(slug.value) || 'Dancer'
  })

  watch(
    slug,
    async (value) => {
      if (!value) {
        hits.value = []
        notFound.value = false
        return
      }
      const decoded = nameFromSlug(value)
      loading.value = true
      notFound.value = false
      try {
        const groups = await searchDancers(decoded)
        const target = slugify(decoded)
        const match =
          groups.find((g) => slugify(g.name) === target) ?? groups[0] ?? null
        hits.value = match?.dancers ?? []
        notFound.value = hits.value.length === 0
      } catch {
        hits.value = []
        notFound.value = true
      } finally {
        loading.value = false
      }
    },
    { immediate: true },
  )

  watch(
    hits,
    async (list) => {
      const ids = [...new Set(list.map((h) => h.competitionId))].filter(
        (id) => !(id in compMeta.value),
      )
      if (!ids.length) return
      const fetched = await Promise.all(ids.map((id) => fetchCompetitionMeta(id)))
      const next = { ...compMeta.value }
      ids.forEach((id, i) => {
        next[id] = fetched[i]
      })
      compMeta.value = next
    },
    { immediate: true },
  )

  const appearances = computed<DancerAppearance[]>(() => {
    return hits.value
      .map<DancerAppearance>((hit) => ({
        hit,
        competition: compMeta.value[hit.competitionId] ?? null,
      }))
      .sort((a, b) => {
        const da = a.competition?.date ?? 0
        const db = b.competition?.date ?? 0
        return Number(db) - Number(da)
      })
  })

  const upcoming = computed(() =>
    appearances.value
      .filter((a) => a.competition?.date && !isBeforeToday(a.competition.date))
      .sort(
        (a, b) =>
          Number(a.competition?.date ?? 0) - Number(b.competition?.date ?? 0),
      ),
  )
  const past = computed(() =>
    appearances.value.filter(
      (a) => a.competition?.date && isBeforeToday(a.competition.date),
    ),
  )

  const location = computed(() => {
    const withLocation = appearances.value.find((a) => a.hit.location)
    return withLocation?.hit.location ?? null
  })

  const compsThisYear = computed(() => {
    const year = new Date().getFullYear()
    return appearances.value.filter((a) => {
      const d = a.competition?.date
      if (!d) return false
      return new Date(d).getFullYear() === year
    }).length
  })

  const totalComps = computed(() => appearances.value.length)

  const recent = useRecentDancers()
  watch(
    [slug, displayName, notFound, () => hits.value.length],
    ([s, name, missing, hitCount]) => {
      if (!s || missing || !hitCount) return
      const trimmed = name?.trim()
      if (!trimmed) return
      recent.record(s, trimmed)
    },
  )

  return {
    loading,
    notFound,
    displayName,
    appearances,
    upcoming,
    past,
    location,
    compsThisYear,
    totalComps,
  }
}
