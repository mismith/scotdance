import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { useHead } from '@unhead/vue'

const SUFFIX = 'ScotDance.app'
const SEP = ' • '

// Builds a page title from ordered parts (most-specific first, e.g. tab, entity,
// section) and appends the app suffix. Falsy parts are dropped. The suffix is
// stripped from each part before joining so labels like "About ScotDance.app"
// (used for back-pill / More menu) render as "About • ScotDance.app" — single
// source of truth, no duplication.
export function usePageTitle(parts: MaybeRefOrGetter<(string | null | undefined)[]>) {
  useHead({
    title: computed(() => buildTitle(toValue(parts))),
  })
}

export function buildTitle(parts: (string | null | undefined)[]): string {
  const cleaned = parts
    .map((p) => p?.trim())
    .map((p) => (p?.endsWith(SUFFIX) ? p.slice(0, -SUFFIX.length).trim() : p))
    .filter((p): p is string => !!p)
  if (cleaned.length === 0) return SUFFIX
  return [...cleaned, SUFFIX].join(SEP)
}
