import type { Router } from 'vue-router'

function isPlainClick(event: MouseEvent) {
  return (
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey &&
    event.button === 0
  )
}

function backPath() {
  return (window.history.state as { back?: string } | null)?.back ?? null
}

/**
 * For destination-labeled links ("Back to Competitions"). Only short-circuit
 * to `router.back()` when browser-back would land on that exact destination,
 * so scrollBehavior can restore the prior scroll. Otherwise navigate normally.
 */
export function smartBackClick(
  router: Router,
  event: MouseEvent,
  targetFullPath: string,
  navigate: (e?: MouseEvent) => void,
) {
  if (!isPlainClick(event)) return
  const back = backPath()
  if (back && back === targetFullPath) {
    event.preventDefault()
    router.back()
    return
  }
  navigate(event)
}

/**
 * For generic chevron-back affordances. Prefer `router.back()` whenever
 * there is any history, falling back to the link's target on deep-link entry.
 */
export function preferBackClick(
  router: Router,
  event: MouseEvent,
  navigate: (e?: MouseEvent) => void,
) {
  if (!isPlainClick(event)) return
  if (backPath()) {
    event.preventDefault()
    router.back()
    return
  }
  navigate(event)
}
