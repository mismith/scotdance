import {
  inject,
  onMounted,
  provide,
  ref,
  type InjectionKey,
  type Ref,
} from 'vue'
import { useEventListener, useIntersectionObserver } from '@vueuse/core'

// True once `target`'s top edge scrolls under the app bar. Drives the
// "small title pill fades into the fixed nav once the in-flow large title
// scrolls past" pattern (iOS Mail / Notes style).
export function useScrolledPast(
  target: Readonly<Ref<HTMLElement | null>>,
): Ref<boolean> {
  const scrolledPast = ref(false)
  // The bar's bottom edge: 3.5rem plus the status bar (notch), which a fixed
  // 56px missed, so on phones the small title showed before the glass did.
  const barBottom = ref(56)
  const measure = () => (barBottom.value = chromeTop() || 56)
  onMounted(measure)
  useEventListener('resize', measure, { passive: true })
  useIntersectionObserver(
    target,
    ([entry]) => {
      if (!entry) return
      // By its top edge alone: a page sliding in from the side (lib/
      // pageMotion) has its title partly off screen without being scrolled.
      scrolledPast.value = entry.boundingClientRect.top < (entry.rootBounds?.top ?? barBottom.value)
    },
    // Flip once the title slides under the app bar.
    { threshold: 1, rootMargin: () => `-${barBottom.value}px 0px 0px 0px` },
  )
  return scrolledPast
}

// --chrome-top in pixels (a calc over env(), so it has to be laid out to read).
function chromeTop(): number {
  const probe = document.createElement('div')
  probe.style.cssText = 'position:fixed;visibility:hidden;height:var(--chrome-top)'
  document.body.append(probe)
  const h = probe.offsetHeight
  probe.remove()
  return h
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

