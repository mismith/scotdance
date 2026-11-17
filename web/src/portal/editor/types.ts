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

export interface AccessRequest {
  action: 'access' | 'invite'
  id: string
  operation?: 'list' | 'remove' | 'leave' | 'revoke'
  ownerUid?: string
  accessRevision?: number
  invitationId?: string
  email?: string
  ids?: string[]
  requestId?: string
}
export interface AccessState {
  id: string
  name: string
  shared: boolean
  emailVerified: boolean
  accessRevision: number
  owners: { uid: string; name: string; you: boolean }[]
  invitations: { id: string; email: string; delivery: string }[]
  dancers: { id: string; name: string }[]
}
