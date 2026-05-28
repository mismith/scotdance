import {
  inject,
  provide,
  ref,
  type InjectionKey,
  type Ref,
} from 'vue'
import { useIntersectionObserver } from '@vueuse/core'

// True once `target`'s top edge scrolls above the viewport top. Drives the
// "small title pill fades into the fixed nav once the in-flow large title
// scrolls past" pattern (iOS Mail / Notes style).
//
// threshold:1 + no rootMargin: the pill flips ON the moment the title's
// top edge crosses y=0 of the viewport. Triggering at the chrome's bottom
// edge instead would fire while the in-flow title is still partly visible
// behind the frosted chrome — looks like a duplicate label.
export function useScrolledPast(
  target: Readonly<Ref<HTMLElement | null>>,
): Ref<boolean> {
  const scrolledPast = ref(false)
  useIntersectionObserver(
    target,
    ([entry]) => {
      if (!entry) return
      scrolledPast.value = entry.intersectionRatio < 1
    },
    { threshold: 1 },
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
