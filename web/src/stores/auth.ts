import { defineStore } from 'pinia';
import { computed } from 'vue';
import { useCurrentUser } from 'vuefire';

export const useAuthStore = defineStore('auth', () => {
  const user = useCurrentUser();
  const isSignedIn = computed(() => !!user.value);
  const uid = computed(() => user.value?.uid ?? null);

  return {
    user,
    isSignedIn,
    uid,
  };
});
