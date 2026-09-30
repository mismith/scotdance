import { ref, watch } from 'vue'
import { useFavoritesStore } from '@/stores/favorites'
import { fetchAggregate } from '@/composables/useDancerCards'

// competitionId → first names of followed dancers entered there. Built from
// each followed person's aggregate record (their appearances), so it works
// for any competition without loading its dancer list.
export function useFollowedCompetitions() {
  const favorites = useFavoritesStore()
  const byCompetition = ref<Record<string, Array<{ id: string; name: string }>>>({})

  watch(
    () => Object.keys(favorites.dancers).join(','),
    async () => {
      const ids = Object.keys(favorites.dancers)
      const aggs = await Promise.all(ids.map((id) => fetchAggregate(id)))
      const out: Record<string, Array<{ id: string; name: string }>> = {}
      aggs.forEach((agg, i) => {
        const stored = favorites.dancers[ids[i]]
        const name = (typeof stored === 'string' ? stored : agg?.name ?? '').split(' ')[0]
        const comps = new Set(Object.values(agg?.appearances ?? {}).map((a) => a.competitionId))
        for (const c of comps) {
          if (!c || !name) continue
          out[c] = [...(out[c] ?? []), { id: ids[i], name }]
        }
      })
      byCompetition.value = out
    },
    { immediate: true },
  )

  return { byCompetition }
}
