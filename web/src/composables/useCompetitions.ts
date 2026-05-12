import { computed, ref, watch, type Ref } from 'vue'
import { get, orderByChild, query, ref as dbRef, startAt } from 'firebase/database'
import { database } from '@/firebase'
import { useMeStore } from '@/stores/me'
import { parseDate } from '@/lib/format'
import type { Competition } from '@/types/competition'

const NAMESPACE = import.meta.env.VITE_FIREBASE_DATA_NAMESPACE || 'production'

export interface CompetitionListItem extends Competition {
  id: string
}

function recentCutoffDateString(): string {
  const d = new Date()
  d.setMonth(d.getMonth() - 3)
  return d.toISOString().slice(0, 10)
}

interface CacheEntry {
  data: Ref<CompetitionListItem[]>
  loaded: boolean
  inFlight: Promise<void> | null
}

const recentCache: CacheEntry = { data: ref([]), loaded: false, inFlight: null }
const archivedCache: CacheEntry = { data: ref([]), loaded: false, inFlight: null }
const loading = ref(false)
const error = ref<Error | null>(null)

async function fetchInto(entry: CacheEntry, includeArchived: boolean) {
  if (entry.inFlight) return entry.inFlight
  const compsRef = dbRef(database, `${NAMESPACE}/competitions`)
  const q = includeArchived
    ? compsRef
    : query(compsRef, orderByChild('date'), startAt(recentCutoffDateString()))
  loading.value = true
  error.value = null
  entry.inFlight = (async () => {
    try {
      const snap = await get(q)
      const val = (snap.val() as Record<string, Competition> | null) ?? {}
      entry.data.value = Object.entries(val)
        .map<CompetitionListItem>(([id, c]) => ({ id, ...c }))
        .sort((a, b) => {
          const aD = a.date ? parseDate(a.date).getTime() : 0
          const bD = b.date ? parseDate(b.date).getTime() : 0
          return aD - bD
        })
      entry.loaded = true
    } catch (e) {
      error.value = e as Error
    } finally {
      loading.value = false
      entry.inFlight = null
    }
  })()
  return entry.inFlight
}

export function useCompetitions(includeArchived: Ref<boolean>) {
  const me = useMeStore()

  async function load(force = false) {
    const entry = includeArchived.value ? archivedCache : recentCache
    if (!force && entry.loaded) return
    if (force) entry.loaded = false
    await fetchInto(entry, includeArchived.value)
  }

  const rawCompetitions = computed<CompetitionListItem[]>(() =>
    (includeArchived.value ? archivedCache : recentCache).data.value,
  )

  const competitions = computed<CompetitionListItem[]>(() =>
    rawCompetitions.value.filter((c) => {
      if (me.isAdmin) return true
      return c.listed === true && c.published === true
    }),
  )

  watch(includeArchived, () => load(), { immediate: true })

  return { competitions, loading, error, reload: () => load(true) }
}
