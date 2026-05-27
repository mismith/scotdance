import type { ObjectDirective } from 'vue'

// Liquid-glass-style press feedback. Captures the pointer-down coords so the
// CSS gradient anchors at the finger. The visual lives in style.css under
// [data-tap-feedback] — this directive only writes coords + the data-tapping
// attribute and ensures the host can position the ::after overlay.
interface TapFeedbackEl extends HTMLElement {
  __tapFeedbackCleanup?: () => void
}

function setOrigin(el: HTMLElement, e: PointerEvent) {
  const rect = el.getBoundingClientRect()
  el.style.setProperty('--tap-x', `${e.clientX - rect.left}px`)
  el.style.setProperty('--tap-y', `${e.clientY - rect.top}px`)
}

export const vTapFeedback: ObjectDirective<TapFeedbackEl> = {
  mounted(el) {
    if (getComputedStyle(el).position === 'static') {
      el.style.position = 'relative'
    }
    // Defer the attribute by one frame so the ::after pseudo-element is
    // created in a quiet frame. Some browsers fire transitions on initial
    // pseudo-element creation, producing a fade-in flash on every mount —
    // visible when several v-tap-feedback elements mount at once
    // (e.g. crossing a route into a page with multiple ExpandingPills).
    const raf = requestAnimationFrame(() =>
      el.setAttribute('data-tap-feedback', ''),
    )

    const onDown = (e: PointerEvent) => {
      setOrigin(el, e)
      el.setAttribute('data-tapping', '')
    }
    const onEnd = () => el.removeAttribute('data-tapping')

    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointerup', onEnd)
    el.addEventListener('pointercancel', onEnd)
    el.addEventListener('pointerleave', onEnd)

    el.__tapFeedbackCleanup = () => {
      cancelAnimationFrame(raf)
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointerup', onEnd)
      el.removeEventListener('pointercancel', onEnd)
      el.removeEventListener('pointerleave', onEnd)
    }
  },
  unmounted(el) {
    el.__tapFeedbackCleanup?.()
  },
}
