import type { ObjectDirective } from 'vue'

// "Someone nearby": with a mouse or trackpad, an element catches a soft light
// that follows the pointer as it approaches (the `proximity` utility in
// style.css draws it from --near, --mx and --my). One shared, rAF-throttled
// listener serves every registered element. Nothing happens on touch, or with
// Reduce Motion or Reduce Transparency on.

const REACH = 96 // px from the element's edge where the light starts
const els = new Set<HTMLElement>()
let raf = 0
let px = 0
let py = 0
let listening = false

const enabled = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(hover: hover) and (pointer: fine)').matches &&
  !window.matchMedia('(prefers-reduced-motion: reduce)').matches &&
  !window.matchMedia('(prefers-reduced-transparency: reduce)').matches

function tick() {
  raf = 0
  for (const el of els) {
    const r = el.getBoundingClientRect()
    if (!r.width) continue
    const dx = Math.max(r.left - px, 0, px - r.right)
    const dy = Math.max(r.top - py, 0, py - r.bottom)
    const near = Math.max(0, 1 - Math.hypot(dx, dy) / REACH)
    const prev = el.style.getPropertyValue('--near')
    if (near === 0 && (prev === '' || prev === '0')) continue
    el.style.setProperty('--near', near.toFixed(3))
    el.style.setProperty('--mx', `${px - r.left}px`)
    el.style.setProperty('--my', `${py - r.top}px`)
  }
}

function onMove(e: PointerEvent) {
  if (e.pointerType !== 'mouse' && e.pointerType !== 'pen') return
  px = e.clientX
  py = e.clientY
  if (!raf) raf = requestAnimationFrame(tick)
}

function onLeave() {
  for (const el of els) el.style.setProperty('--near', '0')
}

/** `v-proximity`, or `v-proximity="false"` to opt a shared component's instance out. */
export const vProximity: ObjectDirective<HTMLElement, boolean | undefined> = {
  mounted(el, binding) {
    if (binding.value === false || !enabled()) return
    els.add(el)
    if (!listening) {
      listening = true
      window.addEventListener('pointermove', onMove, { passive: true })
      document.documentElement.addEventListener('pointerleave', onLeave)
    }
  },
  unmounted(el) {
    els.delete(el)
  },
}
