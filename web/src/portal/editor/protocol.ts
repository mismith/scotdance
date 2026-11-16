export const channel = 'scotdance:dancer-editor:v1'
/** Exact production applications; studio hosts must have a single valid slug. */
export function editorOrigin(origin: string, dev = false): boolean {
  try {
    const url = new URL(origin)
    if (url.origin !== origin) return false
    if (
      dev &&
      url.protocol === 'http:' &&
      ['localhost', '127.0.0.1'].includes(url.hostname)
    )
      return true
    if (url.protocol !== 'https:' || url.port) return false
    return (
      [
        'connect.scotdance.app',
        'entries.scotdance.app',
        'dev.entries.scotdance.app',
        'binder.scotdance.app',
      ].includes(url.hostname) ||
      /^[a-z0-9][a-z0-9-]{0,28}[a-z0-9]\.scotdance\.site$/.test(url.hostname)
    )
  } catch {
    return false
  }
}
export function editorMessage(
  event: MessageEvent,
  source: Window,
  origin: string,
  session: string,
): boolean {
  return (
    event.source === source &&
    event.origin === origin &&
    event.data?.channel === channel &&
    event.data?.session === session
  )
}
