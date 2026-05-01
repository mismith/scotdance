import { defineStore } from 'pinia';
import { computed, ref, watch } from 'vue';
import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { useCurrentUser } from 'vuefire';
import { auth } from '@/firebase';

type PostLoginAction = () => void | Promise<void>;

export const useAuthStore = defineStore('auth', () => {
  const user = useCurrentUser();
  const isSignedIn = computed(() => !!user.value);
  const uid = computed(() => user.value?.uid ?? null);
  const displayName = computed(() => user.value?.displayName ?? user.value?.email ?? null);
  const photoURL = computed(() => user.value?.photoURL ?? null);

  const loginDialogOpen = ref(false);
  const pendingActions = ref<PostLoginAction[]>([]);

  function openLogin() {
    loginDialogOpen.value = true;
  }

  function closeLogin() {
    loginDialogOpen.value = false;
  }

  function enqueueAfterLogin(action: PostLoginAction) {
    pendingActions.value.push(action);
  }

  async function flushPendingActions() {
    if (!pendingActions.value.length) return;
    const actions = pendingActions.value.slice();
    pendingActions.value = [];
    for (const action of actions) {
      try {
        await action();
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('Post-login action failed:', e);
      }
    }
  }

  function requireSignIn(action: PostLoginAction) {
    if (isSignedIn.value) {
      return action();
    }
    enqueueAfterLogin(action);
    openLogin();
    return undefined;
  }

  watch(isSignedIn, (signedIn) => {
    if (signedIn) {
      void flushPendingActions();
    } else {
      pendingActions.value = [];
    }
  });

  async function signInWithEmail(email: string, password: string) {
    await signInWithEmailAndPassword(auth, email, password);
  }

  async function registerWithEmail(email: string, password: string) {
    await createUserWithEmailAndPassword(auth, email, password);
  }

  async function resetPassword(email: string) {
    await sendPasswordResetEmail(auth, email);
  }

  async function signOutUser() {
    await signOut(auth);
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
  };
});
