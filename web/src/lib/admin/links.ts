import { httpsCallable } from 'firebase/functions'
import { functions } from '@/firebase'
import { connected } from '@/lib/offline'
import { OfflineError } from '@/lib/admin/write'
import type { LinkPart } from '@/lib/linked'

// Every change to a link goes through the server (functions/src/links.ts):
// it checks you manage each competition it changes, and copies the
// primary's parts across. A dry run says what would be replaced, so Manage
// can confirm first.

export type LinkParams =
  | { action: 'link'; competitionId: string; withId: string; parts?: LinkPart[]; dryRun?: boolean }
  | { action: 'unlink'; competitionId: string }
  | { action: 'primary'; competitionId: string; dryRun?: boolean }
  | { action: 'sync'; competitionId: string; part: LinkPart; on: boolean; dryRun?: boolean }
  | { action: 'syncNow'; competitionId: string }

export interface PartPreview {
  part: LinkPart
  /** It has something of its own there now, which this replaces. */
  replaces: boolean
  /** Why it can't be taken (staff whose championship points would be lost). */
  blocked?: string | null
  staff?: {
    count: number
    replacing: number
    /** Dropped while something still pointed at them (sponsors, schedule judges): cleared. */
    cleared: Array<{ name: string; sponsors: number; judging: number }>
  }
}

export interface LinkPreview {
  joining?: string
  primary?: string
  targets: Array<{ competitionId: string; parts: PartPreview[] }>
}

export async function changeLink<R = { linkId: string | null }>(params: LinkParams): Promise<R> {
  if (!connected.value) throw new OfflineError()
  const call = httpsCallable<LinkParams, R>(functions, 'linkCompetitions', { timeout: 120_000 })
  return (await call(params)).data
}

export const previewLink = (params: LinkParams & { dryRun?: boolean }) => changeLink<LinkPreview>({ ...params, dryRun: true } as LinkParams)
