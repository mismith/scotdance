import { watch } from 'vue'
import { ensureCompetitionsList, peekCompetition } from '@/composables/useCompetitions'
import { visibilityOf, type Visibility } from '@/lib/visibility'
import { useMeStore } from '@/stores/me'
import type { Competition } from '@/types/competition'

// How a competition is hidden from everyone else ('unlisted' or
// 'unpublished'), for the people who see past that: its admins and system
// admins. Null once it's published, and for everyone else. Search hits and
// profiles carry a competition without its switches, so those are read from
// the full competitions list, which loads for organisers wherever this is used.
export function useHiddenAs() {
  const me = useMeStore()
  watch(
    () => me.canManageAny,
    (can) => {
      if (can) void ensureCompetitionsList(true)
    },
    { immediate: true },
  )
  return (
    id: string | null | undefined,
    c?: Pick<Competition, 'listed' | 'published'> | null,
  ): Exclude<Visibility, 'published'> | null => {
    if (!id || !me.hasCompetitionPerm(id)) return null
    const known = c && ('listed' in c || 'published' in c) ? c : peekCompetition(id)
    if (!known) return null
    const v = visibilityOf(known)
    return v === 'published' ? null : v
  }
}
