import { nextTick } from 'vue'
import type { Motion } from '@/lib/navMotion'
import { dropBars, holdBars } from '@/lib/pageMotion'

// Page changes, played on the live pages rather than on pictures of them
// (View Transitions freeze the screen while the next page draws, then take
// and animate snapshots; that stutters on phones). The router says which way
// the next change goes (lib/navMotion); PageStack plays it (lib/pageMotion):
//
// - The page being left is pinned where it sat (a frame over the window,
//   scrolled as it was), and the arriving one is pinned at the scroll it
//   arrives at, so neither jumps while they move.
// - Only transform and opacity animate, so the phone's compositor runs the
//   whole slide on its own: nothing on the page's thread can make it stutter.
// - The top and tab bars live in their own layer (#chrome-top, #chrome-bottom),
//   outside the pages, so they hold still; what differs on them cross-fades.
// - When it lands, the arriving page is let go into the window, scrolled to
//   where it should be, in the same frame.

export interface Swap {
  motion: Motion
  /** Where the arriving page scrolls to (the router says, a moment after it renders). */
  top: Promise<number | null>
  /** Settles once the pages have finished moving (or a newer change cut in). */
  finished: Promise<void>
  /** The pages are in: let them go. */
  end: () => void
  /** Over: landed, or cut short by a newer change. */
  ended: boolean
  frames: Element[]
}

let pending: Motion | null = null
let provideTop: ((top: number | null) => void) | null = null
let active: Swap | null = null

/**
 * The router, once a change is confirmed: it moves this way (null: it just
 * changes). Pages still moving keep moving unless the change replaces one
 * (PageStack lands them then); a query alone (Search writing ?q= as it
 * opens) leaves them be.
 */
export function setNextMotion(motion: Motion | null) {
  pending = motion
  if (!motion) return
  holdBars()
  // Nothing took it (the change didn't swap a page): let the bars go.
  nextTick(() => {
    if (pending !== motion) return
    pending = null
    dropBars()
  })
}

/** PageStack: take the motion for the change that's rendering now. */
export function takeMotion(): Motion | null {
  const m = pending
  pending = null
  return m
}

/** PageStack: `frames` are about to move. `land` lets them go. */
export function beginSwap(motion: Motion, frames: Element[], land: () => void): Swap {
  active?.end()
  let resolveFinished!: () => void
  const finished = new Promise<void>((r) => (resolveFinished = r))
  const top = new Promise<number | null>((resolve) => {
    provideTop = resolve
    // The router answers within a tick; if it doesn't (a hash link the page
    // scrolls to itself), arrive at the top.
    setTimeout(() => resolve(null), 100)
  })
  const swap: Swap = {
    motion,
    frames,
    top,
    finished,
    ended: false,
    end: () => {
      if (swap.ended) return
      swap.ended = true
      if (active === swap) {
        active = null
        delete document.documentElement.dataset.slide
      }
      land()
      dropBars()
      resolveFinished()
    },
  }
  active = swap
  // Which way pages are moving, while they move (`forward`, `next`…).
  document.documentElement.dataset.slide = motion.way
  return swap
}

/** Land the pages now if `frame` is one of those moving. */
export function endSwapOf(frame: Element) {
  if (active?.frames.includes(frame)) active.end()
}

/**
 * The router's scrollBehavior: where the new page scrolls to. While pages
 * are moving, the arriving one is drawn at that scroll and the window only
 * catches up once they land; resolves then (at once with nothing moving).
 */
export function scrollAfterSwap(top: number | null): Promise<void> {
  provideTop?.(top)
  provideTop = null
  return active?.finished ?? Promise.resolve()
}
