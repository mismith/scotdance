import { inject, onScopeDispose, provide, shallowRef, watchEffect, type ShallowRef } from 'vue'
import type { RouteLocationRaw, Router } from 'vue-router'
import { backPath } from '@/lib/back'

// Lets a Manage screen with its own levels (results, schedule) say where
// the phone's Back goes, e.g. from a dance back to its age group.

export interface ManageBack {
  to: RouteLocationRaw
  label: string
}

const key = Symbol('manageBack')

export function provideManageBack() {
  const back = shallowRef<ManageBack | null>(null)
  provide(key, back)
  return back
}

export function useManageBack(get: () => ManageBack | null) {
  const back = inject<ShallowRef<ManageBack | null> | null>(key, null)
  if (!back) return
  watchEffect(() => {
    back.value = get()
  })
  onScopeDispose(() => {
    back.value = null
  })
}

/**
 * Back to `target`. When that's the page before this one (the usual way
 * here), step back rather than adding a page, or the browser's (and
 * Android's) back button would walk forward into Manage again afterwards.
 */
export function viaHistory(router: Router, target: ManageBack): ManageBack | { delta: number; label: string } {
  const back = backPath()?.split(/[?#]/)[0]
  return back && back === router.resolve(target.to).path ? { delta: -1, label: target.label } : target
}
