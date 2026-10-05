import { child } from 'firebase/database'
import { dataRef } from '@/firebase'
import { competitionChanged, editedCompetition, stampOf } from '@/lib/competitionChanged'
import { getSavedAt, onReconnect } from '@/lib/offline'
import type { Competition } from '@/types/competition'

const cache = new Map<string, Promise<Competition | null>>()
onReconnect(() => cache.clear())

export function forgetCompetitionMeta(id: string) {
  cache.delete(id)
  editedCompetition(id)
}

export function fetchCompetitionMeta(id: string): Promise<Competition | null> {
  if (!cache.has(id)) {
    const promise = (async () => {
      try {
        // Re-used from the device while its details haven't changed.
        const changed = await competitionChanged(id)
        const snap = await getSavedAt(child(dataRef('competitions'), id), stampOf(changed, 'details'))
        const value = snap.val()
        return value && typeof value === 'object' ? (value as Competition) : null
      } catch {
        return null
      }
    })()
    cache.set(id, promise)
  }
  return cache.get(id)!
}
