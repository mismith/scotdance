import type { Dancer } from '../account'
export interface EditorContext {
  dancer?: Dancer
  defaults: { studio: string; location?: Dancer['location'] }
  defaultsRevision: number
  otherDancers: boolean
}
export interface EditorWrite {
  action: 'save' | 'delete'
  dancer: Dancer
  defaults: { studio?: boolean; location?: boolean }
  defaultsRevision: number
  requestId: string
}
export type EditorResult =
  { id: string; dancer: Dancer; deleted?: false } | { id: string; deleted: true }
