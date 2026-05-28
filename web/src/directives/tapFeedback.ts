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
  // Floor the visible growth at ~6px so the scale reads on small (size-12)
  // buttons too — 6% of 48px is only ~3px, which is imperceptible.
  const shorter = Math.min(rect.width, rect.height)
  el.style.setProperty('--tap-scale', String(Math.max(1.06, 1 + 6 / shorter)))
}

export const vTapFeedback: ObjectDirective<TapFeedbackEl> = {
  mounted(el) {
    if (getComputedStyle(el).position === 'static') {
      el.style.position = 'relative'
    }
    // Mount the ::after immediately, then enable transitions next frame.
    // If transitions are live the moment the pseudo-element is created,
    // Safari animates it from its UA-default opacity to 0 over 220ms —
    // visible as a phantom press-release on every button. Normally hidden
    // under the view-transition snapshot, but exposed on iOS swipe-back
    // (where we skip the VT).
    el.setAttribute('data-tap-feedback', '')
    const raf = requestAnimationFrame(() =>
      el.setAttribute('data-tap-feedback-ready', ''),
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
