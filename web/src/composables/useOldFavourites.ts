import { reactive, ref, watch } from 'vue'
import { useLocalStorage } from '@vueuse/core'
import { onValue, ref as dbRef } from 'firebase/database'
import { database } from '@/firebase'
import { useAuthStore } from '@/stores/auth'

const NAMESPACE = import.meta.env.VITE_FIREBASE_DATA_NAMESPACE || 'production'

// Whether this account's favourites came over from the old app (the
// favourites store notes each copied key under `oldDancers`), and how many
// times the app has started since, so news of the new look reaches the
// people it's news to, a few times, and then stops.
const copied = ref(false)
const launches = useLocalStorage('home:whatsNew:launches', 0)
let started = false
let countedThisLaunch = false

export function useOldFavourites() {
  if (!started) {
    started = true
    const auth = useAuthStore()
    let off: (() => void) | null = null
    watch(
      () => auth.uid,
      (uid) => {
        off?.()
        off = null
        copied.value = false
        if (!uid) return
        off = onValue(
          dbRef(database, `${NAMESPACE}/users:favorites/${uid}/oldDancers`),
          (snap) => {
            copied.value = !!snap.val() && Object.keys(snap.val()).length > 0
            if (copied.value && !countedThisLaunch) {
              countedThisLaunch = true
              launches.value++
            }
          },
          () => (copied.value = false),
        )
      },
      { immediate: true },
    )
  }
  return reactive({ copied, launches })
}
