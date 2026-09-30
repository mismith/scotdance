import type { ObjectDirective } from 'vue'

// Press feedback: marks the host with data-tapping while pressed so it can
// dim (see style.css). Outlasts iOS's brief :active on quick taps.
interface TapFeedbackEl extends HTMLElement {
  __tapFeedbackCleanup?: () => void
}

export const vTapFeedback: ObjectDirective<TapFeedbackEl> = {
  mounted(el) {
    // Transitions switch on a frame later so nothing animates on mount.
    el.setAttribute('data-tap-feedback', '')
    const raf = requestAnimationFrame(() =>
      el.setAttribute('data-tap-feedback-ready', ''),
    )

    const onDown = () => el.setAttribute('data-tapping', '')
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
