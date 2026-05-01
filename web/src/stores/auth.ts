import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { useCurrentUser } from 'vuefire';
import { auth } from '@/firebase';

export const useAuthStore = defineStore('auth', () => {
  const user = useCurrentUser();
  const isSignedIn = computed(() => !!user.value);
  const uid = computed(() => user.value?.uid ?? null);
  const displayName = computed(() => user.value?.displayName ?? user.value?.email ?? null);
  const photoURL = computed(() => user.value?.photoURL ?? null);

  const loginDialogOpen = ref(false);

  function openLogin() {
    loginDialogOpen.value = true;
  }

  function closeLogin() {
    loginDialogOpen.value = false;
  }

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
    signInWithEmail,
    registerWithEmail,
    resetPassword,
    signOut: signOutUser,
  };
});
