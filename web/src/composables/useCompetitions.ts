import { ref, watch, type Ref } from 'vue'
import { get, orderByChild, query, ref as dbRef, startAt } from 'firebase/database'
import { database } from '@/firebase'
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

export function useCompetitions(includeArchived: Ref<boolean>) {
  const competitions = ref<CompetitionListItem[]>([])
  const loading = ref(false)
  const error = ref<Error | null>(null)

  async function load() {
    loading.value = true
    error.value = null
    try {
      const compsRef = dbRef(database, `${NAMESPACE}/competitions`)
      const q = includeArchived.value
        ? compsRef
        : query(compsRef, orderByChild('date'), startAt(recentCutoffDateString()))
      const snap = await get(q)
      const val = (snap.val() as Record<string, Competition> | null) ?? {}
      competitions.value = Object.entries(val)
        .map<CompetitionListItem>(([id, c]) => ({ id, ...c }))
        .filter((c) => c.listed)
        .sort((a, b) => {
          const aD = a.date ? new Date(a.date).getTime() : 0
          const bD = b.date ? new Date(b.date).getTime() : 0
          return aD - bD
        })
    } catch (e) {
      error.value = e as Error
    } finally {
      loading.value = false
    }
  }

  watch(includeArchived, load, { immediate: true })

  return { competitions, loading, error, reload: load }
}
