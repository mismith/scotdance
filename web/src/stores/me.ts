import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { onValue, ref as dbRef, update } from 'firebase/database'
import { database } from '@/firebase'
import { onValueSaved } from '@/lib/offline'
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
  organisations?: Record<string, boolean>
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
  /** Competitions this person was made an admin of (not every one a system admin can manage). */
  const managedCompetitionIds = computed(() =>
    Object.entries(permissions.value?.competitions ?? {})
      .filter(([, on]) => on === true)
      .map(([id]) => id),
  )
  /** One they were made an admin of: what the shield marks. System admins can manage the rest too, unmarked. */
  function organises(id: string) {
    return permissions.value?.competitions?.[id] === true
  }
  /** Organisations this person is an admin of (system admins can change every one, unlisted here). */
  const managedOrganisationIds = computed(() =>
    Object.entries(permissions.value?.organisations ?? {})
      .filter(([, on]) => on === true)
      .map(([id]) => id),
  )
  function hasOrganisationPerm(id: string) {
    return isAdmin.value || permissions.value?.organisations?.[id] === true
  }
  const canManageAny = computed(() => isAdmin.value || managedCompetitionIds.value.length > 0 || managedOrganisationIds.value.length > 0)
  /** Permissions have been read at least once for the signed-in person. */
  const permissionsLoaded = computed(() => permissions.value !== null)
  /** Known whether this person organises anything: signed out, or permissions read. */
  const accessKnown = computed(() => auth.authReady && (!auth.uid || permissionsLoaded.value))

  watch(
    () => auth.uid,
    (uid) => {
      if (unsubscribe) {
        unsubscribe()
        unsubscribe = null
      }
      unsubscribePermissions?.()
      unsubscribePermissions = null
      // Nothing of the last account carries over, even for a moment.
      record.value = null
      permissions.value = null
      if (!uid) return
      const meRef = dbRef(database, `${NAMESPACE}/users/${uid}`)
      let checked = false
      unsubscribe = onValue(meRef, (snap) => {
        record.value = (snap.val() as MeRecord | null) ?? null
        // Every account has a record with its sign-in email, kept in step
        // (System admin › Users finds people by it), as the old app did.
        // Mends accounts made before this too. Checked once per sign-in, so
        // deleting the account doesn't bring it back.
        if (checked) return
        checked = true
        const u = auth.user
        if (u?.uid === uid && u.email && record.value?.email !== u.email) {
          const fix: MeRecord = { email: u.email }
          if (!record.value?.displayName && u.displayName) fix.displayName = u.displayName
          void update(meRef, fix).catch(() => {})
        }
      })
      // Live, so access granted or removed (an accepted invite, an admin's
      // change) applies without signing out and in again. Saved on the device
      // too, so organisers still see their own competitions with no signal.
      unsubscribePermissions = onValueSaved(
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
    organises,
    managedCompetitionIds,
    managedOrganisationIds,
    hasOrganisationPerm,
    canManageAny,
    permissionsLoaded,
    accessKnown,
  }
})
