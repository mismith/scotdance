// Scott: the dancer in the ScotDance mark (an internal name; users just see
// the logo). The logo is his pose at rest, square-cut hands and feet on
// limbs that meet at a rounded body, a dot for his head. He can also move:
// the launch (SplashOverlay) is his split leap coming to rest as the logo.
//
// Everything here is a pure function of time, in the mark's units (a 512
// box): limbs 250 long and 88 wide, head r 68, 171 above the hips.

export const LIMB = 250
export const WIDTH = 88
export const HEAD_R = 68
const HALF = LIMB / 2
const NECK = 171
const deg = (d: number) => (d * Math.PI) / 180

export const CX = 256
/** The hips, as the logo. */
export const HOME = 300
/** The logo: limbs 33.5° off horizontal. */
export const MARK = deg(56.5)
const OVER = deg(72) // the split at its widest
const CLOSED = deg(6) // legs together
const TUCK = deg(34) // knees, just after leaving the floor
const APEX = HOME - 80 // hips at the top, above the logo
const TAKEOFF = HOME + 110 // hips standing on the floor
export const GROUND = TAKEOFF + LIMB * Math.cos(CLOSED)
const PLIE = 48
const ARM = { mark: MARK, low: deg(46), push: deg(35), apex: deg(50) }

// The leap, in seconds, from the logo back to it: a repeat first drops him
// from the logo to the floor; the launch starts at the bottom of the plié.
const T = { fall: 0.4, land: 0.22, push: 0.16, rise: 0.46, hang: 0.1, float: 0.52 }
type Phase = keyof typeof T
const AT = {} as Record<Phase, [number, number]>
{
  let t = 0
  for (const k of Object.keys(T) as Phase[]) {
    AT[k] = [t, t + T[k]]
    t += T[k]
  }
}
export const CYCLE = AT.float[1]
/** The bottom of the plié: where the launch starts. */
export const ARRIVE = AT.push[0]

const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const clamp = (t: number) => Math.min(1, Math.max(0, t))
const span = (t: number, a: number, b: number) => clamp((t - a) / (b - a))
const phase = (c: number, k: Phase) => span(c, ...AT[k])
const ease = {
  inOut: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  inOutSine: (t: number) => -(Math.cos(Math.PI * t) - 1) / 2,
  out: (t: number) => 1 - Math.pow(1 - t, 3),
  in: (t: number) => t * t * t,
}

export interface Point {
  x: number
  y: number
}
export interface Pose {
  hip: Point
  legs: Array<{ knee: Point; foot: Point }>
  hands: Point[]
  head: Point
  /** 0 up in the air (or as the logo), 1 on the floor. */
  nearFloor: number
}

