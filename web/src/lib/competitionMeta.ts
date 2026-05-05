import { child, get } from 'firebase/database'
import { dataRef } from '@/firebase'
import type { Competition } from '@/types/competition'

const cache = new Map<string, Promise<Competition | null>>()

export function fetchCompetitionMeta(id: string): Promise<Competition | null> {
  if (!cache.has(id)) {
    const promise = (async () => {
      try {
        const snap = await get(child(dataRef('competitions'), id))
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
