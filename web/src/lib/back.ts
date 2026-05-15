import { computed, ref, watch } from 'vue'
import { useRoute, useRouter, type RouteLocationRaw, type Router } from 'vue-router'

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

/**
 * For section layouts whose bottom-left button anchors the section list:
 * surface a top-left chevron back when browser-back goes elsewhere (e.g.
 * arrived from /search). Skip when redundant with the section anchor.
 */
export function useExternalBack(sectionRoute: RouteLocationRaw) {
  const route = useRoute()
  const router = useRouter()
  // Compare path only — list URLs carry query state (?q=, ?view=) that
  // shouldn't make the back chevron think we came from elsewhere.
  const sectionPath = router.resolve(sectionRoute).path

  const to = ref<string | null>(backPath())
  watch(() => route.fullPath, () => {
    to.value = backPath()
  })

  const show = computed(() => {
    if (to.value === null) return false
    const path = to.value.split(/[?#]/)[0]
    // Hide when back stays inside this section (list URL + any detail tab
    // under it — e.g. /competitions/X/dancers → /competitions/X/info is
    // tab-switching, not external-back).
    return path !== sectionPath && !path.startsWith(sectionPath + '/')
  })

  return { to, show }
}
