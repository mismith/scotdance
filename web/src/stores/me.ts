import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { onValue, ref as dbRef } from 'firebase/database'
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
  let unsubscribePermissions: (() => void) | null = null

  const displayName = computed(
    () => record.value?.displayName ?? auth.user?.displayName ?? null,
  )
  const email = computed(() => record.value?.email ?? auth.user?.email ?? null)
  const photoURL = computed(() => record.value?.photoURL ?? auth.user?.photoURL ?? null)

  const isAdmin = computed(() => permissions.value?.admin === true)
  function hasCompetitionPerm(id: string) {
    return isAdmin.value || permissions.value?.competitions?.[id] === true
  }
  /** Competitions this person can manage (system admins can manage all). */
  const managedCompetitionIds = computed(() =>
    Object.entries(permissions.value?.competitions ?? {})
      .filter(([, on]) => on === true)
      .map(([id]) => id),
  )
  const canManageAny = computed(() => isAdmin.value || managedCompetitionIds.value.length > 0)
  /** Permissions have been read at least once for the signed-in person. */
  const permissionsLoaded = computed(() => permissions.value !== null)

  watch(
    () => auth.uid,
    (uid) => {
      if (unsubscribe) {
        unsubscribe()
        unsubscribe = null
      }
      unsubscribePermissions?.()
      unsubscribePermissions = null
      if (!uid) {
        record.value = null
        permissions.value = null
        return
      }
      const meRef = dbRef(database, `${NAMESPACE}/users/${uid}`)
      unsubscribe = onValue(meRef, (snap) => {
        record.value = (snap.val() as MeRecord | null) ?? null
      })
      // Live, so access granted or removed (an accepted invite, an admin's
      // change) applies without signing out and in again.
      unsubscribePermissions = onValue(
        dbRef(database, `${NAMESPACE}/users:permissions/${uid}`),
        (snap) => {
          permissions.value = (snap.val() as PermissionsRecord | null) ?? {}
        },
        (e) => {
          console.warn('Failed to load permissions:', e)
          permissions.value = {}
        },
      )
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
    managedCompetitionIds,
    canManageAny,
    permissionsLoaded,
  }
})
