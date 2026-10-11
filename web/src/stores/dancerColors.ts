import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { set } from 'firebase/database'
import { dataRef } from '@/firebase'
import { onValueSaved } from '@/lib/offline'
import { useAuthStore } from './auth'

// The colour you've chosen for each dancer you follow, if any
// (users:dancerColors/{uid}/{dancerId} = 'dancer-3', or any '#rrggbb' from the
// system colour picker). Private to you: it's how they look in your app.
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
const VALID = new Set<string>(DANCER_COLORS.map((c) => c.id))

export const isCustomColor = (c: string | null | undefined): c is `#${string}` => !!c && /^#[0-9a-f]{6}$/i.test(c)

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

export const useDancerColorsStore = defineStore('dancerColors', () => {
  const auth = useAuthStore()
  const chosen = ref<Record<string, DancerColor>>({})

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
            const all = (snap.val() ?? {}) as Record<string, string>
            chosen.value = Object.fromEntries(
              Object.entries(all).filter(([, v]) => VALID.has(v) || isCustomColor(v)),
            ) as Record<string, DancerColor>
          },
          () => {},
        )
      }
    },
    { immediate: true },
  )

  async function choose(dancerId: string, color: DancerColor | null) {
    if (!auth.uid) return
    await set(dataRef(`users:dancerColors/${auth.uid}/${dancerId}`), color)
  }

  return { chosen, choose }
})
