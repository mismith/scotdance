import { computed, ref } from 'vue'
import { dataRef } from '@/firebase'
import { onValueSaved } from '@/lib/offline'
import { useCompetitions, type CompetitionListItem } from '@/composables/useCompetitions'
import type { Organisation, OrganisationListItem } from '@/types/organisation'

// Every organisation, live: there are tens, not thousands, so the list, its
// pages and the pickers all read the one node (kept on the device too, for
// competition day with no signal). Their competitions come from the
// competitions list the app already loads.

const list = ref<OrganisationListItem[]>([])
const loaded = ref(false)
const error = ref<Error | null>(null)
let off: (() => void) | null = null

function start() {
  if (off) return
  off = onValueSaved(
    dataRef('organisations'),
    (snap) => {
      const val = (snap.val() as Record<string, Organisation> | null) ?? {}
      list.value = Object.entries(val)
        .filter(([, o]) => o && typeof o === 'object')
        .map(([id, o]) => ({ id, ...o }))
        .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))
      loaded.value = true
      error.value = null
    },
    (e) => {
      error.value = e
      loaded.value = true
      off = null
    },
  )
}

export function useOrganisations() {
  start()
  const byId = computed(() => new Map(list.value.map((o) => [o.id, o])))
  return { organisations: list, byId, loaded, error, retry: start }
}

/**
 * Each organisation's competitions (those you can see), soonest last. Reads
 * every competition ever, so only where past ones show: organisation pages
 * and Manage. Search has them from the search index instead.
 */
export function useOrganisationCompetitions() {
  const { competitions, loading } = useCompetitions(ref(true))
  const byOrganisation = computed(() => {
    const out = new Map<string, CompetitionListItem[]>()
    for (const c of competitions.value) {
      for (const [id, on] of Object.entries(c.organisations ?? {})) {
        if (on === true) out.set(id, [...(out.get(id) ?? []), c])
      }
    }
    return out
  })
  return { byOrganisation, competitions, loading }
}
