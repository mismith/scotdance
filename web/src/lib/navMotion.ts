// Which way a page change moves (M1): the way you went, matched to what you
// tapped, so the motion agrees with the layout on every screen size.
// - A tab bar or the sidebar: toward the item you tapped, along that menu
//   (across on a phone's tab bar, up or down the sidebar on wide screens).
// - A link in the page: deeper, in from the right (or back out, when it
//   leads up to a page this one is under).
// - Back (the back button, a competition's exit, the browser's Back): the
//   reverse of how you got here; the browser's Forward replays it.
// - Anything else (a redirect, moving on after a save): by the paths, deeper
//   in from the right, up out to the right, otherwise a quick swap in place.
// style.css plays each one (:active-view-transition-type).

import { nextTick } from 'vue'
import { startViewTransition } from '@/lib/transition'

export type Way = 'forward' | 'back' | 'next' | 'prev' | 'swap'
export interface Motion {
  way: Way
  axis: 'x' | 'y'
}

const INVERSE: Record<Way, Way> = { forward: 'back', back: 'forward', next: 'prev', prev: 'next', swap: 'swap' }
export const inverse = (m: Motion): Motion => ({ ...m, way: INVERSE[m.way] })

export const types = (m: Motion) => [m.way, `axis-${m.axis}`]

const segments = (path: string) => path.split('/').filter(Boolean)

/** By the paths alone: under the current page is deeper, above it is back. */
export function byPath(to: string, from: string): Motion {
  const t = segments(to)
  const f = segments(from)
  const under = (a: string[], b: string[]) => a.length > b.length && b.every((s, i) => a[i] === s)
  return { way: under(t, f) ? 'forward' : under(f, t) ? 'back' : 'swap', axis: 'x' }
}

/** Toward the tapped item from the menu's current one, along the menu. */
export function alongMenu(axis: 'x' | 'y', current: DOMRect, tapped: DOMRect): Motion {
  const d = axis === 'x' ? tapped.left - current.left : tapped.top - current.top
  return { way: d > 0 ? 'next' : d < 0 ? 'prev' : 'swap', axis }
}

// What was tapped last, so a navigation it starts can move to match. Menus
// say how they're laid out (`data-nav-axis`, with their current item marked
// aria-current or data-current); back controls say `data-nav="back"`. Worked
// out as the tap lands, while the menu is still on screen (a menu can close
// before the page changes).
let tapped: { at: number; motion: Motion | 'link' } | null = null
if (typeof document !== 'undefined') {
  document.addEventListener(
    'click',
    (e) => (tapped = e.target instanceof Element ? { at: performance.now(), motion: ofTap(e.target) } : null),
    true,
  )
}

function ofTap(el: Element): Motion | 'link' {
  if (el.closest('[data-nav="back"]')) return { way: 'back', axis: 'x' }
  const item = el.closest('a, button')
  // The More menu is the tab bar's last tab, its pages a list: down the list
  // (or across to it from another tab) comes in from the right.
  const more = el.closest('[data-nav="more"]')
  if (more) {
    const current = more.querySelector('[data-current]')
    if (!item || !current) return { way: 'next', axis: 'x' }
    const d = item.getBoundingClientRect().top - current.getBoundingClientRect().top
    return { way: d > 0 ? 'next' : d < 0 ? 'prev' : 'swap', axis: 'x' }
  }
  const menu = el.closest<HTMLElement>('[data-nav-axis]')
  if (menu) {
    const current = menu.querySelector('[aria-current="page"], [data-current]')
    if (item && current && current !== item) return alongMenu(menu.dataset.navAxis === 'y' ? 'y' : 'x', current.getBoundingClientRect(), item.getBoundingClientRect())
    if (item && item === current) return { way: 'swap', axis: 'x' }
  }
  return 'link'
}

/** The motion for a navigation the last tap started, if one did. */
export function fromTap(to: string, from: string): Motion | null {
  const tap = tapped
  tapped = null
  if (!tap || performance.now() - tap.at > 2000) return null
  if (tap.motion !== 'link') return tap.motion
  // A link in the page.
  return byPath(to, from).way === 'back' ? { way: 'back', axis: 'x' } : { way: 'forward', axis: 'x' }
}

/**
 * Move a page on in place, as a navigation would (a form going on to its
 * next stage): `update` makes the change. With `holdHead`, the page's header
 * (`data-page-head`: its title and controls) holds still while the rest moves.
 */
export function moveInPlace(motion: Motion, update: () => void | Promise<void>, holdHead = false) {
  if (typeof document === 'undefined' || matchMedia('(prefers-reduced-motion: reduce)').matches) return void update()
  startViewTransition(async () => {
    await update()
    await nextTick()
  }, [...(holdHead ? ['in-page'] : []), ...types(motion)])
}

/**
 * Change what a page shows in place (a segmented control's views), with the
 * content moving toward the chosen segment, as tabs do, under a still
 * header. `order` is the segments, left to right.
 */
export function swapInPlace<T>(order: readonly T[], from: T, to: T, update: () => void) {
  if (from === to) return
  moveInPlace({ way: order.indexOf(to) > order.indexOf(from) ? 'next' : 'prev', axis: 'x' }, update, true)
}
