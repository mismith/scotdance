import { defineStore } from 'pinia';
import { computed, ref, watch } from 'vue';
import { onValue, ref as dbRef } from 'firebase/database';
import { database } from '@/firebase';
import { useAuthStore } from './auth';

const NAMESPACE = import.meta.env.VITE_FIREBASE_DATA_NAMESPACE || 'production';

export interface MeRecord {
  email?: string;
  displayName?: string;
  photoURL?: string;
}

export const useMeStore = defineStore('me', () => {
  const auth = useAuthStore();
  const record = ref<MeRecord | null>(null);

  let unsubscribe: (() => void) | null = null;

  const displayName = computed(
    () => record.value?.displayName ?? auth.user?.displayName ?? null,
  );
  const email = computed(() => record.value?.email ?? auth.user?.email ?? null);
  const photoURL = computed(() => record.value?.photoURL ?? auth.user?.photoURL ?? null);

  watch(
    () => auth.uid,
    (uid) => {
      if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
      }
      if (!uid) {
        record.value = null;
        return;
      }
      const meRef = dbRef(database, `${NAMESPACE}/users/${uid}`);
      unsubscribe = onValue(meRef, (snap) => {
        record.value = (snap.val() as MeRecord | null) ?? null;
      });
    },
    { immediate: true },
  );

  return {
    record,
    displayName,
    email,
    photoURL,
  };
});
