import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { get, onValue, ref as dbRef } from 'firebase/database'
import { database } from '@/firebase'
import { useAuthStore } from './auth'

const NAMESPACE = import.meta.env.VITE_FIREBASE_DATA_NAMESPACE || 'production'

export interface MeRecord {
  email?: string
  displayName?: string
  photoURL?: string
}

interface PermissionsRecord {
  admin?: boolean
  competitions?: Record<string, boolean>
}

export const useMeStore = defineStore('me', () => {
  const auth = useAuthStore()
  const record = ref<MeRecord | null>(null)
  const permissions = ref<PermissionsRecord | null>(null)

  let unsubscribe: (() => void) | null = null

  const displayName = computed(
    () => record.value?.displayName ?? auth.user?.displayName ?? null,
  )
  const email = computed(() => record.value?.email ?? auth.user?.email ?? null)
  const photoURL = computed(() => record.value?.photoURL ?? auth.user?.photoURL ?? null)

  const isAdmin = computed(() => permissions.value?.admin === true)
  function hasCompetitionPerm(id: string) {
    return isAdmin.value || permissions.value?.competitions?.[id] === true
  }

  async function loadPermissions(uid: string) {
    try {
      const snap = await get(dbRef(database, `${NAMESPACE}/users:permissions/${uid}`))
      permissions.value = (snap.val() as PermissionsRecord | null) ?? {}
    } catch (e) {
      console.warn('Failed to load permissions:', e)
      permissions.value = null
    }
  }

  watch(
    () => auth.uid,
    (uid) => {
      if (unsubscribe) {
        unsubscribe()
        unsubscribe = null
      }
      if (!uid) {
        record.value = null
        permissions.value = null
        return
      }
      const meRef = dbRef(database, `${NAMESPACE}/users/${uid}`)
      unsubscribe = onValue(meRef, (snap) => {
        record.value = (snap.val() as MeRecord | null) ?? null
      })
      void loadPermissions(uid)
    },
    { immediate: true },
  )

  return {
    record,
    displayName,
    email,
    photoURL,
    permissions,
    isAdmin,
    hasCompetitionPerm,
  }
})
