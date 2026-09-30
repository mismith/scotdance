import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { onValue, push, remove, set } from 'firebase/database'
import { dataRef } from '@/firebase'
import { useAuthStore } from './auth'
import seed from '@/data/tartans.json'
import type { Tartan } from '@/lib/tartan'

// The built-in tartans shipped with the app (openly licensed setts), plus
// the ones you've made yourself. Yours are private: built from stripes and
// colours, only you see them, so there's nothing for anyone to moderate.

const builtIn: Record<string, Tartan> = Object.fromEntries((seed as unknown as Tartan[]).map((t) => [t.id, t]))

export const useTartansStore = defineStore('tartans', () => {
  const auth = useAuthStore()
  const mine = ref<Record<string, Omit<Tartan, 'id'>>>({})

  let offMine: (() => void) | null = null
  watch(
    () => auth.uid,
    (uid) => {
      offMine?.()
      offMine = null
      mine.value = {}
      if (uid) offMine = onValue(dataRef(`users:tartans/${uid}`), (snap) => (mine.value = snap.val() ?? {}), () => {})
    },
    { immediate: true },
  )

  function get(id: string | null | undefined): Tartan | null {
    if (!id) return null
    if (builtIn[id]) return builtIn[id]
    const m = mine.value[id]
    return m ? { ...m, id, custom: true } : null
  }

  /** Everything you can pick from: yours first, then A–Z. */
  const all = computed<Tartan[]>(() => [
    ...Object.entries(mine.value).map(([id, t]) => ({ ...t, id, custom: true })),
    ...Object.values(builtIn).sort((a, b) => a.name.localeCompare(b.name)),
  ])

  async function createCustom(t: Pick<Tartan, 'name' | 'threadcount' | 'palette'>): Promise<string> {
    if (!auth.uid) throw new Error('Not signed in')
    const r = push(dataRef(`users:tartans/${auth.uid}`))
    await set(r, { name: t.name.trim(), threadcount: t.threadcount.trim(), palette: t.palette, createdAt: Date.now() })
    return r.key!
  }

  async function deleteCustom(id: string) {
    if (!auth.uid) return
    await remove(dataRef(`users:tartans/${auth.uid}/${id}`))
  }

  return { get, all, createCustom, deleteCustom }
})
