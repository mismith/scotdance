import { computed, ref, watch } from 'vue'
import { useFavoritesStore } from '@/stores/favorites'
import { useDancerCards } from '@/composables/useDancerCards'
import { useAlertsPrompt } from '@/composables/useAlertsPrompt'
import { getOrdinalSuffix } from '@/lib/results'

// While the app is open on competition day, watch followed dancers' live
// results and raise an alert the moment a placing is posted. The first read
// only records a baseline; alerts fire on changes after it.

export interface LiveAlert {
  id: string
  title: string
  subtitle: string
  to: { name: string; params: Record<string, string>; hash?: string }
  /** `${entryId}:${danceId}` for the medal flip. */
  freshKey: string
}

const current = ref<LiveAlert | null>(null)
const freshKey = ref<string | null>(null)
let started = false

export function useLiveAlertState() {
  return { current, freshKey, dismiss: () => (current.value = null) }
}

export function startLiveAlerts() {
  if (started) return
  started = true
  const favorites = useFavoritesStore()
  const prompt = useAlertsPrompt()
  const people = computed(() =>
    Object.entries(favorites.dancers).map(([id, v]) => ({ id, name: typeof v === 'string' ? v : 'Dancer' })),
  )
  const { cards } = useDancerCards(people)

  const seen = new Map<string, string>()
  let baselined = new Set<string>()

  watch(
    cards,
    (list) => {
      const fresh: LiveAlert[] = []
      for (const card of list) {
        const f = card.focus
        if (!f || f.phase !== 'today') continue
        for (const day of f.days) {
          const all = [...day.dances, ...(day.overall ? [day.overall] : [])]
          for (const s of all) {
            const key = `${day.dancer.id}:${s.dance.id}`
            const sig = `${s.state}:${s.place ?? ''}`
            const before = seen.get(key)
            seen.set(key, sig)
            // Only a change to something already seen is news; a dancer's
            // first appearance (data still arriving) is a baseline.
            if (!baselined.has(f.competitionId) || before === undefined) continue
            if (before === sig) continue
            if (!['placed', 'unplaced', 'no-placings'].includes(s.state)) continue
            const first = day.dancer.firstName || day.dancer.fullName
            const danceName = s.dance.id === 'overall' ? 'Overall' : s.dance.name || s.dance.fullName
            fresh.push({
              id: `${key}:${sig}`,
              title:
                s.state === 'placed' && s.place != null
                  ? s.dance.id === 'overall'
                    ? `${first} placed ${s.place}${getOrdinalSuffix(s.place)} overall`
                    : `${first} placed ${s.place}${getOrdinalSuffix(s.place)} in the ${danceName}`
                  : `Results are in for the ${danceName}`,
              subtitle: [day.group?.fullName, f.competition.name].filter(Boolean).join(' · '),
              to: {
                name: 'competition.group',
                params: { competitionId: f.competitionId, groupId: day.group?.id ?? '' },
                hash: `#dance-${s.dance.id}`,
              },
              freshKey: key,
            })
          }
        }
        baselined = new Set([...baselined, f.competitionId])
      }
      const alert = fresh.at(-1)
      if (!alert) return
      current.value = alert
      freshKey.value = alert.freshKey
      if (prompt.enabledHere.value && document.hidden && 'Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification(alert.title, { body: alert.subtitle, tag: alert.id, icon: '/img/touchicon.png' })
        } catch {
          /* some browsers only allow notifications from a service worker */
        }
      }
    },
    { deep: false },
  )
}
