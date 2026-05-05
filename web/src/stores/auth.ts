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
import { ref as dbRef, remove, set, update } from 'firebase/database'
import { useCurrentUser } from 'vuefire'
import { auth, database } from '@/firebase'

type PostLoginAction = () => void | Promise<void>

const NAMESPACE = import.meta.env.VITE_FIREBASE_DATA_NAMESPACE || 'production'

function userPath(uid: string, child = '') {
  return `${NAMESPACE}/users/${uid}${child ? `/${child}` : ''}`
}

export const useAuthStore = defineStore('auth', () => {
  const user = useCurrentUser()
  const isSignedIn = computed(() => !!user.value)
  const uid = computed(() => user.value?.uid ?? null)
  const displayName = computed(() => user.value?.displayName ?? user.value?.email ?? null)
  const photoURL = computed(() => user.value?.photoURL ?? null)

  const loginDialogOpen = ref(false)
  const pendingActions = ref<PostLoginAction[]>([])

  function openLogin() {
    loginDialogOpen.value = true
  }

  function closeLogin() {
    loginDialogOpen.value = false
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

  function requireSignIn(action: PostLoginAction) {
    if (isSignedIn.value) {
      return action()
    }
    enqueueAfterLogin(action)
    openLogin()
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
  }

  async function resetPassword(email: string) {
    await sendPasswordResetEmail(auth, email)
  }

  async function signOutUser() {
    await signOut(auth)
  }

  async function reauthenticate(currentPassword: string) {
    const u = auth.currentUser
    if (!u || !u.email) throw new Error('Not signed in')
    const credential = EmailAuthProvider.credential(u.email, currentPassword)
    await reauthenticateWithCredential(u, credential)
  }

  async function updateDisplayName(name: string) {
    const u = auth.currentUser
    if (!u) throw new Error('Not signed in')
    await updateProfile(u, { displayName: name || null })
    await update(dbRef(database, userPath(u.uid)), { displayName: name || null })
  }

  async function updateUserEmail(newEmail: string, currentPassword: string) {
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

  async function deleteAccount(currentPassword: string) {
    await reauthenticate(currentPassword)
    const u = auth.currentUser
    if (!u) throw new Error('Not signed in')
    const uid = u.uid
    await deleteUser(u)
    await Promise.all([
      remove(dbRef(database, `${NAMESPACE}/users/${uid}`)),
      remove(dbRef(database, `${NAMESPACE}/users:favorites/${uid}`)),
      remove(dbRef(database, `${NAMESPACE}/users:permissions/${uid}`)),
    ])
  }

  return {
    user,
    isSignedIn,
    uid,
    displayName,
    photoURL,
    loginDialogOpen,
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
