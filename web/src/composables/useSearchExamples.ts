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
const loading = ref(false)
let loaded = false

function pushUnique(key: Key, value: string | undefined | null) {
  if (!value) return
  const v = value.trim()
  if (!v) return
  if (isFull(examples.value, key)) return
  const arr = examples.value[key]
  if (arr.some((x) => x.toLowerCase() === v.toLowerCase())) return
  examples.value = {
    ...examples.value,
    [key]: [...arr, v],
  }
}

async function load(list: CompetitionListItem[]) {
  if (loaded || loading.value || !list.length) return

  loading.value = true

  const sorted = [...list].sort((a, b) => {
    const aD = a.date ? parseDate(a.date).getTime() : 0
    const bD = b.date ? parseDate(b.date).getTime() : 0
    return bD - aD
  })

  for (const comp of sorted) {
    if (allFull(examples.value)) break

    pushUnique('competitions', comp.name)
    // Try the most-specific place fields first.
    pushUnique('places', comp.locality)
    pushUnique('places', comp.venue)
    pushUnique('places', comp.region)

    const needDancers = !isFull(examples.value, 'dancers')
    const needJudges = !isFull(examples.value, 'judges')
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
        const dancers = (dancersSnap.val() as Record<
          string,
          { firstName?: string; lastName?: string }
        > | null) ?? {}
        Object.values(dancers).forEach((d) => {
          const name = `${d?.firstName ?? ''} ${d?.lastName ?? ''}`.trim()
          pushUnique('dancers', name)
        })
      }

      if (staffSnap) {
        const staff = (staffSnap.val() as Record<
          string,
          { firstName?: string; lastName?: string; type?: string }
        > | null) ?? {}
        Object.values(staff).forEach((s) => {
          if (s?.type !== 'Judge') return
          const name = `${s?.firstName ?? ''} ${s?.lastName ?? ''}`.trim()
          pushUnique('judges', name)
        })
      }
    } catch {
      // Quietly skip — likely permission-gated for anonymous users.
    }
  }

  loading.value = false
  loaded = true
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
