interface ViewTransitionHandle {
  captured: Promise<void>
  ready: Promise<void>
  finished: Promise<void>
  updateCallbackDone: Promise<void>
  skipTransition: () => void
}

type UpdateCallback = () => void | Promise<void>

interface NativeViewTransition {
  ready: Promise<void>
  finished: Promise<void>
  updateCallbackDone: Promise<void>
  skipTransition: () => void
}

interface DocumentWithViewTransition extends Document {
  startViewTransition?: (
    callback: UpdateCallback | { update: UpdateCallback; types?: string[] },
  ) => NativeViewTransition
}

export function startViewTransition(
  callback: UpdateCallback = () => {},
  types: string[] = [],
): ViewTransitionHandle {
  const doc = document as DocumentWithViewTransition

  if (!doc.startViewTransition) {
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
    let native: NativeViewTransition
    try {
      native = doc.startViewTransition!({
        async update() {
          resolve()
          await callback()
        },
        types,
      })
    } catch (error) {
      console.warn(error)
      native = doc.startViewTransition!(async () => {
        resolve()
        await callback()
      })
    }
    handle.updateCallbackDone = native.updateCallbackDone
    handle.ready = native.ready
    handle.finished = native.finished
    handle.skipTransition = native.skipTransition.bind(native)
  })
  return handle
}
