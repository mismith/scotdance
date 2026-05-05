import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { ref as dbRef, onValue, set } from 'firebase/database'
import { database } from '@/firebase'
import { useAuthStore } from './auth'

const NAMESPACE = import.meta.env.VITE_FIREBASE_DATA_NAMESPACE || 'production'

export type FavoriteValue = string | boolean

export const useFavoritesStore = defineStore('favorites', () => {
  const auth = useAuthStore()
  const dancers = ref<Record<string, FavoriteValue>>({})
  const competitions = ref<Record<string, FavoriteValue>>({})

  let unsubscribe: (() => void) | null = null

  function isFavoriteDancer(id: string) {
    return Boolean(dancers.value[id])
  }

  function isFavoriteCompetition(id: string) {
    return Boolean(competitions.value[id])
  }

  async function setDancer(id: string, on: boolean, name?: string) {
    if (!auth.uid) throw new Error('Not signed in')
    const path = `${NAMESPACE}/users:favorites/${auth.uid}/dancers/${id}`
    await set(dbRef(database, path), on ? name || true : null)
  }

  async function setCompetition(id: string, on: boolean) {
    if (!auth.uid) throw new Error('Not signed in')
    const path = `${NAMESPACE}/users:favorites/${auth.uid}/competitions/${id}`
    await set(dbRef(database, path), on ? true : null)
  }

  async function toggleDancer(id: string, name?: string) {
    await setDancer(id, !dancers.value[id], name)
  }

  async function toggleCompetition(id: string) {
    await setCompetition(id, !competitions.value[id])
  }

  watch(
    () => auth.uid,
    (uid) => {
      if (unsubscribe) {
        unsubscribe()
        unsubscribe = null
      }
      if (!uid) {
        dancers.value = {}
        competitions.value = {}
        return
      }
      const ref = dbRef(database, `${NAMESPACE}/users:favorites/${uid}`)
      unsubscribe = onValue(ref, (snap) => {
        const val =
          (snap.val() as {
            dancers?: Record<string, FavoriteValue>
            competitions?: Record<string, FavoriteValue>
          } | null) ?? {}
        dancers.value = val.dancers ?? {}
        competitions.value = val.competitions ?? {}
      })
    },
    { immediate: true },
  )

  return {
    dancers,
    competitions,
    isFavoriteDancer,
    isFavoriteCompetition,
    setDancer,
    setCompetition,
    toggleDancer,
    toggleCompetition,
  }
})
