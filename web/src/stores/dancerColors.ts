import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { set } from 'firebase/database'
import { dataRef } from '@/firebase'
import { onValueSaved } from '@/lib/offline'
import { isColourCode, isHex, isWoven, parseSett, tidy, type Hex, type Tartan } from '@/lib/tartan'
import { useAuthStore } from './auth'

// The look you've chosen for each dancer you follow, if any: a colour
// (users:dancerColors/{uid}/{dancerId} = 'dancer-3', or any '#rrggbb' from the
// system colour picker) or a tartan ({ color, sett, colors }, see lib/tartan).
// Private to you: it's how they look in your app.
// Without a choice, colours are handed out in the order you followed them.

export const DANCER_COLORS = [
  { id: 'dancer-1', label: 'Red' },
  { id: 'dancer-2', label: 'Green' },
  { id: 'dancer-3', label: 'Purple' },
  { id: 'dancer-4', label: 'Gold' },
  { id: 'dancer-5', label: 'Blue' },
  { id: 'dancer-6', label: 'Teal' },
  { id: 'dancer-7', label: 'Pink' },
  { id: 'dancer-8', label: 'Orange' },
  { id: 'dancer-9', label: 'Navy' },
] as const
export type DancerColorId = (typeof DANCER_COLORS)[number]['id']
/** A palette colour, or one of your own. */
export type DancerColor = DancerColorId | `#${string}`
/** How a followed dancer looks: one colour, or a tartan. */
export type DancerLook = DancerColor | Tartan
const VALID = new Set<string>(DANCER_COLORS.map((c) => c.id))

export const isCustomColor = (c: unknown): c is `#${string}` => isHex(c)
export const isDancerColor = (c: unknown): c is DancerColor => (typeof c === 'string' && VALID.has(c)) || isHex(c)
export const isTartan = (look: DancerLook | null | undefined): look is Tartan => typeof look === 'object' && look !== null
/** A look's own colour: the colour itself, or a tartan's first. */
export const baseColor = (look: DancerLook): DancerColor => (isTartan(look) ? look.color : look)

/**
 * A saved look, if it's one this app can show (anything else is ignored, so
 * a dancer falls back to a handed-out colour). A tartan in black and white
 * alone has no `colors`: the database doesn't keep an empty object.
 */
export function readLook(v: unknown): DancerLook | null {
  if (isDancerColor(v)) return v
  if (typeof v !== 'object' || v === null) return null
  const { color, sett, colors = {}, ...rest } = v as Record<string, unknown>
  if (!isDancerColor(color) || typeof sett !== 'string' || !parseSett(sett) || Object.keys(rest).length) return null
  if (typeof colors !== 'object' || colors === null) return null
  if (!Object.entries(colors).every(([k, c]) => isColourCode(k) && isHex(c))) return null
  const t = tidy({ color, sett, colors: { ...(colors as Record<string, Hex>) } })
  return isWoven(t) ? t : null
}

/**
 * Text on one of your own colours: white or ink, whichever reads better
 * (the palette's own pairing is --on-dancer).
 */
export function inkOn(hex: `#${string}`) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  const L = 0.2126 * r + 0.7152 * g + 0.0722 * b
  // Contrast against white (1.05 / (L + 0.05)) vs ink (~L 0.005).
  return 1.05 / (L + 0.05) >= (L + 0.05) / 0.055 ? '#ffffff' : '#0c0f13'
}

/**
 * Text on a colour: a palette colour's own ink (light theme's gold takes dark
 * ink; see --on-dancer-4), or white or ink for one of your own.
 */
export const inkFor = (color: DancerColor) =>
  isCustomColor(color) ? inkOn(color) : `var(--on-${color}, var(--on-dancer))`

/**
 * Text on a look as useFollowing's colorFor gives it: a colour's ink, or null
 * for a tartan's cloth (white with a halo reads on any of it).
 */
export function inkOnLook(bg: string): string | null {
  if (isCustomColor(bg)) return inkOn(bg)
  const palette = bg.match(/^var\(--(dancer-\d)\)$/)
  return palette ? inkFor(palette[1] as DancerColorId) : bg.startsWith('var(--cloth-') ? null : 'var(--on-dancer)'
}

export const useDancerColorsStore = defineStore('dancerColors', () => {
  const auth = useAuthStore()
  const chosen = ref<Record<string, DancerLook>>({})

  let off: (() => void) | null = null
  watch(
    () => auth.uid,
    (uid) => {
      off?.()
      off = null
      chosen.value = {}
      if (uid) {
        off = onValueSaved(
          dataRef(`users:dancerColors/${uid}`),
          (snap) => {
            const all = (snap.val() ?? {}) as Record<string, unknown>
            const out: Record<string, DancerLook> = {}
            for (const [id, v] of Object.entries(all)) {
              const look = readLook(v)
              if (look) out[id] = look
            }
            chosen.value = out
          },
          () => {},
        )
      }
    },
    { immediate: true },
  )

  async function choose(dancerId: string, look: DancerLook | null) {
    if (!auth.uid) return
    // (Read back first: the database refuses undefined, so a tartan's
    // unchosen colours are left out, and one it couldn't show isn't saved.)
    const value = isTartan(look) ? readLook(look) : look
    if (look && !value) return
    await set(dataRef(`users:dancerColors/${auth.uid}/${dancerId}`), value)
  }

  return { chosen, choose }
})
