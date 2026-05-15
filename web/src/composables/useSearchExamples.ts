import { ref, watchEffect } from 'vue'
import { get, ref as dbRef } from 'firebase/database'
import { useCompetitions, type CompetitionListItem } from '@/composables/useCompetitions'
import { database } from '@/firebase'
import { parseDate } from '@/lib/format'

const NAMESPACE = import.meta.env.VITE_FIREBASE_DATA_NAMESPACE || 'production'

const TARGET = 3

export interface SearchExamples {
  competitions: string[]
  places: string[]
  dancers: string[]
  judges: string[]
}

type Key = keyof SearchExamples

function isFull(examples: SearchExamples, key: Key): boolean {
  return examples[key].length >= TARGET
}

function allFull(examples: SearchExamples): boolean {
  return (Object.keys(examples) as Key[]).every((k) => isFull(examples, k))
}

const examples = ref<SearchExamples>({
  competitions: [],
  places: [],
  dancers: [],
  judges: [],
})
// Start true so consumers can render skeletons immediately — we always intend
// to load, even before the competitions list is available.
const loading = ref(true)
let loaded = false

function pushUnique(target: SearchExamples, key: Key, value: string | undefined | null) {
  if (!value) return
  const v = value.trim()
  if (!v) return
  if (target[key].length >= TARGET) return
  if (target[key].some((x) => x.toLowerCase() === v.toLowerCase())) return
  target[key].push(v)
}

async function load(list: CompetitionListItem[]) {
  if (loaded || !list.length) return
  loaded = true

  // Accumulate into a local object and swap atomically at the end, so the UI
  // doesn't flash with partially-filled categories during the awaited fetches.
  const next: SearchExamples = {
    competitions: [],
    places: [],
    dancers: [],
    judges: [],
  }

  const sorted = [...list].sort((a, b) => {
    const aD = a.date ? parseDate(a.date).getTime() : 0
    const bD = b.date ? parseDate(b.date).getTime() : 0
    return bD - aD
  })

  for (const comp of sorted) {
    if (allFull(next)) break

    pushUnique(next, 'competitions', comp.name)
    // Try the most-specific place fields first.
    pushUnique(next, 'places', comp.locality)
    pushUnique(next, 'places', comp.venue)
    pushUnique(next, 'places', comp.region)

    const needDancers = !isFull(next, 'dancers')
    const needJudges = !isFull(next, 'judges')
    if (!needDancers && !needJudges) continue

    try {
      const [dancersSnap, staffSnap] = await Promise.all([
        needDancers
          ? get(dbRef(database, `${NAMESPACE}/competitions:data/${comp.id}/dancers`))
          : Promise.resolve(null),
        needJudges
          ? get(dbRef(database, `${NAMESPACE}/competitions:data/${comp.id}/staff`))
          : Promise.resolve(null),
      ])

      if (dancersSnap) {
        const dancers =
          (dancersSnap.val() as Record<
            string,
            { firstName?: string; lastName?: string }
          > | null) ?? {}
        Object.values(dancers).forEach((d) => {
          const name = `${d?.firstName ?? ''} ${d?.lastName ?? ''}`.trim()
          pushUnique(next, 'dancers', name)
        })
      }

      if (staffSnap) {
        const staff =
          (staffSnap.val() as Record<
            string,
            { firstName?: string; lastName?: string; type?: string }
          > | null) ?? {}
        Object.values(staff).forEach((s) => {
          if (s?.type !== 'Judge') return
          const name = `${s?.firstName ?? ''} ${s?.lastName ?? ''}`.trim()
          pushUnique(next, 'judges', name)
        })
      }
    } catch {
      // Quietly skip — likely permission-gated for anonymous users.
    }
  }

  examples.value = next
  loading.value = false
}

export function useSearchExamples() {
  // Pull from the full archive (not just the recent window) — example data is
  // just for showing what searches look like; comp age doesn't matter.
  const includeArchived = ref(true)
  const { competitions } = useCompetitions(includeArchived)

  watchEffect(() => {
    void load(competitions.value)
  })

  return { examples, loading }
}
