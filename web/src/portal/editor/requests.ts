/** How long the frame waits for the host app to answer a save or sharing request. */
export const replyTimeout = 60_000
export const noReply = 'That didn’t go through. Check your connection and try again.'

type Waiting = {
  reply: string
  resolve: (value: unknown) => void
  reject: (reason: Error) => void
  timer: ReturnType<typeof setTimeout>
}

/**
 * Requests to the host, each settled by a reply carrying its ID, or rejected after
 * `timeout` so a lost reply shows an error instead of an endless spinner. A retry
 * may reuse the ID: the host treats it as the same receipt.
 */
export function hostRequests(send: (type: string, data: object) => void, timeout = replyTimeout) {
  const waiting = new Map<string, Waiting>()
  function drop(id: string) {
    const entry = waiting.get(id)
    if (entry) clearTimeout(entry.timer)
    waiting.delete(id)
    return entry
  }
  function request<T>(type: string, reply: string, id: string, data: object): Promise<T> {
    return new Promise((resolve, reject) => {
      drop(id)?.reject(new Error(noReply))
      const timer = setTimeout(() => drop(id)?.reject(new Error(noReply)), timeout)
      waiting.set(id, { reply, resolve: resolve as (value: unknown) => void, reject, timer })
      try {
        send(type, data)
      } catch (error) {
        drop(id)
        reject(error instanceof Error ? error : new Error(noReply))
      }
    })
  }
  /** Settles the matching request; false when the reply is unknown or late. */
  function settle(type: string, data: { requestId?: unknown; error?: unknown; result?: unknown }) {
    if (typeof data.requestId !== 'string' || waiting.get(data.requestId)?.reply !== type) return false
    const entry = drop(data.requestId)!
    if (typeof data.error === 'string') entry.reject(new Error(data.error))
    else entry.resolve(data.result)
    return true
  }
  function cancel(reason: string) {
    for (const id of [...waiting.keys()]) drop(id)?.reject(new Error(reason))
  }
  return { request, settle, cancel }
}
