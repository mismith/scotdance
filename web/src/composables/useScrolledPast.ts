import {
  inject,
  provide,
  ref,
  type InjectionKey,
  type Ref,
} from 'vue'
import { useIntersectionObserver } from '@vueuse/core'

// True once `target`'s top edge scrolls under the app bar. Drives the
// "small title pill fades into the fixed nav once the in-flow large title
// scrolls past" pattern (iOS Mail / Notes style).
export function useScrolledPast(
  target: Readonly<Ref<HTMLElement | null>>,
): Ref<boolean> {
  const scrolledPast = ref(false)
  useIntersectionObserver(
    target,
    ([entry]) => {
      if (!entry) return
      // By its top edge alone: a page sliding in from the side (lib/
      // pageMotion) has its title partly off screen without being scrolled.
      scrolledPast.value = entry.boundingClientRect.top < (entry.rootBounds?.top ?? 56)
    },
    // Flip once the title slides under the opaque app bar (3.5rem + notch).
    { threshold: 1, rootMargin: '-56px 0px 0px 0px' },
  )
  return scrolledPast
}

// Layout-side helpers: provide a header ref + its scrolled-past state for a
// child Info tab. The Info component registers its <header> via the setter;
// the layout reads `scrolledPast` to show the small title in the bar.

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

