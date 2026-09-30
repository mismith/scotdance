import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { onValue, push, remove, set } from 'firebase/database'
import { dataRef } from '@/firebase'
import { useAuthStore } from './auth'
import seed from '@/data/tartans.json'
import type { Tartan } from '@/lib/tartan'

// Where a tartan comes from, in lookup order:
//   1. the built-in set shipped with the app (openly licensed setts)
//   2. /tartans/{id}: custom tartans an admin has approved (public)
//   3. /users:tartans/{uid}/{id}: your own custom tartans, private until
//      approved, so you see them on your dancer straight away
// Customs are built from stripes and colours, never uploaded images, so
// there's nothing to moderate but the name.

const builtIn: Record<string, Tartan> = Object.fromEntries(
  (seed as unknown as Tartan[]).map((t) => [t.id, { ...t, status: 'approved' as const }]),
)

export const useTartansStore = defineStore('tartans', () => {
  const auth = useAuthStore()
  const approved = ref<Record<string, Omit<Tartan, 'id'>>>({})
  const mine = ref<Record<string, Omit<Tartan, 'id'>>>({})

  let approvedStarted = false
  function loadApproved() {
    if (approvedStarted) return
    approvedStarted = true
    onValue(dataRef('tartans'), (snap) => (approved.value = snap.val() ?? {}), () => {})
  }

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
    loadApproved()
    const a = approved.value[id]
    if (a) return { ...a, id, status: 'approved' }
    const m = mine.value[id]
    if (m) return { ...m, id, status: m.declined ? 'declined' : 'pending' }
    return null
  }

  /** Everything you can pick from, A–Z, with your own customs first. */
  const all = computed<Tartan[]>(() => {
    loadApproved()
    const approvedList = Object.entries(approved.value).map(([id, t]) => ({ ...t, id, status: 'approved' as const }))
    const mineList = Object.entries(mine.value)
      .filter(([id]) => !approved.value[id])
      .map(([id, t]) => ({ ...t, id, status: t.declined ? ('declined' as const) : ('pending' as const) }))
    const shared = [...Object.values(builtIn), ...approvedList].sort((a, b) => a.name.localeCompare(b.name))
    return [...mineList, ...shared]
  })

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

  return { get, all, createCustom, deleteCustom, loadApproved }
})
