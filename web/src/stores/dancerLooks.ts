import { defineStore } from 'pinia'
import { ref } from 'vue'
import { onValue, set } from 'firebase/database'
import { dataRef } from '@/firebase'

// The public bits of a dancer's profile a linked guardian can set. Today
// that's just their tartan, which also gives them their colour in the app.

export interface DancerLook {
  tartanId?: string
  updatedAt?: number
}

export const useDancerLooksStore = defineStore('dancerLooks', () => {
  const looks = ref<Record<string, DancerLook | null>>({})
  const watching = new Set<string>()

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

  const tartanIdOf = (id: string | null | undefined) => (id ? (looks.value[id]?.tartanId ?? null) : null)

  async function setTartan(dancerId: string, tartanId: string | null) {
    await set(
      dataRef(`dancers:profiles/${dancerId}`),
      tartanId ? { tartanId, updatedAt: Date.now() } : null,
    )
  }

  return { looks, ensure, tartanIdOf, setTartan }
})
