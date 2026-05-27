import {
  inject,
  provide,
  ref,
  type InjectionKey,
  type Ref,
} from 'vue'
import { useIntersectionObserver } from '@vueuse/core'

// True as soon as `target` starts sliding under the fixed top chrome.
// Drives the "small title pill fades into the fixed nav once the in-flow
// large title scrolls past" pattern (iOS Mail / Notes style).
//
// threshold:1 + a negative top rootMargin equal to --chrome-top: the pill
// flips ON the moment any part of the title crosses under the fixed nav,
// keeping the page label visible somewhere at all times.
export function useScrolledPast(
  target: Readonly<Ref<HTMLElement | null>>,
  options: { topOffsetPx?: number } = {},
): Ref<boolean> {
  const { topOffsetPx = 80 } = options
  const scrolledPast = ref(false)
  useIntersectionObserver(
    target,
    ([entry]) => {
      if (!entry) return
      scrolledPast.value = entry.intersectionRatio < 1
    },
    { rootMargin: `-${topOffsetPx}px 0px 0px 0px`, threshold: 1 },
  )
  return scrolledPast
}

// Layout-side helpers: provide a header ref + its scrolled-past state for a
// child Info tab. The Info component registers its <header> via the
// setter; the layout reads `scrolledPast` to gate the small-title pill
// reveal; the Info component reads `scrolledPast` to strip its in-flow VTNs
// once the pill takes over as the morph target (mutually exclusive — only
// the visible representation owns the view-transition-name).

interface InfoHeaderCtx {
  el: Ref<HTMLElement | null>
  scrolledPast: Ref<boolean>
}

const InfoHeaderKey: InjectionKey<InfoHeaderCtx> = Symbol('InfoHeader')

export function provideInfoHeader(): InfoHeaderCtx {
  const el = ref<HTMLElement | null>(null)
  const scrolledPast = useScrolledPast(el)
  const ctx: InfoHeaderCtx = { el, scrolledPast }
  provide(InfoHeaderKey, ctx)
  return ctx
}

export function injectInfoHeaderSetter(): (target: unknown) => void {
  const ctx = inject(InfoHeaderKey, null)
  if (!ctx) return () => {}
  return (target) => {
    ctx.el.value = (target as HTMLElement | null) ?? null
  }
}

export function injectInfoHeaderScrolledPast(): Readonly<Ref<boolean>> {
  const ctx = inject(InfoHeaderKey, null)
  if (!ctx) return ref(false)
  return ctx.scrolledPast
}
