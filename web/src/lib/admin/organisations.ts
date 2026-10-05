import { httpsCallable } from 'firebase/functions'
import { functions } from '@/firebase'
import { connected } from '@/lib/offline'
import { OfflineError } from '@/lib/admin/write'

// Starting an organisation goes through the server, which makes you its
// admin (people can't give themselves access). See functions/src/organisations.ts.

interface CreateParams {
  name: string
  shortName?: string
  /** Also add it to this competition (one you manage). */
  competitionId?: string
  /** System admins: make it without becoming its admin. */
  join?: boolean
}

export async function createOrganisation(params: CreateParams): Promise<string> {
  if (!connected.value) throw new OfflineError()
  const call = httpsCallable<CreateParams, { organisationId: string }>(functions, 'createOrganisation')
  return (await call(params)).data.organisationId
}
