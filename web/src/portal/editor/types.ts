import type { Dancer } from '../account'
export interface EditorContext {
  /** Presentation only. Hidden fields are omitted from writes, never cleared. */
  hiddenFields?: Array<'photo' | 'publicDancer'>
  /** Opt-in only: host must persist photos in the account owner’s private store. */
  photo?: { value: string | null }
  dancer?: Dancer
  defaults: { studio: string; location?: Dancer['location'] }
  defaultsRevision: number
  otherDancers: boolean
}
export interface EditorWrite {
  /** Undefined leaves the stored photo unchanged; null explicitly removes it. */
  photo?: string | null
  action: 'save' | 'delete'
  dancer: Dancer
  defaults: { studio?: boolean; location?: boolean }
  defaultsRevision: number
  requestId: string
}
export type EditorResult =
  { id: string; dancer: Dancer; deleted?: false } | { id: string; deleted: true }

export interface AccessRequest {
  action: 'access' | 'invite' | 'verify-email'
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
