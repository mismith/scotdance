import type { Motion } from '@/lib/navMotion'
import { morphTabBar } from '@/lib/tabBarMorph'

// How a page change moves (lib/pageTransition), as Apple does it: pages
// slide, they don't fade, so nothing flashes through between them.
// - A deeper page slides in from the right edge over the old one, which
//   drifts a third of the way left and dims a little; Back reverses it.
// - A tab bar's tabs (and a page's segmented views) slide past like pages,
//   toward the one you tapped.
// Only transform and opacity move, so the compositor plays it all.

const css = (name: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim()

const SHADOW = '0 0 2rem rgb(0 0 0 / 0.16)'
const DIM = 0.08

/** A veil over a page, for the one underneath to dim. */
function veil(frame: HTMLElement) {
  const el = document.createElement('div')
  el.dataset.veil = ''
  Object.assign(el.style, {
    position: 'absolute',
    inset: '0',
    background: '#000',
    opacity: '0',
    pointerEvents: 'none',
    zIndex: '100',
  })
  frame.append(el)
  return el
}

export function slide(
  m: Motion,
  leaving: HTMLElement,
  arriving: HTMLElement,
): Animation[] {
  const deep = m.way === 'forward' || m.way === 'back'
  const timing: KeyframeAnimationOptions = {
    duration: deep ? 440 : 380,
    easing: css('--ease-push') || 'ease-out',
    fill: 'both',
  }
  const x = (from: string, to: string) => [
    { transform: `translateX(${from})` },
    { transform: `translateX(${to})` },
  ]
  // Frames span the window (PageStack), so a whole width is all the way off.
  const right = '100%'
  const gone = '-100%'
  switch (m.way) {
    case 'forward':
      arriving.style.boxShadow = SHADOW
      return [
        leaving.animate(x('0', '-30%'), timing),
        veil(leaving).animate([{ opacity: 0 }, { opacity: DIM }], timing),
        arriving.animate(x(right, '0'), timing),
      ]
    case 'back':
      leaving.style.boxShadow = SHADOW
      leaving.style.zIndex = '1'
      return [
        leaving.animate(x('0', right), timing),
        arriving.animate(x('-30%', '0'), timing),
        veil(arriving).animate([{ opacity: DIM }, { opacity: 0 }], timing),
      ]
    case 'next':
      return [
        leaving.animate(x('0', gone), timing),
        arriving.animate(x(right, '0'), timing),
      ]
    case 'prev':
      return [
        leaving.animate(x('0', right), timing),
        arriving.animate(x(gone, '0'), timing),
      ]
    default:
      return []
  }
}

// The bars. They live outside the pages (#chrome-top, #chrome-bottom), so a
// page that leaves takes its bar with it at once. Just before a change, a
// still copy of each bar goes over it; once the new page is in, the copy
// cross-fades away over whatever's there now. Parts that are the same on
// both (your account, a Back that goes to the same place) just stay.

const BARS = '[data-appbar], [data-tabbar]'
let held: { copy: HTMLElement; bar: HTMLElement; html: string; kind: string }[] = []

export function holdBars() {
  dropBars()
  held = [...document.querySelectorAll<HTMLElement>(BARS)].map((bar) => {
    const copy = bar.cloneNode(true) as HTMLElement
    const kind = bar.matches('[data-appbar]') ? 'appbar' : 'tabbar'
    copy.removeAttribute(`data-${kind}`)
    copy.dataset.barCopy = kind
    copy.inert = true
    copy.setAttribute('aria-hidden', 'true')
    copy.style.pointerEvents = 'none'
    bar.after(copy)
    return { copy, bar, html: bar.outerHTML, kind }
  })
}

export function dropBars() {
  for (const { copy } of held) copy.remove()
  held = []
}

const fadeOut: KeyframeAnimationOptions = {
  duration: 90,
  easing: 'cubic-bezier(0.4, 0, 1, 1)',
  fill: 'forwards',
}
const fadeIn: KeyframeAnimationOptions = {
  duration: 160,
  delay: 70,
  easing: 'cubic-bezier(0.2, 0, 0, 1)',
  fill: 'backwards',
}
const fade = (el: Element, on: boolean) =>
  el.animate([{ opacity: on ? 0 : 1 }, { opacity: on ? 1 : 0 }], on ? fadeIn : fadeOut)

const same = (a: Element, b: Element) => {
  if (a.outerHTML !== b.outerHTML) return false
  const ra = a.getBoundingClientRect()
  const rb = b.getBoundingClientRect()
  return (
    Math.abs(ra.left - rb.left) < 1 &&
    Math.abs(ra.top - rb.top) < 1 &&
    Math.abs(ra.width - rb.width) < 1
  )
}

/** Cross-fade each held copy into the bar that's there now. */
export function crossfadeBars(): Animation[] {
  const out: Animation[] = []
  const before = new Set(held.map((h) => h.bar))
  for (const { copy, bar, html, kind } of held) {
    // A layout's bar that stayed, else the one that just arrived in its place.
    const stayed = bar.isConnected
    const now = stayed
      ? bar
      : [...document.querySelectorAll<HTMLElement>(`[data-${kind}]`)].find(
          (b) => !before.has(b),
        )
    // A tab bar that stays moves its own capsule (TabBar).
    if (stayed && (kind === 'tabbar' || bar.outerHTML === html)) {
      copy.style.visibility = 'hidden'
      continue
    }
    if (!now) {
      out.push(fade(copy, false))
      continue
    }
    // The app's tabs and a competition's trade sides (lib/tabBarMorph).
    const morph = kind === 'tabbar' && !stayed ? morphTabBar(copy, now) : null
    if (morph) {
      out.push(...morph)
      continue
    }
    const parts = copy.querySelectorAll<HTMLElement>('[data-bar-part]')
    if (!parts.length) {
      out.push(fade(copy, false))
      if (!stayed) out.push(fade(now, true))
      continue
    }
    for (const part of parts) {
      const twin = now.querySelector(`[data-bar-part="${part.dataset.barPart}"]`)
      if (twin && same(part, twin)) {
        part.style.visibility = 'hidden'
        continue
      }
      out.push(fade(part, false))
      if (twin && !stayed) out.push(fade(twin, true))
    }
    // Parts only the new bar has.
    if (!stayed)
      for (const twin of now.querySelectorAll<HTMLElement>('[data-bar-part]'))
        if (!copy.querySelector(`[data-bar-part="${twin.dataset.barPart}"]`))
          out.push(fade(twin, true))
  }
  return out
}
