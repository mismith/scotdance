// When the tab bar swaps between the app's tabs and a competition's (3 tabs
// and More ↔ Back and 4 tabs), each side keeps its frame and just narrows or
// widens in place from its outer edge, rubber-banding a little past where
// it lands, while what's on it swipes across, the way the gap between the
// sides moves (so into a competition swipes left, back out right): each
// frame's moving edge pushes the old icons ahead of it as they fade, and
// drags the new in behind it till they reach their places, so no icon is
// ever outside its frame. The two
// sides sit close, so a growing one's overshoot takes up part of the gap
// between them and squashes the round one beside it for the rest.
//
// Played on the bars themselves (lib/pageMotion holds a still copy of the old
// one over the new). Only transform and opacity move, so the compositor
// plays it and the page drawing underneath can't make it stutter: while it
// runs, each frame is drawn from three plain pieces (two round ends that
// slide, a middle that stretches), solid, so nothing under the bar shows
// through them unblurred. They're solid from the first frame to the last:
// the old glass fades off them at the start and the new fades over them at
// the end, so the page never shows through mid-fade.

const DURATION = 440
// The frames' spring: how bouncy, and how soon it settles (so the bounce is
// over before the real glass fades back in).
const ZETA = 0.7
const SPEED = 6
// The icons: how long till the last has popped in (ms), how far inside a
// frame's moving edge they keep, and how far they're pushed or dragged by it
// as they fade (px).
const ICONS = 500
const INSET = 4
const FADE = 28
// How much of a growing side's overshoot the gap between the sides takes up
// before the round one beside it starts to squash (px).
const GIVE = 4
const CLEAR = [
  'background',
  'border-color',
  'backdrop-filter',
  '-webkit-backdrop-filter',
  'box-shadow',
]

/**
 * A damped spring from 0 to 1 over `t` in 0–1 (lower `zeta`, more overshoot;
 * higher `speed`, settled sooner).
 */
function spring(t: number, zeta: number, speed = 4.6) {
  const omega = speed / zeta
  const wd = omega * Math.sqrt(1 - zeta * zeta)
  const e = Math.exp(-zeta * omega * t)
  return 1 - e * (Math.cos(wd * t) + ((zeta * omega) / wd) * Math.sin(wd * t))
}

const lerp = (a: number, b: number, p: number) => a + (b - a) * p
/** Keyframes along a spring: `frame(p)` for each step `p` of it. */
const springing = (
  frame: (p: number) => Keyframe,
  zeta: number,
  count = 30,
  speed?: number,
) =>
  Array.from({ length: count + 1 }, (_, i) => ({
    ...frame(i === count ? 1 : spring(i / count, zeta, speed)),
    offset: i / count,
  }))

function div(parent: HTMLElement, style: Partial<CSSStyleDeclaration>, className = '') {
  const el = document.createElement('div')
  el.className = className
  el.setAttribute('aria-hidden', 'true')
  Object.assign(el.style, { position: 'absolute', pointerEvents: 'none', ...style })
  parent.append(el)
  return el
}

/**
 * Morph the held copy of the old tab bar into the new one, side for side.
 * Null when the two don't pair up (not two sides each, or nothing changes
 * size), so the caller cross-fades them instead.
 */
