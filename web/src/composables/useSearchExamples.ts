import { ref, watchEffect } from 'vue'
import { get, ref as dbRef } from 'firebase/database'
import { useCompetitions, type CompetitionListItem } from '@/composables/useCompetitions'
import { database } from '@/firebase'
import { parseDate } from '@/lib/format'

const NAMESPACE = import.meta.env.VITE_FIREBASE_DATA_NAMESPACE || 'production'

const TARGET = 3

export interface SearchExamples {
  competitions: string[]
  venues: string[]
  places: string[]
  dancers: string[]
  judges: string[]
  pipers: string[]
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
  venues: [],
  places: [],
  dancers: [],
  judges: [],
  pipers: [],
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

  // Accumulate into a local object and swap atomically at the end, so the UI
  // doesn't flash with partially-filled categories during the awaited fetches.
  const next: SearchExamples = {
    competitions: [],
    venues: [],
    places: [],
    dancers: [],
    judges: [],
    pipers: [],
  }

  try {
    const sorted = [...list].sort((a, b) => {
      const aD = a.date ? parseDate(a.date).getTime() : 0
      const bD = b.date ? parseDate(b.date).getTime() : 0
      return bD - aD
    })

    for (const comp of sorted) {
      if (allFull(next)) break

      pushUnique(next, 'competitions', comp.name)
      // Split so suggestions mirror the entity model: venues get their own
      // section (they're first-class entities with profile pages); locality and
      // region go under Places (they filter the comp list but aren't entities).
      pushUnique(next, 'venues', comp.venue)
      pushUnique(next, 'places', comp.locality)
      pushUnique(next, 'places', comp.region)

      const needDancers = !isFull(next, 'dancers')
      const needJudges = !isFull(next, 'judges')
      const needPipers = !isFull(next, 'pipers')
      if (!needDancers && !needJudges && !needPipers) continue

      try {
        const [dancersSnap, staffSnap] = await Promise.all([
          needDancers
            ? get(dbRef(database, `${NAMESPACE}/competitions:data/${comp.id}/dancers`))
            : Promise.resolve(null),
          needJudges || needPipers
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
            const name = `${s?.firstName ?? ''} ${s?.lastName ?? ''}`.trim()
            if (s?.type === 'Judge') pushUnique(next, 'judges', name)
            else if (s?.type === 'Piper') pushUnique(next, 'pipers', name)
          })
        }
      } catch {
        // Quietly skip — likely permission-gated for anonymous users.
      }
    }

    examples.value = next
    loaded = true
  } finally {
    // Always release the skeleton, even if the loop above threw — otherwise
    // one bad iteration would brick the suggestions UI forever.
    loading.value = false
  }
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
