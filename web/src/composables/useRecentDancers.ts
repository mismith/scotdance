import { useLocalStorage } from '@vueuse/core'

export interface RecentDancer {
  slug: string
  name: string
  viewedAt: number
}

const MAX = 10
const STORAGE_KEY = 'dancers:recent'

const recent = useLocalStorage<RecentDancer[]>(STORAGE_KEY, [])

export function useRecentDancers() {
  function record(slug: string, name: string) {
    if (!slug || !name) return
    const next = recent.value.filter((r) => r.slug !== slug)
    next.unshift({ slug, name, viewedAt: Date.now() })
    recent.value = next.slice(0, MAX)
  }

  function clear() {
    recent.value = []
  }

  function remove(slug: string) {
    recent.value = recent.value.filter((r) => r.slug !== slug)
  }

  return { recent, record, clear, remove }
}
