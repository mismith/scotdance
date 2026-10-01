import { computed, ref, watch } from 'vue'
import { useRoute, type RouteLocationRaw, type Router } from 'vue-router'

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
 * Up to a parent page ("Back to Competitions" on a shared link). When that's
 * the page before this one, step back (the scroll comes back too); otherwise
 * replace this page rather than add one, so the browser's (and Android's)
 * Back doesn't walk forward into it again.
 */
export function goUp(router: Router, to: RouteLocationRaw) {
  const back = backPath()?.split(/[?#]/)[0]
  if (back && back === router.resolve(to).path) router.back()
  else router.replace(to)
}
