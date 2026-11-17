import { httpsCallable } from 'firebase/functions'
import { functions } from '@/firebase'
import { TOOLS, type Audience } from '@/connect/protocol'
export { linkedTools, toolDate, type ToolLink } from '@/account/tool-links'

// The ScotDance tools someone signs in to with this account (ADR 0017):
// `users:tools/{uid}/{tool}` holds when they first and last did.

export { TOOLS, type Audience }

/** Sign them out of the tool everywhere and forget the link: yourself, or anyone for a system admin. */
export async function unlinkTool(tool: Audience, uid?: string) {
  await httpsCallable<{ tool: Audience; uid?: string }, unknown>(functions, 'unlinkTool')(uid ? { tool, uid } : { tool })
}

/** Every tool, when deleting an account: the account goes either way. */
export async function unlinkEveryTool() {
  await httpsCallable(functions, 'unlinkTool')({}).catch(() => {})
}
