interface ViewTransitionHandle {
  captured: Promise<void>
  ready: Promise<void>
  finished: Promise<void>
  updateCallbackDone: Promise<void>
  skipTransition: () => void
}

/** Makes the change; can add to the transition's types once it's made. */
type UpdateCallback = (types?: Set<string>) => void | Promise<void>

// The page ignores taps while a transition plays, so on a slow or busy
// device cut it short rather than leave the page unresponsive.
const BUDGET_MS = 1000

export function startViewTransition(
  callback: UpdateCallback = () => {},
  types: string[] = [],
): ViewTransitionHandle {
  if (!('startViewTransition' in document)) {
    const done = Promise.resolve(callback())
    return {
      captured: Promise.resolve(),
      ready: done,
      finished: done,
      updateCallbackDone: done,
      skipTransition: () => {},
    }
  }

  const handle = {} as ViewTransitionHandle
  handle.captured = new Promise<void>((resolve) => {
    let native: ViewTransition
    try {
      native = document.startViewTransition({
        async update() {
          resolve()
          await callback((native as (ViewTransition & { types?: Set<string> }) | undefined)?.types)
        },
        types,
      })
    } catch (error) {
      console.warn(error)
      native = document.startViewTransition(async () => {
        resolve()
        await callback()
      })
    }
    // A transition cut short (a new navigation mid-way) rejects these; that's
    // expected, so don't let it surface as an unhandled error.
    native.ready.catch(() => {})
    const budget = setTimeout(() => native.skipTransition(), BUDGET_MS)
    native.finished.catch(() => {}).finally(() => clearTimeout(budget))
    handle.updateCallbackDone = native.updateCallbackDone
    handle.ready = native.ready
    handle.finished = native.finished
    handle.skipTransition = native.skipTransition.bind(native)
  })
  return handle
}
