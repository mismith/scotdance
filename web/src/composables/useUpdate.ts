import { computed, reactive, ref } from 'vue'
import { onValue } from 'firebase/database'
import { compareVersions } from 'compare-versions'
import { version as currentVersion } from '../../package.json'
import { dataRef } from '@/firebase'
import { platform, STORE_URL } from '@/lib/native'

const latestVersion = ref<string | null>(null)
const dialogOpen = ref(false)

const updateAvailable = computed(() => {
  if (!latestVersion.value) return false
  try {
    return compareVersions(currentVersion, latestVersion.value) < 0
  } catch {
    // Not a version number (a typo in /versions): no prompt, rather than a broken tab bar.
    return false
  }
})

onValue(dataRef('versions'), (snap) => {
  const value = snap.val()
  if (value && typeof value === 'object') {
    const v = (value as Record<string, unknown>)[platform]
    latestVersion.value = typeof v === 'string' ? v : null
  } else {
    latestVersion.value = null
  }
})

function openDialog() {
  if (updateAvailable.value) dialogOpen.value = true
}

function closeDialog() {
  dialogOpen.value = false
}

// The web picks up a new version on reload; the apps get it from their store.
function applyUpdate() {
  dialogOpen.value = false
  const store = STORE_URL[platform]
  if (store) window.open(store, '_blank')
  else window.location.reload()
}

const state = reactive({
  currentVersion,
  latestVersion,
  updateAvailable,
  dialogOpen,
  openDialog,
  closeDialog,
  applyUpdate,
})

export function useUpdate() {
  return state
}
