import type { Component } from 'vue'
import type { RouteLocationRaw } from 'vue-router'
import { router } from '@/router'

// Single source of truth for "what does this section look like" — pulls
// title/icon off the route's meta (defined in router/index.ts) so labels and
// icons never have to be repeated by nav chrome.

export interface SectionMeta {
  label: string
  icon: Component | undefined
  to: RouteLocationRaw
  path: string
}

export function sectionMeta(routeName: string): SectionMeta {
  const resolved = router.resolve({ name: routeName })
  return {
    label: String(resolved.meta.title ?? routeName),
    icon: resolved.meta.icon,
    to: { name: routeName },
    path: resolved.path,
  }
}
