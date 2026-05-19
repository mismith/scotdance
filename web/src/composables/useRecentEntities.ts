import type { Ref } from 'vue'
import { useLocalStorage } from '@vueuse/core'

export interface RecentEntity {
  id: string
  name: string
  viewedAt: number
}

const MAX = 10

// Module-scoped per-namespace cache so two callers of the same namespace share
// one reactive ref (otherwise each call would build a fresh useLocalStorage
// binding and updates wouldn't propagate within a tick).
const stores = new Map<string, Ref<RecentEntity[]>>()

function storeFor(namespace: string): Ref<RecentEntity[]> {
  let s = stores.get(namespace)
  if (!s) {
    // v2: bumped from v1 when slug URLs were dropped in favour of aggregate
    // IDs (old slug-keyed entries would render as broken links).
    s = useLocalStorage<RecentEntity[]>(`${namespace}:recent:v2`, [])
    stores.set(namespace, s)
  }
  return s
}

export function useRecentEntities(namespace: string) {
  const recent = storeFor(namespace)

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
