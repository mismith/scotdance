import { useLocalStorage } from '@vueuse/core'

const MAX = 8
const STORAGE_KEY = 'search:recent'

const recent = useLocalStorage<string[]>(STORAGE_KEY, [])

export function useRecentSearches() {
  function record(q: string) {
    const trimmed = q.trim()
    if (!trimmed) return
    const next = recent.value.filter((r) => r.toLowerCase() !== trimmed.toLowerCase())
    next.unshift(trimmed)
    recent.value = next.slice(0, MAX)
  }

  function remove(q: string) {
    recent.value = recent.value.filter((r) => r !== q)
  }

  function clear() {
    recent.value = []
  }

  return { recent, record, remove, clear }
}
