import { dataRef } from '@/firebase'
import { getStamp } from '@/lib/offline'

// When each part of a competition last changed (its details, and each
// section of its data), as the server stamps it: a copy saved on the device
// at the same stamp is still current (see getSavedAt), so a competition read
// before costs almost nothing to show again. After an organiser edits one
// here, its stamps can trail the edit by a second or two, so this device
// reads that competition afresh for the rest of the visit.

export type Changed = Record<string, number> | null

const editedHere = new Set<string>()
const pending = new Map<string, Promise<Changed>>()

/** The competition's stamps; null when there's nothing to go by. */
export function competitionChanged(id: string): Promise<Changed> {
  if (editedHere.has(id)) return Promise.resolve(null)
  let p = pending.get(id)
  if (!p) {
    // Shared while in flight: a competition's sections load together.
    p = getStamp<Record<string, number>>(dataRef(`competitions:changed/${id}`)).finally(() => pending.delete(id))
    pending.set(id, p)
  }
  return p
}

/** One part's stamp: `details`, or a section such as `results`. */
export function stampOf(changed: Changed, part: string): number | null {
  const v = changed?.[part]
  return typeof v === 'number' ? v : null
}

/** An organiser changed it on this device: stop going by its stamps for this visit. */
export function editedCompetition(id: string) {
  editedHere.add(id)
}
