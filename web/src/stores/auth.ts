import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import {
  EmailAuthProvider,
  createUserWithEmailAndPassword,
  deleteUser,
  reauthenticateWithCredential,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateEmail,
  updatePassword,
  updateProfile,
} from 'firebase/auth'
import { ref as dbRef, set, update } from 'firebase/database'
import { useCurrentUser } from 'vuefire'
import { useMorph } from '@/lib/morph'
import { auth, database } from '@/firebase'

type PostLoginAction = () => void | Promise<void>

/** Why sign-in was asked for, so the sheet can say so ("Sign in to follow Emma"). */
export interface LoginReason {
  reason: 'follow' | 'favorite' | 'alerts' | 'account' | 'submit'
  name?: string
}

const NAMESPACE = import.meta.env.VITE_FIREBASE_DATA_NAMESPACE || 'production'

function userPath(uid: string, child = '') {
  return `${NAMESPACE}/users/${uid}${child ? `/${child}` : ''}`
}

export const useAuthStore = defineStore('auth', () => {
  const user = useCurrentUser()
  /** Whether a saved sign-in has been checked for yet (until then `user` is undefined). */
  const authReady = computed(() => user.value !== undefined)
  const isSignedIn = computed(() => !!user.value)
  const uid = computed(() => user.value?.uid ?? null)
  const displayName = computed(() => user.value?.displayName ?? user.value?.email ?? null)
  const photoURL = computed(() => user.value?.photoURL ?? null)

  // The sign-in sheet grows out of whatever asked for it (a Follow button…).
  const loginSheet = useMorph()
  const loginDialogOpen = computed(() => loginSheet.open)
  const loginReason = ref<LoginReason | null>(null)
  /** Set when an account was just created: the reason it happened, if any. */
  const newAccount = ref<{ reason: LoginReason['reason'] | null } | null>(null)
  const markNew = () => (newAccount.value = { reason: loginReason.value?.reason ?? null })
  const pendingActions = ref<PostLoginAction[]>([])

  function openLogin(reason: LoginReason | null = null) {
    loginReason.value = reason
    loginSheet.show()
  }

  function closeLogin() {
    // Closed without signing in: whatever asked for it (a Follow) is off.
    if (!isSignedIn.value) pendingActions.value = []
    loginSheet.hide()
  }

  function enqueueAfterLogin(action: PostLoginAction) {
    pendingActions.value.push(action)
  }

  async function flushPendingActions() {
    if (!pendingActions.value.length) return
    const actions = pendingActions.value.slice()
    pendingActions.value = []
    for (const action of actions) {
      try {
        await action()
      } catch (e) {
        console.warn('Post-login action failed:', e)
      }
    }
  }

  function requireSignIn(action: PostLoginAction, reason: LoginReason | null = null) {
    if (isSignedIn.value) {
      return action()
    }
    enqueueAfterLogin(action)
    openLogin(reason)
    return undefined
  }

  watch(isSignedIn, (signedIn) => {
    if (signedIn) {
      void flushPendingActions()
    } else {
      pendingActions.value = []
    }
  })

  async function signInWithEmail(email: string, password: string) {
    await signInWithEmailAndPassword(auth, email, password)
  }

  async function registerWithEmail(email: string, password: string) {
    await createUserWithEmailAndPassword(auth, email, password)
    markNew()
  }

  async function resetPassword(email: string) {
    await sendPasswordResetEmail(auth, email)
  }

  async function signOutUser() {
    await signOut(auth)
  }

  // A few v4 beta accounts were made with Apple or Google: no password. (Ones
  // made with an emailed link look as if they have one.) The Account page
  // offers them a link to set one.
  const hasPassword = computed(() => user.value?.providerData.some((p) => p.providerId === 'password') ?? false)

  // Sensitive changes need a recent sign-in: with the password if there is
  // one. Without one, just try; Firebase says so if it's been too long.
  /** Returns whether they signed in again just now. */
  async function reauthenticate(currentPassword?: string): Promise<boolean> {
    const u = auth.currentUser
    if (!u) throw new Error('Not signed in')
    if (!hasPassword.value || !u.email) return false
    await reauthenticateWithCredential(u, EmailAuthProvider.credential(u.email, currentPassword ?? ''))
    return true
  }

  async function updateDisplayName(name: string) {
    const u = auth.currentUser
    if (!u) throw new Error('Not signed in')
    await updateProfile(u, { displayName: name || null })
    await update(dbRef(database, userPath(u.uid)), { displayName: name || null })
  }

  async function updateUserEmail(newEmail: string, currentPassword?: string) {
    await reauthenticate(currentPassword)
    const u = auth.currentUser
    if (!u) throw new Error('Not signed in')
    await updateEmail(u, newEmail)
    await set(dbRef(database, userPath(u.uid, 'email')), newEmail)
  }

  async function updateUserPassword(newPassword: string, currentPassword: string) {
    await reauthenticate(currentPassword)
    const u = auth.currentUser
    if (!u) throw new Error('Not signed in')
    await updatePassword(u, newPassword)
  }

  async function deleteAccount(currentPassword?: string) {
    const fresh = await reauthenticate(currentPassword)
    const u = auth.currentUser
    if (!u) throw new Error('Not signed in')
    // Firebase only deletes an account signed in to in the last few minutes.
    // Without a re-sign-in just now, check that before wiping their data, so
    // the data never goes while the account stays.
    if (!fresh) {
      const { authTime } = await u.getIdTokenResult()
      if (Date.now() - Date.parse(authTime) > 4 * 60 * 1000) {
        throw Object.assign(new Error('Sign in again first'), { code: 'auth/requires-recent-login' })
      }
    }
    const uid = u.uid
    // Their data goes first, in one write, while they're still signed in:
    // once the account is deleted the rules refuse these writes.
    await update(dbRef(database, NAMESPACE), {
      [`users/${uid}`]: null,
      [`users:favorites/${uid}`]: null,
      [`users:dancerColors/${uid}`]: null,
      [`users:permissions/${uid}`]: null,
    })
    await deleteUser(u)
  }

  return {
    user,
    authReady,
    isSignedIn,
    uid,
    displayName,
    photoURL,
    loginDialogOpen,
    loginSheet,
    loginReason,
    newAccount,
    hasPassword,
    openLogin,
    closeLogin,
    enqueueAfterLogin,
    requireSignIn,
    signInWithEmail,
    registerWithEmail,
    resetPassword,
    signOut: signOutUser,
    updateDisplayName,
    updateUserEmail,
    updateUserPassword,
    deleteAccount,
  }
})
