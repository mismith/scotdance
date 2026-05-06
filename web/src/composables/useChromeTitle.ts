import {
  inject,
  onScopeDispose,
  provide,
  ref,
  type InjectionKey,
  type Ref,
} from 'vue'

const KEY: InjectionKey<Ref<string | null>> = Symbol('chromeTitle')

/**
 * Provided by a Layout that owns the floating chrome (e.g. CompetitionLayout).
 * Drill-down child views can call {@link injectChromeTitle} to set their own
 * title in the chrome (e.g. group name, event name).
 */
export function provideChromeTitle(): Ref<string | null> {
  const title = ref<string | null>(null)
  provide(KEY, title)
  return title
}

/**
 * Returns a ref that, when set by a child view, displays in the parent's
 * floating chrome. Auto-clears on unmount so the parent reverts to its
 * default title.
 */
export function injectChromeTitle(): Ref<string | null> {
  const title = inject(KEY, null)
  if (!title) return ref<string | null>(null)
  onScopeDispose(() => {
    title.value = null
  })
  return title
}
