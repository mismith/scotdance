import { defineStore } from 'pinia';
import { ref, watch } from 'vue';
import { ref as dbRef, onValue, set } from 'firebase/database';
import { database } from '@/firebase';
import { useAuthStore } from './auth';

const NAMESPACE = import.meta.env.VITE_FIREBASE_DATA_NAMESPACE || 'production';

export type FavoriteValue = string | boolean;

export const useFavoritesStore = defineStore('favorites', () => {
  const auth = useAuthStore();
  const dancers = ref<Record<string, FavoriteValue>>({});
  const competitions = ref<Record<string, FavoriteValue>>({});

  let unsubscribe: (() => void) | null = null;

  function isFavoriteDancer(id: string) {
    return Boolean(dancers.value[id]);
  }

  function isFavoriteCompetition(id: string) {
    return Boolean(competitions.value[id]);
  }

  async function toggleDancer(id: string, name?: string) {
    if (!auth.uid) throw new Error('Not signed in');
    const path = `${NAMESPACE}/users:favorites/${auth.uid}/dancers/${id}`;
    const current = dancers.value[id];
    await set(dbRef(database, path), current ? null : (name || true));
  }

  async function toggleCompetition(id: string) {
    if (!auth.uid) throw new Error('Not signed in');
    const path = `${NAMESPACE}/users:favorites/${auth.uid}/competitions/${id}`;
    const current = competitions.value[id];
    await set(dbRef(database, path), current ? null : true);
  }

  watch(
    () => auth.uid,
    (uid) => {
      if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
      }
      if (!uid) {
        dancers.value = {};
        competitions.value = {};
        return;
      }
      const ref = dbRef(database, `${NAMESPACE}/users:favorites/${uid}`);
      unsubscribe = onValue(ref, (snap) => {
        const val = (snap.val() as { dancers?: Record<string, FavoriteValue>; competitions?: Record<string, FavoriteValue> } | null) ?? {};
        dancers.value = val.dancers ?? {};
        competitions.value = val.competitions ?? {};
      });
    },
    { immediate: true },
  );

  return {
    dancers,
    competitions,
    isFavoriteDancer,
    isFavoriteCompetition,
    toggleDancer,
    toggleCompetition,
  };
});
