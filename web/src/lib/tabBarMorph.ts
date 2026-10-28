// When the tab bar swaps between the app's tabs and a competition's (3 tabs
// and More ↔ Back and 4 tabs), each side keeps its frame and just narrows or
// widens in place from its outer edge, rubber-banding a little past where
// it lands, while what's on it pops: the old icons shrink away, the new pop
// in, the tabs one after another from the edge that holds still. The two
// sides sit close, so a growing one's overshoot takes up part of the gap
// between them and squashes the round one beside it for the rest.
//
// Played on the bars themselves (lib/pageMotion holds a still copy of the old
// one over the new). Only transform and opacity move, so the compositor
// plays it and the page drawing underneath can't make it stutter: while it
// runs, each frame is drawn from three plain pieces (two round ends that
// slide, a middle that stretches), solid, so nothing under the bar shows
// through them unblurred. The real glass fades over to them at the start and
// back at the end.

const DURATION = 440
// The frames' spring: how bouncy, and how soon it settles (so the bounce is
// over before the real glass fades back in).
const ZETA = 0.7
const SPEED = 6
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

  // The pieces' layer, faded in over the old glass and out under the new.
  const layer = div(bar, {
    left: '0',
    top: `${now[0].top - nav.top}px`,
    width: `${nav.width}px`,
    height: `${h}px`,
    zIndex: '-1',
    filter: 'drop-shadow(0 8px 14px rgb(16 24 40 / 0.2))',
  })
  out.push(
    layer.animate(
      [
        { opacity: 0 },
        { opacity: 1, offset: at(120) },
        { opacity: 1, offset: 0.75 },
        { opacity: 0 },
      ],
      timing,
    ),
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

    // The new side's own glass, cleared while the pieces stand in for it;
    // a copy of it fades back in over them at the end.
    const glass = div(
      bar,
      {
        left: `${b.left - nav.left}px`,
        top: `${b.top - nav.top}px`,
        width: `${b.width}px`,
        height: `${b.height}px`,
        borderRadius: '9999px',
        zIndex: '-1',
      },
      'glass',
    )
    out.push(
      glass.animate(
        [{ opacity: 0 }, { opacity: 0, offset: 0.75 }, { opacity: 1 }],
        timing,
      ),
    )
    for (const p of CLEAR)
      side.style.setProperty(p, p === 'border-color' ? 'transparent' : 'none')
    cleanups.push(() => {
      glass.remove()
      for (const p of CLEAR) side.style.removeProperty(p)
    })

    // The old side fades off the pieces as they take over.
    out.push(
      olds[i].animate(
        [{ opacity: 1 }, { opacity: 0, offset: at(120) }, { opacity: 0 }],
        timing,
      ),
    )
    for (const kid of olds[i].children)
      out.push(
        kid.animate(
          [
            { opacity: 1, transform: 'none' },
            { opacity: 0, transform: 'scale(0.5)' },
          ],
          { duration: 110, easing: 'cubic-bezier(0.4, 0, 1, 1)', fill: 'both' },
        ),
      )

    // The new pop in: on a side that grows, from the still edge outward as
    // the frame reaches them; on one that shrinks, as it lands.
    for (const kid of side.children) {
      const k = kid.getBoundingClientRect()
      const reach =
        anchor === 'left'
          ? k.left + k.width / 2 - b.left
          : b.right - (k.left + k.width / 2)
      const delay = growing ? 30 + 150 * (reach / b.width) : 110
      out.push(
        kid.animate(
          springing((p) => ({ transform: `scale(${lerp(0.4, 1, p)})` }), 0.55, 20),
          { duration: 360, delay, easing: 'linear', fill: 'backwards' },
        ),
        kid.animate([{ opacity: 0 }, { opacity: 1 }], {
          duration: 90,
          delay,
          fill: 'backwards',
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
