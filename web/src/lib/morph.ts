import { nextTick, reactive, ref, shallowRef } from 'vue'
import { startViewTransition } from '@/lib/transition'

// Morph: whatever opens something (a button, a row, a tab) grows into it,
// and it shrinks back into the same place when it closes, the way iOS 26
// opens sheets and menus. Pair a trigger with a target:
//
//   const menu = useMorph()
//   <button @click="menu.show">…</button>          the trigger is the clicked element
//   <Dialog :open="menu.open" :morph="menu" @close="menu.hide()">…</Dialog>
//
// Only one element at a time carries the `morph` view-transition name: the
// trigger before opening, the target once open (and the reverse to close).
// The look lives in style.css under "Morph". Without View Transitions, or
// with Reduce Motion on, things just open and close.

export const morphSupported = typeof document !== 'undefined' && 'startViewTransition' in document
const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches

const NAME = 'morph'

// The control most recently pressed, so a sheet opened indirectly (a store
// action, after signing in) can still grow out of what was tapped.
let lastPressed: { el: HTMLElement; at: number } | null = null
if (typeof document !== 'undefined') {
  document.addEventListener(
    'pointerdown',
    (e) => {
      const el = (e.target as Element | null)?.closest?.('button, a, [role="button"]')
      if (el instanceof HTMLElement) lastPressed = { el, at: performance.now() }
    },
    true,
  )
}
function recentlyPressed(): HTMLElement | null {
  if (lastPressed && performance.now() - lastPressed.at < 1500) return lastPressed.el
  const focused = document.activeElement
  return focused instanceof HTMLElement && focused.matches('button, a, [role="button"]') ? focused : null
}

// Morphs run one at a time: a new one waits for the last to finish, so a
// quick reopen can't start while the previous snapshot still holds the name.
let queue: Promise<void> = Promise.resolve()

function onScreen(el: HTMLElement | null): el is HTMLElement {
  if (!el?.isConnected) return false
  const r = el.getBoundingClientRect()
  return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight
}

/** The shape the morph's surface starts or ends as. */
function paintSurface(el: HTMLElement, end: 'from' | 'to') {
  const cs = getComputedStyle(el)
  const root = document.documentElement.style
  const bg = cs.backgroundColor
  // A pill's radius computes as 9999px; cap each corner at what's visible so
  // the surface doesn't balloon through huge radii on the way.
  const r = el.getBoundingClientRect()
  const cap = Math.min(r.width, r.height) / 2
  const corners = [cs.borderTopLeftRadius, cs.borderTopRightRadius, cs.borderBottomRightRadius, cs.borderBottomLeftRadius]
  root.setProperty(`--morph-${end}-radius`, corners.map((c) => `${Math.min(parseFloat(c) || 0, cap)}px`).join(' '))
  root.setProperty(`--morph-${end}-bg`, bg === 'rgba(0, 0, 0, 0)' ? 'var(--color-card)' : bg)
  root.setProperty(`--morph-${end}-corner`, cs.getPropertyValue('corner-shape') || 'round')
}

export type Morph = ReturnType<typeof useMorph>

export function useMorph() {
  const open = ref(false)
  const trigger = shallowRef<HTMLElement | null>(null)
  const target = shallowRef<HTMLElement | null>(null)

  function set(next: boolean) {
    queue = queue.then(() => run(next))
    return queue
  }

  async function run(next: boolean) {
    if (open.value === next) return
    const leaving = next ? trigger.value : target.value
    if (!morphSupported || reduceMotion() || !onScreen(leaving)) {
      open.value = next
      return
    }
    paintSurface(leaving, 'from')
    leaving.style.viewTransitionName = NAME
    const transition = startViewTransition(async () => {
      leaving.style.viewTransitionName = ''
      open.value = next
      await nextTick()
      const arriving = next ? target.value : trigger.value
      if (onScreen(arriving)) {
        paintSurface(arriving, 'to')
        arriving.style.viewTransitionName = NAME
      }
    }, [NAME])
    // An interrupted morph (say, a route change mid-way) just ends early.
    transition.ready.catch(() => {})
    await transition.finished.catch(() => {})
    for (const el of [trigger.value, target.value]) if (el) el.style.viewTransitionName = ''
  }

  /** Open, growing out of the clicked element, the one given, or failing
   *  those whatever was just pressed. */
  function show(from?: Event | HTMLElement | null) {
    const el = from instanceof Event ? from.currentTarget : (from ?? recentlyPressed())
    trigger.value = el instanceof HTMLElement ? el : null
    return set(true)
  }
  const hide = () => set(false)
  /** Close at once, e.g. when a menu item navigates away (like iOS menus). */
  const dismiss = () => {
    open.value = false
  }
  const toggle = (from?: Event | HTMLElement | null) => (open.value ? hide() : show(from))
  /** For the component that renders the opened thing (Dialog does this). */
  const setTarget = (el: HTMLElement | null) => (target.value = el)

  return reactive({ open, show, hide, dismiss, toggle, setTarget })
}
