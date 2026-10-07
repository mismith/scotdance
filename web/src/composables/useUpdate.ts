import { computed, reactive, ref } from 'vue'
import { onValue } from 'firebase/database'
import { compareVersions } from 'compare-versions'
import { version as currentVersion } from '../../package.json'
import { dataRef } from '@/firebase'
import { platform, STORE_URL } from '@/lib/native'

const latestVersion = ref<string | null>(null)
const dialogOpen = ref(false)

// This build against the latest release: -1 behind, 0 the same, 1 ahead.
const comparison = computed(() => {
  if (!latestVersion.value) return null
  try {
    return compareVersions(currentVersion, latestVersion.value)
  } catch {
    // Not a version number (a typo in /versions): no prompt, rather than a broken tab bar.
    return null
  }
})

const updateAvailable = computed(() => comparison.value === -1)

// Ahead of the release: a TestFlight or Play testing build, or next.scotdance.app.
// The stores ship that same build, so it stops being early when /versions catches
// up: by hand for the apps (Tools), on deploy for the web (publish-web-version.js).
const early = computed(() => comparison.value === 1)

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
  early,
  dialogOpen,
  openDialog,
  closeDialog,
  applyUpdate,
})

export function useUpdate() {
  return state
}
