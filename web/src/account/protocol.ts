export const ACCOUNT_CHANNEL = 'scotdance:account'
export const CONNECT_ORIGIN = 'https://connect.scotdance.app'
/** Binding both the window and exact origin prevents a sibling app driving account controls. */
export function accountOwner(event: { origin: string; source: unknown; data: unknown }, parent: unknown): string | null {
  if (event.origin !== CONNECT_ORIGIN || event.source !== parent || !event.data || typeof event.data !== 'object') return null
  const data = event.data as Record<string, unknown>
  return data.channel === ACCOUNT_CHANNEL && data.type === 'init' && typeof data.uid === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(data.uid) ? data.uid : null
}
