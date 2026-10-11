import { computed, ref, watch, type Ref } from 'vue'
import { dataRef } from '@/firebase'
import { onValueSaved } from '@/lib/offline'
import { fetchCompetitionMeta } from '@/lib/competitionMeta'
import { compareByDate, setsByCompetition, withOthersLine, type CompetitionLinkRecord, type LinkedSet } from '@/lib/linked'
import { ensureCompetitionsList, peekCompetition, type CompetitionListItem } from '@/composables/useCompetitions'
import { useMeStore } from '@/stores/me'

// Every link between competitions, live (ADR 0007): tens of them, so the
// lists, the switcher and Manage all read the one node, kept on the device
// too, as organisations are. Only functions write it.

const raw = ref<Record<string, CompetitionLinkRecord>>({})
const loaded = ref(false)
let off: (() => void) | null = null

function start() {
  if (off) return
  off = onValueSaved(
    dataRef('competitionLinks'),
    (snap) => {
      raw.value = (snap.val() as Record<string, CompetitionLinkRecord> | null) ?? {}
      loaded.value = true
    },
    () => {
      loaded.value = true
      off = null
    },
  )
}

export function useCompetitionLinks() {
  start()
  const me = useMeStore()
  const byCompetition = computed(() => setsByCompetition(raw.value))
  const setOf = (id: string | null | undefined): LinkedSet | null => (id ? (byCompetition.value.get(id) ?? null) : null)
  const linkOf = (id: string) => setOf(id)?.linkId ?? null
  /** You can see it: it's listed, or you manage it. */
  const visible = (c: CompetitionListItem | null | undefined): c is CompetitionListItem =>
    !!c && (c.listed === true || me.hasCompetitionPerm(c.id))
  /**
   * The line for one shown without the rest of its set ("With Maritime Open,
   * Jul 4"), from the competitions the lists already have.
   */
  function othersLine(c: { id: string; date?: number | string; name?: string }): string | null {
    const set = setOf(c.id)
    if (!set) return null
    const members = set.ids.map((id) => (id === c.id ? { ...c } : peekCompetition(id))).filter((m) => m && (m.id === c.id || visible(m as CompetitionListItem)))
    return withOthersLine(c, members as CompetitionListItem[])
  }
  return { byCompetition, setOf, linkOf, othersLine, loaded }
}

/**
 * A competition's set: the competitions linked with it that you can see, in
 * date order (itself among them), and its primary.
 */
export function useLinkedSet(competitionId: Ref<string | null | undefined>) {
  const { setOf } = useCompetitionLinks()
  const me = useMeStore()
  const records = ref(new Map<string, CompetitionListItem>())
  const set = computed(() => setOf(competitionId.value))
  let token = 0
  watch(
    () => set.value?.ids.slice().sort().join(',') ?? '',
    async (key) => {
      const mine = ++token
      const ids = key ? key.split(',') : []
      if (!ids.length) {
        records.value = new Map()
        return
      }
      // The list the app already has first, so the switcher opens at once.
      const peeked = new Map(ids.map((id) => [id, peekCompetition(id)] as const).filter((e): e is [string, CompetitionListItem] => !!e[1]))
      records.value = peeked
      await ensureCompetitionsList(false)
      const fetched = await Promise.all(ids.map(async (id) => {
        const c = peekCompetition(id) ?? (await fetchCompetitionMeta(id))
        return c ? ([id, { ...c, id }] as [string, CompetitionListItem]) : null
      }))
      if (mine === token) records.value = new Map(fetched.filter((e): e is [string, CompetitionListItem] => !!e))
    },
    { immediate: true },
  )
  const members = computed(() =>
    [...records.value.values()]
      .filter((c) => c.id === competitionId.value || c.listed === true || me.hasCompetitionPerm(c.id))
      .sort(compareByDate),
  )
  return { set, members, primary: computed(() => set.value?.primary ?? null) }
}
