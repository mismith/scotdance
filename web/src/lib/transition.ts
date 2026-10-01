interface ViewTransitionHandle {
  captured: Promise<void>
  ready: Promise<void>
  finished: Promise<void>
  updateCallbackDone: Promise<void>
  skipTransition: () => void
}

type UpdateCallback = () => void | Promise<void>

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
          await callback()
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
    native.finished.catch(() => {})
    handle.updateCallbackDone = native.updateCallbackDone
    handle.ready = native.ready
    handle.finished = native.finished
    handle.skipTransition = native.skipTransition.bind(native)
  })
  return handle
}
