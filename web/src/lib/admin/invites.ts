// Admin invites, as stored since v3 (@mismith/firebase-tools' FirebaseInvites).
// Accepting writes `accepted`; the server then checks the invite, sets
// `acceptedBy` and gives access. An accept it turned down (the invite was
// cancelled at that moment) or hasn't got to yet doesn't count.

export interface Invite {
  created?: string
  cancelled?: string
  expires?: string
  accepted?: string
  acceptedBy?: string
  payload?: { email?: string }
}

export type InviteStatus = 'accepted' | 'accepting' | 'cancelled' | 'expired' | 'pending'

const past = (iso: string | undefined, now: number) => !!iso && new Date(iso).getTime() <= now

export function inviteStatus(i: Invite, now = Date.now()): InviteStatus {
  if (past(i.accepted, now) && i.acceptedBy) return 'accepted'
  if (past(i.cancelled, now)) return 'cancelled'
  if (past(i.expires, now)) return 'expired'
  return past(i.accepted, now) ? 'accepting' : 'pending'
}
