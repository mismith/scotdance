import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import Fuse from 'fuse.js'
import type { EnrichedDancer } from '@/types/competition'

// Finding a dancer in a competition: digits match competitor numbers from
// the start ("23" finds 230–239), anything else matches names and towns,
// best match first. Shared by the Dancers tab and the Overview's "Is your
// dancer here?".
export function useCompetitionSearch(
  dancers: MaybeRefOrGetter<EnrichedDancer[]>,
  query: MaybeRefOrGetter<string>,
) {
  const fuse = computed(
    () =>
      new Fuse(toValue(dancers), {
        keys: ['fullName', 'firstName', 'lastName', 'location'],
        threshold: 0.3,
        ignoreLocation: true,
      }),
  )

  return computed(() => {
    const list = toValue(dancers)
    const q = toValue(query).trim()
    if (/^\d+$/.test(q)) return list.filter((d) => d.number != null && String(d.number).startsWith(q))
    if (!q) return list
    return fuse.value.search(q).map((r) => r.item)
  })
}
