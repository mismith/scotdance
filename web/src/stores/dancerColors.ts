import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { onValue, set } from 'firebase/database'
import { dataRef } from '@/firebase'
import { useAuthStore } from './auth'

// The colour you've chosen for each dancer you follow, if any
// (users:dancerColors/{uid}/{dancerId} = 'dancer-3'). Private to you: it's
// how they look in your app. Without a choice, colours are handed out in
// the order you followed them.

export const DANCER_COLORS = [
  { id: 'dancer-1', label: 'Red' },
  { id: 'dancer-2', label: 'Green' },
  { id: 'dancer-3', label: 'Purple' },
  { id: 'dancer-4', label: 'Gold' },
  { id: 'dancer-5', label: 'Blue' },
  { id: 'dancer-6', label: 'Teal' },
  { id: 'dancer-7', label: 'Pink' },
  { id: 'dancer-8', label: 'Orange' },
] as const
export type DancerColorId = (typeof DANCER_COLORS)[number]['id']
const VALID = new Set<string>(DANCER_COLORS.map((c) => c.id))

export const useDancerColorsStore = defineStore('dancerColors', () => {
  const auth = useAuthStore()
  const chosen = ref<Record<string, DancerColorId>>({})

  let off: (() => void) | null = null
  watch(
    () => auth.uid,
    (uid) => {
      off?.()
      off = null
      chosen.value = {}
      if (uid) {
        off = onValue(
          dataRef(`users:dancerColors/${uid}`),
          (snap) => {
            const all = (snap.val() ?? {}) as Record<string, string>
            chosen.value = Object.fromEntries(Object.entries(all).filter(([, v]) => VALID.has(v))) as Record<string, DancerColorId>
          },
          () => {},
        )
      }
    },
    { immediate: true },
  )

  async function choose(dancerId: string, color: DancerColorId | null) {
    if (!auth.uid) return
    await set(dataRef(`users:dancerColors/${auth.uid}/${dancerId}`), color)
  }

  return { chosen, choose }
})