/** Scott at `c` seconds into the leap (0 and CYCLE are both the logo). */
export function pose(c: number): Pose {
  // A split leap that resolves into the logo. From a feet-together plié he
  // pushes off, knees tucking a little as he leaves the floor, then
  // straightens and opens into a split that over-extends at the top, like a
  // real one. He floats back down as the split eases in to the logo's, and
  // lands softly in the logo's place, no knee bend.
  let hipY = HOME
  let spread = MARK
  let bend = 0
  let arm = ARM.mark
  let planted = false
  if (c > 0 && c < CYCLE) {
    if (c < AT.fall[1]) {
      // Dropping to the floor (repeats only): gravity, legs closing, arms lowering.
      const k = phase(c, 'fall')
      hipY = lerp(HOME, TAKEOFF, k * k)
      spread = lerp(MARK, CLOSED, ease.inOut(span(k, 0, 0.7)))
      arm = lerp(ARM.mark, ARM.low, ease.inOut(k))
    } else if (c < AT.land[1]) {
      // Landing in a plié: knees give, out over the toes.
      hipY = TAKEOFF + PLIE * ease.out(phase(c, 'land'))
      planted = true
      arm = ARM.low
    } else if (c < AT.push[1]) {
      // Pushing off: straightening fast, arms sweeping up.
      const k = ease.in(phase(c, 'push'))
      hipY = TAKEOFF + PLIE * (1 - k)
      planted = true
      arm = lerp(ARM.low, ARM.push, k)
    } else if (c < AT.rise[1]) {
      // Rising: fast, then slowing. Knees tuck as he leaves the floor, then
      // straighten as the legs open into the split.
      const k = phase(c, 'rise')
      hipY = lerp(TAKEOFF, APEX, 1 - (1 - k) * (1 - k))
      bend = TUCK * Math.sin(Math.PI * span(k, 0, 0.62))
      spread = lerp(CLOSED, OVER, ease.inOut(span(k, 0.18, 1)))
      arm = lerp(ARM.push, ARM.apex, ease.out(k))
    } else if (c < AT.hang[1]) {
      hipY = APEX - 4 * Math.sin(Math.PI * phase(c, 'hang'))
      spread = OVER
      arm = ARM.apex
    } else {
      // Floating down into the logo: the split eases in, a soft landing.
      const k = phase(c, 'float')
      hipY = lerp(APEX, HOME, ease.inOutSine(k))
      spread = lerp(OVER, MARK, ease.inOut(k))
      arm = lerp(ARM.apex, ARM.mark, ease.inOut(k))
    }
  }
  const hip = { x: CX, y: hipY }
  const legs = [-1, 1].map((s) => {
    if (!planted) {
      // Thigh out a little more and shin back in a little, by `bend`: knees out.
      const knee = { x: hip.x + s * HALF * Math.sin(spread + bend), y: hip.y + HALF * Math.cos(spread + bend) }
      return { knee, foot: { x: knee.x + s * HALF * Math.sin(spread - bend), y: knee.y + HALF * Math.cos(spread - bend) } }
    }
    // On the floor, feet together; knees bend out over the toes.
    const foot = { x: hip.x + s * LIMB * Math.sin(CLOSED), y: GROUND }
    const vx = foot.x - hip.x
    const vy = foot.y - hip.y
    const d = Math.min(LIMB, Math.hypot(vx, vy))
    const h = Math.sqrt(Math.max(0, HALF * HALF - (d / 2) * (d / 2)))
    let px = -vy / d
    let py = vx / d
    if (Math.sign(px) !== s) [px, py] = [-px, -py]
    return { knee: { x: hip.x + vx / 2 + px * h, y: hip.y + vy / 2 + py * h }, foot }
  })
  const hands = [-1, 1].map((s) => ({ x: hip.x + s * LIMB * Math.sin(arm), y: hip.y - LIMB * Math.cos(arm) }))
  return { hip, legs, hands, head: { x: hip.x, y: hip.y - NECK }, nearFloor: clamp((hipY - HOME) / (TAKEOFF - HOME)) }
}

/** Scott's extent as the logo (square-cut hand and foot ends, and his head). */
export const LOGO = (() => {
  const p = pose(0)
  const corners = [...p.hands, ...p.legs.map((l) => l.foot)].flatMap((end) => {
    const d = Math.hypot(end.x - p.hip.x, end.y - p.hip.y)
    const nx = ((p.hip.y - end.y) / d) * (WIDTH / 2)
    const ny = ((end.x - p.hip.x) / d) * (WIDTH / 2)
    return [
      { x: end.x + nx, y: end.y + ny },
      { x: end.x - nx, y: end.y - ny },
    ]
  })
  const xs = corners.map((q) => q.x)
  const ys = corners.map((q) => q.y)
  return {
    left: Math.min(...xs),
    right: Math.max(...xs),
    top: Math.min(p.head.y - HEAD_R, ...ys),
    bottom: Math.max(...ys),
    /** The farthest he reaches from his hips, the middle of the X. */
    reach: Math.max(p.hip.y - p.head.y + HEAD_R, ...corners.map((q) => Math.hypot(q.x - p.hip.x, q.y - p.hip.y))),
  }
})()

/**
 * How the logo sits in a frame. In a square (the app icons), `width` of the
 * way across, centred at `centre` (by eye: between his box's middle and the
 * middle of the X, so the head doesn't make him look low). In a circle (the
 * favicon, round launcher icons), centred on the middle of the X, his reach
 * `reach` of the way out. web/scripts/brand.ts renders the icons from these.
 */
export const FRAME = {
  square: { width: 0.66, centre: 280 },
  circle: { reach: 0.82 },
}
