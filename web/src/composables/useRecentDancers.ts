import { useLocalStorage } from '@vueuse/core'

// Storage key bumped (v2) so old slug-keyed entries don't render as broken
// links after the Phase 5 hard-cut from slug URLs to aggregate IDs.
export interface RecentDancer {
  id: string
  name: string
  viewedAt: number
}

const MAX = 10
const STORAGE_KEY = 'dancers:recent:v2'

const recent = useLocalStorage<RecentDancer[]>(STORAGE_KEY, [])

export function useRecentDancers() {
  function record(id: string, name: string) {
    if (!id || !name) return
    const next = recent.value.filter((r) => r.id !== id)
    next.unshift({ id, name, viewedAt: Date.now() })
    recent.value = next.slice(0, MAX)
  }

  function clear() {
    recent.value = []
  }

  function remove(id: string) {
    recent.value = recent.value.filter((r) => r.id !== id)
  }

  return { recent, record, clear, remove }
}
