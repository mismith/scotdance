import { nextTick, reactive, ref, shallowRef } from 'vue'

// Morph: whatever opens something (a button, a row, a tab) grows into it,
// and it shrinks back into the same place when it closes, the way iOS 26
// opens sheets and menus. Pair a trigger with a target:
//
//   const menu = useMorph()
//   <button @click="menu.show">…</button>          the trigger is the clicked element
//   <Dialog :open="menu.open" :morph="menu" @close="menu.hide()">…</Dialog>
//
// Played on the live dialog: moved and clipped from the trigger's box to its
// own, and faded in from nothing at the trigger's end (out to nothing, when
// it closes), so the trigger holds still in the page under it. Only
// transform, clip and opacity move, so the compositor plays it and the page
// never freezes. With Reduce Motion on, things just open and close.

const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches

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
// quick reopen can't start while the previous one is still closing.
let queue: Promise<void> = Promise.resolve()

function onScreen(el: HTMLElement | null): el is HTMLElement {
  if (!el?.isConnected) return false
  const r = el.getBoundingClientRect()
  return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight
}

/** An element's corners, each capped at what's visible (a pill's computes as 9999px). */
function radiusOf(el: HTMLElement) {
  const cs = getComputedStyle(el)
  const r = el.getBoundingClientRect()
  const cap = Math.min(r.width, r.height) / 2
  const corners = [cs.borderTopLeftRadius, cs.borderTopRightRadius, cs.borderBottomRightRadius, cs.borderBottomLeftRadius]
  return corners.map((c) => `${Math.min(parseFloat(c) || 0, cap)}px`).join(' ')
}

/**
 * Where `el` starts when it grows out of `box`: scaled (evenly, so nothing
 * squashes) to cover the box from its top, and clipped to the box's shape.
 */
function grownFrom(el: HTMLElement, box: DOMRect, radius: string): Keyframe {
  const d = el.getBoundingClientRect()
  const s = Math.max(box.width / d.width, box.height / d.height)
  const x = box.left + box.width / 2 - (d.left + (d.width * s) / 2)
  const y = box.top - d.top
  // The clip is in the dialog's own (unscaled) space.
  const w = box.width / s
  const h = box.height / s
  const side = (d.width - w) / 2
  const r = radius
    .split(' ')
    .map((c) => `${parseFloat(c) / s}px`)
    .join(' ')
  return { transformOrigin: 'top left', transform: `translate(${x}px, ${y}px) scale(${s})`, clipPath: `inset(0 ${side}px ${d.height - h}px ${side}px round ${r})` }
}

export type Morph = ReturnType<typeof useMorph>

export function useMorph() {
  const open = ref(false)
  // Whether the last open or close grew out of (or into) its trigger. A
  // sheet with nothing on screen to grow from opens the ordinary way.
  const animated = ref(false)
  const trigger = shallowRef<HTMLElement | null>(null)
  const target = shallowRef<HTMLElement | null>(null)

  function set(next: boolean) {
    queue = queue.then(() => run(next))
    return queue
  }

  // On a phone, a sheet always slides up from the bottom edge, as a sheet
  // does, whatever opened it; it doesn't grow out of its trigger.
  function slidesInstead() {
    return target.value?.dataset.morphKind === 'sheet' && !matchMedia('(min-width: 48rem)').matches
  }

  async function run(next: boolean) {
    if (open.value === next) return
    const from = trigger.value
    // Growing out of (or back into) a trigger that's on screen; otherwise
    // the dialog opens and closes the ordinary way.
    if (reduceMotion() || !onScreen(from) || slidesInstead()) {
      animated.value = false
      open.value = next
      return
    }
    animated.value = true
    const box = from.getBoundingClientRect()
    if (next) {
      open.value = true
      await nextTick()
    }
    const el = target.value
    if (!onScreen(el)) {
      open.value = next
      return
    }
    const pinned = el.dataset.morphKind === 'sheet' && !matchMedia('(min-width: 48rem)').matches
    const css = (n: string) => getComputedStyle(document.documentElement).getPropertyValue(n).trim()
    // Floating menus and centred cards spring a little; a sheet pinned to the
    // bottom edge doesn't overshoot it; closing is a quick ease back in.
    const timing: KeyframeAnimationOptions = next
      ? { duration: pinned ? 320 : 300, easing: css(pinned ? '--ease-snappy' : '--ease-elastic') || 'ease-out', fill: 'both' }
      : { duration: 220, easing: css('--ease-standard') || 'ease-in', fill: 'both' }
    const shut = grownFrom(el, box, radiusOf(from))
    const opened = { transformOrigin: 'top left', transform: 'none', clipPath: `inset(0 round ${radiusOf(el)})` }
    // Nothing at the trigger's end: it fades in as it leaves the trigger, and
    // out just before it gets back.
    const fade = next
      ? el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 150, easing: 'ease-out', fill: 'both' })
      : el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 120, delay: 100, easing: 'ease-in', fill: 'both' })
    const animations = [el.animate(next ? [shut, opened] : [opened, shut], timing), fade]
    try {
      animations.push(el.animate([{ opacity: next ? 0 : 1 }, { opacity: next ? 1 : 0 }], { ...timing, pseudoElement: '::backdrop' }))
    } catch {
      // No pseudo-element animations: the backdrop just shows.
    }
    await Promise.all(animations.map((a) => a.finished.catch(() => {})))
    if (!next) open.value = false
    await nextTick()
    for (const a of animations) a.cancel()
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

  return reactive({ open, animated, trigger, show, hide, dismiss, toggle, setTarget })
}
