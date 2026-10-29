import { dayUnits } from '@/lib/print/day'
import { programUnits } from '@/lib/print/program'
import type { ProgramOptions } from '@/lib/print/program'
import type { PrintSource } from '@/lib/print/source'
import type { DocId, PartId, Unit } from '@/lib/print/model'

// The documents Manage › Print makes, and the parts each can include.

export interface PartDef {
  id: PartId
  label: string
}

export interface DocDef {
  id: DocId
  label: string
  parts: PartDef[]
}

export const DOCUMENTS: DocDef[] = [
  {
    id: 'program',
    label: 'Program',
    parts: [
      { id: 'cover', label: 'Cover' },
      { id: 'schedule', label: 'Schedule' },
      { id: 'groups', label: 'Age groups' },
    ],
  },
  {
    id: 'day',
    label: 'Platform sheets',
    parts: [
      { id: 'platforms', label: 'Platform sheets' },
    ],
  },
]

export const docDef = (id: DocId) => DOCUMENTS.find((d) => d.id === id) ?? DOCUMENTS[0]

/** A document's units, from the parts switched on. */
export function documentUnits(src: PrintSource, doc: DocId, parts: PartId[], opts: ProgramOptions): Unit[] {
  if (doc === 'day') return dayUnits(src, parts)
  return programUnits(src, parts, opts)
}
