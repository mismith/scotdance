import { computed, inject, provide, type ComputedRef, type InjectionKey, type Ref } from 'vue'
import { useRoute, useRouter, type RouteLocationNormalizedLoaded, type RouteLocationRaw } from 'vue-router'
import { useLinkedSet } from '@/composables/useCompetitionLinks'
import { fetchEntries } from '@/lib/competitionData'
import { keepCompetitionEntry } from '@/lib/competitionExit'
import { setLabel } from '@/lib/linked'
import { useMorph } from '@/lib/morph'
import type { CompetitionListItem } from '@/composables/useCompetitions'

// The switcher between linked competitions (ADR 0007 §6). In a linked
// competition the app bar's title opens it (and on Overview, a pill beside
// Alerts): the competitions it goes with, headed by what they are in plain
// words ("7 competitions, Jul 5 – 11"). Picking one keeps your place, and
// replaces this one in the history, so Back still leaves the competition.

export interface LinkedSwitcher {
  /** The set, in date order (this one among them); empty when it isn't linked. */
  members: ComputedRef<CompetitionListItem[]>
  linked: ComputedRef<boolean>
  /** "7 competitions, Jul 5 – 11". */
  label: ComputedRef<string | null>
  morph: ReturnType<typeof useMorph>
  /** Go to another of them, keeping your place. */
  go: (competitionId: string) => Promise<void>
  /** Where picking `competitionId` goes from here. */
  targetFor: (competitionId: string) => Promise<RouteLocationRaw>
}

const KEY: InjectionKey<LinkedSwitcher> = Symbol('linkedSwitcher')

const TABS = ['competition.info', 'competition.dancers', 'competition.schedule', 'competition.results']
/** Deeper pages go to their tab. */
export const TAB_OF: Record<string, string> = {
  'competition.event': 'competition.schedule',
  'competition.group': 'competition.results',
  'competition.dancer': 'competition.dancers',
}
/** Finding a dancer in the other one gives up after this (no signal at the venue): Dancers instead. */
const LOOKUP_MS = 1500
const within = <T>(work: Promise<T>, ms: number) =>
  Promise.race([work, new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Too slow')), ms))])

/**
 * Where to land in `toId` from `route`: a tab stays the same tab, with its
 * query; a dancer's page goes to the same person if they're entered there,
 * else to Dancers; anything deeper goes to its tab.
 */
export async function switchTarget(
  route: Pick<RouteLocationNormalizedLoaded, 'name' | 'query'>,
  toId: string,
  personId?: string | null,
): Promise<RouteLocationRaw> {
  const name = String(route.name ?? '')
  const params = { competitionId: toId }
  if (TABS.includes(name)) return { name, params, query: route.query }
  if (name === 'competition.dancer' && personId) {
    try {
      const entry = (await within(fetchEntries(toId, personId), LOOKUP_MS)).dancers[0]
      if (entry) return { name: 'competition.dancer', params: { ...params, dancerId: entry.id } }
    } catch {
      // Not published there (its dancers are private), or no answer in time:
      // its Dancers tab says which.
    }
  }
  return { name: TAB_OF[name] ?? 'competition.info', params }
}

export function provideLinkedSwitcher(
  competitionId: Ref<string>,
  /** The person on the dancer page you're on (their aggregate id), if any. */
  personId: Ref<string | null | undefined>,
): LinkedSwitcher {
  const route = useRoute()
  const router = useRouter()
  const { members } = useLinkedSet(competitionId)
  const morph = useMorph()
  const linked = computed(() => members.value.length > 1)
  const label = computed(() => (linked.value ? setLabel(members.value) : null))
  const targetFor = (toId: string) => switchTarget(route, toId, personId.value)
  let going = false
  async function go(toId: string) {
    if (toId === competitionId.value) {
      void morph.hide()
      return
    }
    if (going) return
    going = true
    const from = route.fullPath
    try {
      const target = await targetFor(toId)
      // Moved on meanwhile (closed it, went elsewhere): don't pull them back.
      if (route.fullPath !== from || !morph.open) return
      morph.dismiss()
      keepCompetitionEntry()
      await router.replace(target)
    } finally {
      going = false
    }
  }
  const api: LinkedSwitcher = { members, linked, label, morph, go, targetFor }
  provide(KEY, api)
  return api
}

export const useLinkedSwitcher = () => inject(KEY, null)
