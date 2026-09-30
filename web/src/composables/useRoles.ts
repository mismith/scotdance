import { computed, ref, watch } from 'vue'
import { useLocalStorage } from '@vueuse/core'
import { ref as dbRef, update } from 'firebase/database'
import { database } from '@/firebase'
import { useAuthStore } from '@/stores/auth'
import { useMeStore } from '@/stores/me'

// "Which of these describe you?" Pick any: dancer, parent, teacher, organiser.
// Stored on the person (/users/{uid}/roles) and used to fit the app:
//   teacher    Home lists followed dancers compactly (a class, not two kids)
//   organizer  quick access to managing competitions
// Asked once, right after someone deliberately creates an account; never in
// the way of an action they signed in to do (then it waits as a card on Home).

export type Role = 'dancer' | 'parent' | 'teacher' | 'organizer'
export const ROLES: Array<{ id: Role; label: string; hint: string }> = [
  { id: 'dancer', label: 'Dancer', hint: 'I compete' },
  { id: 'parent', label: 'Parent of a dancer', hint: 'I follow my kids' },
  { id: 'teacher', label: 'Teacher or coach', hint: 'I follow my students' },
  { id: 'organizer', label: 'Competition organiser', hint: 'I run or help run competitions' },
]

const NAMESPACE = import.meta.env.VITE_FIREBASE_DATA_NAMESPACE || 'production'
const sheetOpen = ref(false)
const pending = useLocalStorage('roles:pending', false)
let watching = false

export function useRoles() {
  const auth = useAuthStore()
  const me = useMeStore()

  const roles = computed<Partial<Record<Role, boolean>>>(
    () => ((me.record as { roles?: Partial<Record<Role, boolean>> } | null)?.roles ?? {}),
  )
  const answered = computed(() => !!(me.record as { rolesAnsweredAt?: number } | null)?.rolesAnsweredAt)
  const has = (r: Role) => roles.value[r] === true

  async function save(next: Partial<Record<Role, boolean>>) {
    const uid = auth.uid
    if (!uid) return
    const clean = Object.fromEntries(ROLES.map((r) => [r.id, next[r.id] === true ? true : null]))
    await update(dbRef(database, `${NAMESPACE}/users/${uid}`), {
      roles: clean,
      rolesAnsweredAt: Date.now(),
    })
    pending.value = false
  }

  function open() {
    sheetOpen.value = true
  }
  function close() {
    sheetOpen.value = false
    pending.value = false
  }

  // New account: ask now if they signed up on purpose, later if they signed
  // up to do something (follow, alerts).
  if (!watching) {
    watching = true
    watch(
      () => auth.newAccount,
      (n) => {
        if (!n) return
        if (n.reason === null || n.reason === 'account') setTimeout(() => (sheetOpen.value = true), 500)
        else pending.value = true
        auth.newAccount = null
      },
    )
  }

  return { roles, answered, has, save, open, close, sheetOpen, pending }
}
