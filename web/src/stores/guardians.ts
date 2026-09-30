import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { onValue, remove, set, update } from 'firebase/database'
import { dataRef } from '@/firebase'
import { useAuthStore } from './auth'
import { useMeStore } from './me'

// Linking a dancer to your account. You ask; an admin, or someone already
// linked to that dancer (the other parent, say), says yes. Being linked lets
// you set their tartan. Who's linked is never shown publicly.
//
//   /dancers:guardians/{dancerId}/{uid}  the request and its status
//   /users:dancers/{uid}/{dancerId}      your own list (dancer's name)
//   /dancers:profiles/{dancerId}         public bits a guardian sets (tartan)

export type Relationship = 'parent' | 'self' | 'teacher'
export type ClaimStatus = 'pending' | 'approved' | 'denied'

export interface Claim {
  status: ClaimStatus
  relationship: Relationship
  name?: string
  dancerName?: string
  note?: string
  createdAt: number
}

export const RELATIONSHIPS: { value: Relationship; label: string }[] = [
  { value: 'parent', label: 'I’m their parent or guardian' },
  { value: 'self', label: 'I’m this dancer' },
  { value: 'teacher', label: 'I’m their teacher' },
]

/** Open requests at once, so nobody can sweep up a whole results sheet. */
export const MAX_PENDING = 10

export const useGuardiansStore = defineStore('guardians', () => {
  const auth = useAuthStore()
  const me = useMeStore()
  /** dancerId → dancer's name, for the dancers you've asked to link. */
  const linked = ref<Record<string, string>>({})
  /** dancerId → your request. */
  const claims = ref<Record<string, Claim | null>>({})
  const subs = new Map<string, () => void>()

  let offLinked: (() => void) | null = null
  watch(
    () => auth.uid,
    (uid) => {
      offLinked?.()
      offLinked = null
      subs.forEach((off) => off())
      subs.clear()
      linked.value = {}
      claims.value = {}
      if (!uid) return
      offLinked = onValue(
        dataRef(`users:dancers/${uid}`),
        (snap) => {
          linked.value = snap.val() ?? {}
          for (const id of Object.keys(linked.value)) watchClaim(id)
        },
        () => {},
      )
    },
    { immediate: true },
  )

  function watchClaim(dancerId: string) {
    if (!auth.uid || subs.has(dancerId)) return
    subs.set(
      dancerId,
      onValue(
        dataRef(`dancers:guardians/${dancerId}/${auth.uid}`),
        (snap) => (claims.value = { ...claims.value, [dancerId]: snap.val() }),
        () => {},
      ),
    )
  }

  const claimFor = (dancerId: string) => claims.value[dancerId] ?? null
  const isGuardian = (dancerId: string) => claimFor(dancerId)?.status === 'approved'
  const pendingCount = () => Object.values(claims.value).filter((c) => c?.status === 'pending').length

  async function request(dancerId: string, dancerName: string, relationship: Relationship, note: string) {
    const uid = auth.uid
    if (!uid) throw new Error('Not signed in')
    const claim: Claim = {
      status: 'pending',
      relationship,
      name: me.displayName ?? '',
      dancerName,
      createdAt: Date.now(),
    }
    if (note.trim()) claim.note = note.trim().slice(0, 280)
    await update(dataRef(), {
      [`dancers:guardians/${dancerId}/${uid}`]: claim,
      [`users:dancers/${uid}/${dancerId}`]: dancerName,
    })
    watchClaim(dancerId)
  }

  async function withdraw(dancerId: string) {
    const uid = auth.uid
    if (!uid) return
    await update(dataRef(), {
      [`dancers:guardians/${dancerId}/${uid}`]: null,
      [`users:dancers/${uid}/${dancerId}`]: null,
    })
  }

  /** For guardians and admins: everyone who's asked to link to a dancer. */
  function watchRequests(dancerId: string, cb: (all: Record<string, Claim>) => void) {
    return onValue(dataRef(`dancers:guardians/${dancerId}`), (snap) => cb(snap.val() ?? {}), () => cb({}))
  }

  async function decide(dancerId: string, uid: string, status: 'approved' | 'denied') {
    await set(dataRef(`dancers:guardians/${dancerId}/${uid}/status`), status)
  }

  async function unlink(dancerId: string, uid: string) {
    await remove(dataRef(`dancers:guardians/${dancerId}/${uid}`))
  }

  return { linked, claims, claimFor, isGuardian, pendingCount, request, withdraw, watchRequests, decide, unlink }
})
