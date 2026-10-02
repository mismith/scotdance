// Height reveals and collapses for <Transition> and <TransitionGroup>'s
// JavaScript hooks (`@enter="grow" @leave="shrink"` with `:css="false"`),
// so whatever is below glides instead of jumping. In script, as CSS can't
// animate to or from `height: auto` everywhere yet (interpolate-size isn't in
// Safari). With Reduce Motion, things only fade.

const STANDARD = 'cubic-bezier(0.2, 0, 0, 1)'
const EXIT = 'cubic-bezier(0.4, 0, 1, 1)'

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches

/** The element at its natural size, and folded flat (padding and margins too). */
function sizes(el: HTMLElement): [Keyframe, Keyframe] {
  const cs = getComputedStyle(el)
  const open = {
    height: `${el.offsetHeight}px`,
    paddingTop: cs.paddingTop,
    paddingBottom: cs.paddingBottom,
    marginTop: cs.marginTop,
    marginBottom: cs.marginBottom,
    opacity: 1,
  }
  const shut = { height: '0px', paddingTop: '0px', paddingBottom: '0px', marginTop: '0px', marginBottom: '0px', opacity: 0 }
  return [open, shut]
}

function run(el: Element, frames: Keyframe[], duration: number, easing: string, done: () => void) {
  const node = el as HTMLElement
  if (typeof node.animate !== 'function') return done()
  const overflow = node.style.overflow
  node.style.overflow = 'clip'
  const a = node.animate(frames, { duration, easing })
  const finish = () => {
    node.style.overflow = overflow
    done()
  }
  a.onfinish = finish
  a.oncancel = finish
}

/** Grow from nothing to its natural height. */
export function grow(el: Element, done: () => void) {
  if (reduced()) return run(el, [{ opacity: 0 }, { opacity: 1 }], 160, STANDARD, done)
  const [open, shut] = sizes(el as HTMLElement)
  run(el, [shut, open], 280, STANDARD, done)
}

/** Fold away to nothing. */
export function shrink(el: Element, done: () => void) {
  if (reduced()) return run(el, [{ opacity: 1 }, { opacity: 0 }], 120, EXIT, done)
  const [open, shut] = sizes(el as HTMLElement)
  run(el, [open, shut], 220, EXIT, done)
}
