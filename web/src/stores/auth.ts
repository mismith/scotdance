import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import {
  EmailAuthProvider,
  getAdditionalUserInfo,
  GoogleAuthProvider,
  OAuthProvider,
  isSignInWithEmailLink,
  sendSignInLinkToEmail,
  signInWithEmailLink,
  signInWithPopup,
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

/** Why sign-in was asked for, so the sheet can say so ("Sign in to follow Emma"). */
export interface LoginReason {
  reason: 'follow' | 'favorite' | 'alerts' | 'account'
  name?: string
}

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
  const loginReason = ref<LoginReason | null>(null)
  /** Set when an account was just created: the reason it happened, if any. */
  const newAccount = ref<{ reason: LoginReason['reason'] | null } | null>(null)
  const markNew = () => (newAccount.value = { reason: loginReason.value?.reason ?? null })
  const pendingActions = ref<PostLoginAction[]>([])

  function openLogin(reason: LoginReason | null = null) {
    loginReason.value = reason
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

  // Apple / Google via popup on the web. The native apps need the
  // @capacitor-firebase/authentication plugin for these (popups don't open
  // inside a WebView); until then they fall back to email.
  async function signInWithProvider(provider: 'apple' | 'google') {
    const p =
      provider === 'google'
        ? new GoogleAuthProvider()
        : new OAuthProvider('apple.com')
    if (provider === 'apple') (p as OAuthProvider).addScope('email')
    const cred = await signInWithPopup(auth, p)
    if (getAdditionalUserInfo(cred)?.isNewUser) markNew()
  }

  // Passwordless: email a one-time sign-in link. The address is remembered
  // on this device so opening the link here needs no retyping.
  const EMAIL_FOR_LINK = 'auth:emailForLink'
  async function sendSignInLink(email: string) {
    await sendSignInLinkToEmail(auth, email, {
      url: `${window.location.origin}/?signin=link`,
      handleCodeInApp: true,
    })
    try {
      localStorage.setItem(EMAIL_FOR_LINK, email)
    } catch {
      /* private mode */
    }
  }

  /** Call once on start-up: finishes an email-link sign-in if this is one. */
  async function completeEmailLinkSignIn(): Promise<boolean> {
    const href = window.location.href
    if (!isSignInWithEmailLink(auth, href)) return false
    let email: string | null = null
    try {
      email = localStorage.getItem(EMAIL_FOR_LINK)
    } catch {
      /* private mode */
    }
    if (!email) email = window.prompt('Confirm your email address to finish signing in') ?? null
    if (!email) return false
    const cred = await signInWithEmailLink(auth, email, href)
    if (getAdditionalUserInfo(cred)?.isNewUser) markNew()
    try {
      localStorage.removeItem(EMAIL_FOR_LINK)
    } catch {
      /* private mode */
    }
    const url = new URL(href)
    for (const k of ['apiKey', 'oobCode', 'mode', 'lang', 'signin', 'continueUrl'])
      url.searchParams.delete(k)
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash)
    return true
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
    loginReason,
    newAccount,
    openLogin,
    closeLogin,
    enqueueAfterLogin,
    requireSignIn,
    signInWithEmail,
    signInWithProvider,
    sendSignInLink,
    completeEmailLinkSignIn,
    registerWithEmail,
    resetPassword,
    signOut: signOutUser,
    updateDisplayName,
    updateUserEmail,
    updateUserPassword,
    deleteAccount,
  }
})
