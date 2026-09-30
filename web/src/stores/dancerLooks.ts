import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { onValue, set } from 'firebase/database'
import { dataRef } from '@/firebase'
import { useAuthStore } from './auth'

// A dancer's tartan, crowd-set with nobody to approve it:
//   - your pick (users:tartanPicks/{uid}/{dancerId}) is private and is what
//     you see
//   - the public tartan (dancers:profiles/{dancerId}) is set by a function
//     once at least two people agree and they hold more than 2/3 of picks
// Who picked what, and how many, is never shown.

export interface DancerLook {
  tartanId?: string
  updatedAt?: number
}

export const useDancerLooksStore = defineStore('dancerLooks', () => {
  const auth = useAuthStore()
  const looks = ref<Record<string, DancerLook | null>>({})
  const picks = ref<Record<string, string>>({})
  const watching = new Set<string>()

  let offPicks: (() => void) | null = null
  watch(
    () => auth.uid,
    (uid) => {
      offPicks?.()
      offPicks = null
      picks.value = {}
      if (uid) offPicks = onValue(dataRef(`users:tartanPicks/${uid}`), (snap) => (picks.value = snap.val() ?? {}), () => {})
    },
    { immediate: true },
  )

  function ensure(ids: Iterable<string>) {
    for (const id of ids) {
      if (!id || watching.has(id)) continue
      watching.add(id)
      onValue(
        dataRef(`dancers:profiles/${id}`),
        (snap) => (looks.value = { ...looks.value, [id]: snap.val() }),
        () => {},
      )
    }
  }

  const publicTartanIdOf = (id: string | null | undefined) => (id ? (looks.value[id]?.tartanId ?? null) : null)
  const pickOf = (id: string | null | undefined) => (id ? (picks.value[id] ?? null) : null)
  /** What you see: your own pick, else the crowd's. */
  const tartanIdOf = (id: string | null | undefined) => pickOf(id) ?? publicTartanIdOf(id)

  async function setPick(dancerId: string, tartanId: string | null) {
    if (!auth.uid) throw new Error('Not signed in')
    await set(dataRef(`users:tartanPicks/${auth.uid}/${dancerId}`), tartanId)
  }

  return { looks, picks, ensure, pickOf, publicTartanIdOf, tartanIdOf, setPick }
})
