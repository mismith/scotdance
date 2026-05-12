import { defineStore } from 'pinia'
import { ref, shallowRef } from 'vue'
import { searchDancers, type SearchDancerGroup } from '@/lib/searchDancers'

export const useDancersStore = defineStore('dancers', () => {
  const query = ref('')
  const results = shallowRef<SearchDancerGroup[]>([])
  const searching = ref(false)
  const searchError = ref<Error | null>(null)
  const locationByName = shallowRef(new Map<string, string>())

  async function search(q: string) {
    const trimmed = q.trim()
    if (trimmed === query.value && (results.value.length || searching.value)) return
    query.value = trimmed
    if (!trimmed) {
      results.value = []
      searchError.value = null
      return
    }
    searching.value = true
    searchError.value = null
    try {
      const out = await searchDancers(trimmed)
      if (query.value !== trimmed) return
      results.value = out
    } catch (e) {
      if (query.value !== trimmed) return
      searchError.value = e as Error
      results.value = []
    } finally {
      if (query.value === trimmed) searching.value = false
    }
  }

  function reset() {
    results.value = []
    searching.value = false
    searchError.value = null
    query.value = ''
  }

  async function resolveLocations(names: string[]) {
    const todo = names.filter((n) => !locationByName.value.has(n))
    if (!todo.length) return
    const resolved = await Promise.all(
      todo.map(async (name) => {
        try {
          const groups = await searchDancers(name)
          const match =
            groups.find((g) => g.name.toLowerCase() === name.toLowerCase()) ??
            groups[0]
          return [name, match?.dancers.find((d) => d.location)?.location ?? ''] as const
        } catch {
          return [name, ''] as const
        }
      }),
    )
    const next = new Map(locationByName.value)
    for (const [name, loc] of resolved) next.set(name, loc)
    locationByName.value = next
  }

  return {
    query,
    results,
    searching,
    searchError,
    locationByName,
    search,
    reset,
    resolveLocations,
  }
})
