import { defineStore } from 'pinia';
import { computed } from 'vue';
import { GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { useCurrentUser } from 'vuefire';
import { auth } from '@/firebase';

export const useAuthStore = defineStore('auth', () => {
  const user = useCurrentUser();
  const isSignedIn = computed(() => !!user.value);
  const uid = computed(() => user.value?.uid ?? null);
  const displayName = computed(() => user.value?.displayName ?? user.value?.email ?? null);
  const photoURL = computed(() => user.value?.photoURL ?? null);

  async function signInWithGoogle() {
    await signInWithPopup(auth, new GoogleAuthProvider());
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
    signInWithGoogle,
    signOut: signOutUser,
  };
});