export function morphTabBar(copy: HTMLElement, bar: HTMLElement): Animation[] | null {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return null
  const row = bar.querySelector<HTMLElement>('[data-tabbar-row]')
  const from = copy.querySelector('[data-tabbar-row]')?.children
  const to = row?.children
  if (!row || from?.length !== 2 || to?.length !== 2) return null
  const olds = [...from] as HTMLElement[]
  const news = [...to] as HTMLElement[]
  const was = olds.map((s) => s.getBoundingClientRect())
  const now = news.map((s) => s.getBoundingClientRect())
  if ([...was, ...now].some((r) => !r.width)) return null
  if (was.every((r, i) => Math.abs(r.width - now[i].width) < 1)) return null

  const nav = bar.getBoundingClientRect()
  const h = now[0].height
  const r = h / 2
  const base = nav.width // a middle's width before it's stretched
  const timing: KeyframeAnimationOptions = {
    duration: DURATION,
    easing: 'linear',
    fill: 'both',
  }
  const at = (ms: number) => Math.min(ms / DURATION, 1)
  const out: Animation[] = []
  const cleanups: (() => void)[] = []

  // How far along the sweep something at `x` is (0–1): from the side the gap
  // moves away from, toward the side it moves to.
  const leftward = now[0].right < was[0].right
  const along = (el: Element) => {
    const k = el.getBoundingClientRect()
    const u = (k.left + k.width / 2 - nav.left) / nav.width
    return Math.min(Math.max(leftward ? 1 - u : u, 0), 1)
  }
  const clamp = (x: number) => Math.min(Math.max(x, 0), 1)
  // Keyframes for an icon over its whole run, from what it looks like `ms` in.
  const icon = (el: Element, at: (ms: number) => { x: number; o: number; s: number }) =>
    el.animate(
      Array.from({ length: 55 }, (_, i) => {
        const { x, o, s } = at((i / 54) * ICONS)
        return { opacity: o, transform: `translateX(${x}px) scale(${s})`, offset: i / 54 }
      }),
      { duration: ICONS, easing: 'linear', fill: 'both' },
    )

  // The pieces' layer: solid throughout, gone only once the new glass is
  // fully over it.
  const layer = div(bar, {
    left: '0',
    top: `${now[0].top - nav.top}px`,
    width: `${nav.width}px`,
    height: `${h}px`,
    zIndex: '-1',
    filter: 'drop-shadow(0 8px 14px rgb(16 24 40 / 0.2))',
  })
  out.push(
    layer.animate([{ opacity: 1 }, { opacity: 1, offset: 0.86 }, { opacity: 0 }], timing),
  )
  const edge = '1px solid var(--glass-line)'
  const fill = {
    background: 'var(--card)',
    height: `${h}px`,
    top: '0',
    willChange: 'transform',
  }
  const end = (side: 'left' | 'right') => ({
    ...fill,
    width: `${r}px`,
    left: '0',
    border: edge,
    [side === 'left' ? 'borderRight' : 'borderLeft']: 'none',
    borderRadius: side === 'left' ? `${r}px 0 0 ${r}px` : `0 ${r}px ${r}px 0`,
  })

  news.forEach((side, i) => {
    const a = was[i]
    const b = now[i]
    // The edge that holds still: the bar's outer one.
    const anchor =
      Math.abs(a.left - b.left) < Math.abs(a.right - b.right) ? 'left' : 'right'
    const outer = (anchor === 'left' ? b.left : b.right) - nav.left
    // Past where it lands (p over 1), a growing side keeps growing; a
    // shrinking one stays round and is squashed instead, once the gap's
    // taken up its share.
    const growing = b.width > a.width
    const past = (p: number) => Math.max(p - 1, 0) * Math.abs(b.width - a.width)
    const width = (p: number) =>
      Math.max(lerp(a.width, b.width, Math.min(p, 1)), h) + (growing ? past(p) : 0)
    const squash = (p: number) => (growing ? 1 : (h - Math.max(past(p) - GIVE, 0)) / h)
    const frame = (fn: (p: number) => Keyframe) => springing(fn, ZETA, 30, SPEED)

    // The frame: a round end that stays, a middle that stretches, a round
    // end that slides (overlapping by a pixel, so no seam shows).
    const group = div(layer, { inset: '0', transformOrigin: `${outer}px 50%` })
    const still = div(group, end(anchor))
    still.style.transform = `translateX(${anchor === 'left' ? outer : outer - r}px)`
    const middle = div(group, {
      ...fill,
      width: `${base}px`,
      left: `${anchor === 'left' ? outer + r - 1 : outer - r + 1 - base}px`,
      borderTop: edge,
      borderBottom: edge,
      transformOrigin: anchor,
    })
    const tip = div(group, end(anchor === 'left' ? 'right' : 'left'))
    out.push(
      middle.animate(
        frame((p) => ({ transform: `scaleX(${(width(p) - 2 * r + 2) / base})` })),
        timing,
      ),
      tip.animate(
        frame((p) => ({
          transform: `translateX(${anchor === 'left' ? outer + width(p) - r : outer - width(p)}px)`,
        })),
        timing,
      ),
      group.animate(
        frame((p) => ({ transform: `scaleX(${squash(p)})` })),
        timing,
      ),
    )

    // Glass over the pieces where each side was and where it lands: the old
    // fades off them at the start, the new over them at the end (the
    // sides' own glass is cleared meanwhile, the old copy's for good).
    const glass = (r: DOMRect, keyframes: Keyframe[]) => {
      const el = div(
        bar,
        {
          left: `${r.left - nav.left}px`,
          top: `${r.top - nav.top}px`,
          width: `${r.width}px`,
          height: `${r.height}px`,
          borderRadius: '9999px',
          zIndex: '-1',
        },
        'glass',
      )
      out.push(el.animate(keyframes, timing))
      return el
    }
    const fromGlass = glass(a, [
      { opacity: 1 },
      { opacity: 0, offset: at(70) },
      { opacity: 0 },
    ])
    const toGlass = glass(b, [
      { opacity: 0 },
      { opacity: 0, offset: 0.72 },
      { opacity: 1, offset: 0.86 },
      { opacity: 1 },
    ])
    for (const el of [side, olds[i]])
      for (const p of CLEAR)
        el.style.setProperty(p, p === 'border-color' ? 'transparent' : 'none')
    cleanups.push(() => {
      fromGlass.remove()
      toGlass.remove()
      for (const p of CLEAR) side.style.removeProperty(p)
    })

    // Where the frame's moving edge is `ms` in, and how far it pushes (or
    // drags back) an icon at `k` to keep it inside.
    const edgeAt = (ms: number) => {
      const p = ms >= DURATION ? 1 : spring(ms / DURATION, ZETA, SPEED)
      const w = width(p) * squash(p)
      return anchor === 'left' ? outer + w : outer - w
    }
    const shove = (k: DOMRect, ms: number) =>
      anchor === 'left'
        ? Math.min(edgeAt(ms) - INSET - (k.right - nav.left), 0)
        : Math.max(edgeAt(ms) + INSET - (k.left - nav.left), 0)

    // The old fade as the edge pushes them, or along the sweep if it never
    // reaches them.
    for (const kid of olds[i].children) {
      const k = kid.getBoundingClientRect()
      const start = 100 * along(kid)
      out.push(
        icon(kid, (ms) => {
          const x = shove(k, ms)
          const o = Math.min(clamp(1 - (ms - start) / 80), clamp(1 - Math.abs(x) / FADE))
          return { x, o, s: lerp(0.6, 1, o) }
        }),
      )
    }
    // The new: one behind the edge to start with is dragged in by it, coming
    // clear as it nears its place; one already inside pops in along the
    // sweep, overshooting a little as the frames do.
    for (const kid of side.children) {
      const k = kid.getBoundingClientRect()
      const start = 90 + 140 * along(kid)
      const dragged = shove(k, 0) !== 0
      out.push(
        icon(kid, (ms) => {
          if (dragged) {
            const x = shove(k, ms)
            // Not over the old one it replaces, which goes first.
            const o = Math.min(clamp(1 - Math.abs(x) / FADE), clamp((ms - 30) / 70))
            return { x, o, s: lerp(0.6, 1, o) }
          }
          const t = ms - start
          return { x: 0, o: clamp(t / 90), s: lerp(0.5, 1, spring(clamp(t / 260), 0.55)) }
        }),
      )
    }
  })
  // The old one's on top, so what's on it can be seen going.
  copy.style.zIndex = '31'

  // Done (or cut short): the sides take their own glass back.
  Promise.all(out.map((a) => a.finished.catch(() => {}))).then(() => {
    layer.remove()
    for (const c of cleanups) c()
  })
  return out
}
