import { computed, ref, watch } from 'vue'
import { useRoute, type Router } from 'vue-router'

function isPlainClick(event: MouseEvent) {
  return (
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey &&
    event.button === 0
  )
}

export function backPath() {
  return (window.history.state as { back?: string } | null)?.back ?? null
}

/**
 * Reactive flag for whether browser-back would stay inside the app.
 * Re-evaluates on every navigation.
 */
export function useCanGoBack() {
  const route = useRoute()
  const can = ref(backPath() !== null)
  watch(() => route.fullPath, () => {
    can.value = backPath() !== null
  })
  return computed(() => can.value)
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
