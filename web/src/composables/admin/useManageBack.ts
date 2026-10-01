import { inject, onScopeDispose, provide, shallowRef, watchEffect, type ShallowRef } from 'vue'
import type { RouteLocationRaw } from 'vue-router'

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
