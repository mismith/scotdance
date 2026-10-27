import { onScopeDispose, ref, watch, type Ref } from 'vue'
import { useEventListener, useMutationObserver, useResizeObserver } from '@vueuse/core'

// Keep the last section that passed the app bar in its subtitle. Headings
// stay in the document flow, so no separate strip covers the list's rows.
// An empty data-section clears the subtitle for an ungrouped section.
export function useScrollSection(main: Readonly<Ref<HTMLElement | null>>) {
  const currentSection = ref<string | null>(null)
  let frame: number | undefined

  function update() {
    frame = undefined
    const el = main.value
    if (!el) {
      currentSection.value = null
      return
    }
    const line = parseFloat(getComputedStyle(el).paddingTop) || 0
    let label: string | null = null
    for (const heading of el.querySelectorAll<HTMLElement>('[data-section]')) {
      // Favourites/recent lists can remain mounted while hidden.
      if (!heading.getClientRects().length) continue
      if (heading.getBoundingClientRect().top < line) label = heading.dataset.section || null
    }
    currentSection.value = label
  }

  function schedule() {
    if (frame === undefined) frame = requestAnimationFrame(update)
  }

  useEventListener(window, 'scroll', schedule, { passive: true })
  useEventListener(window, 'resize', schedule, { passive: true })
  useResizeObserver(main, schedule)
  // Search, async data and route transitions can replace sections without
  // scrolling. Observe the rendered list so the subtitle cannot go stale.
  useMutationObserver(main, schedule, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['data-section', 'style', 'hidden'],
  })
  watch(main, schedule, { immediate: true, flush: 'post' })
  onScopeDispose(() => {
    if (frame !== undefined) cancelAnimationFrame(frame)
  })

  return currentSection
}
